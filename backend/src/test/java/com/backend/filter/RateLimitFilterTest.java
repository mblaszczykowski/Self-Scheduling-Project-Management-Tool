package com.backend.filter;

import com.backend.services.RateLimitService;
import com.backend.services.RateLimitService.Bucket;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RateLimitFilterTest {
    private static final String CLIENT_IP = "203.0.113.7";

    @Mock private RateLimitService rateLimitService;
    @Mock private FilterChain filterChain;

    private RateLimitFilter filter;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter(
                JsonMapper.builder().addModule(new JavaTimeModule()).build(), rateLimitService);
        request = new MockHttpServletRequest();
        request.setRemoteAddr(CLIENT_IP);
        response = new MockHttpServletResponse();
        lenient().when(rateLimitService.allow(any(), any())).thenReturn(true);
    }

    private void given(String method, String path) {
        request.setMethod(method);
        request.setRequestURI(path);
    }

    private void invokeFilter() throws Exception {
        filter.doFilterInternal(request, response, filterChain);
    }

    @Nested
    @DisplayName("Bucket selection by path and method")
    class BucketSelection {
        @Test
        @DisplayName("POST /api/users consults the REGISTER bucket")
        void registerBucketForRegistration() throws Exception {
            given("POST", "/api/users");

            invokeFilter();

            verify(rateLimitService).allow(Bucket.REGISTER, CLIENT_IP);
        }

        @Test
        @DisplayName("a non-preflight request under /api/optimization/ consults the OPTIMIZE bucket")
        void optimizeBucketForOptimizationRequests() throws Exception {
            given("GET", "/api/optimization/run");

            invokeFilter();

            verify(rateLimitService).allow(Bucket.OPTIMIZE, CLIENT_IP);
        }

        @Test
        @DisplayName("a non-preflight request under /api/search consults the SEARCH bucket")
        void searchBucketForSearchRequests() throws Exception {
            given("GET", "/api/search");

            invokeFilter();

            verify(rateLimitService).allow(Bucket.SEARCH, CLIENT_IP);
        }

        @Test
        @DisplayName("a write method under /api/ consults the general WRITE bucket")
        void writeBucketForGeneralWrites() throws Exception {
            given("POST", "/api/projects");

            invokeFilter();

            verify(rateLimitService).allow(Bucket.WRITE, CLIENT_IP);
        }

        @Test
        @DisplayName("a safe method does not consume a write token")
        void safeMethodDoesNotConsumeAWriteToken() throws Exception {
            given("GET", "/api/projects");

            invokeFilter();

            verifyNoInteractions(rateLimitService);
        }

        @Test
        @DisplayName("POST /api/users consumes both a REGISTER and a WRITE token")
        void registrationConsumesBothRegisterAndWriteTokens() throws Exception {
            given("POST", "/api/users");

            invokeFilter();

            verify(rateLimitService).allow(Bucket.REGISTER, CLIENT_IP);
            verify(rateLimitService).allow(Bucket.WRITE, CLIENT_IP);
        }

        @Test
        @DisplayName("login has no dedicated bucket at the filter level, only the general WRITE bucket")
        void loginPathHasNoDedicatedBucketHere() throws Exception {
            given("POST", "/api/auth/login");

            invokeFilter();

            verify(rateLimitService, never()).allow(eq(Bucket.LOGIN), any());
            verify(rateLimitService).allow(Bucket.WRITE, CLIENT_IP);
        }
    }

    @Nested
    @DisplayName("Preflight requests")
    class Preflight {
        @Test
        @DisplayName("OPTIONS is exempt and passes straight through without consulting any bucket")
        void optionsBypassesRateLimiting() throws Exception {
            given("OPTIONS", "/api/optimization/run");

            invokeFilter();

            verifyNoInteractions(rateLimitService);
            verify(filterChain).doFilter(request, response);
        }
    }

    @Nested
    @DisplayName("When the service refuses")
    class Refused {
        @Test
        @DisplayName("responds 429 with Retry-After and never invokes the chain")
        void refusalSendsTooManyRequestsAndBlocksTheChain() throws Exception {
            given("POST", "/api/projects");
            when(rateLimitService.allow(Bucket.WRITE, CLIENT_IP)).thenReturn(false);
            when(rateLimitService.getWindowMs()).thenReturn(900_000L);

            invokeFilter();

            verify(filterChain, never()).doFilter(any(), any());
            assertThat(response.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
            assertThat(response.getHeader("Retry-After")).isEqualTo("900");
        }

        @Test
        @DisplayName("the refusal body is the application's single error shape")
        void refusalBodyIsApiError() throws Exception {
            given("POST", "/api/projects");
            when(rateLimitService.allow(Bucket.WRITE, CLIENT_IP)).thenReturn(false);
            when(rateLimitService.getWindowMs()).thenReturn(900_000L);

            invokeFilter();

            assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_JSON_VALUE);
            var mapper = JsonMapper.builder().addModule(new JavaTimeModule()).build();
            var body = mapper.readTree(response.getContentAsString());
            assertThat(body.get("status").asInt()).isEqualTo(429);
            assertThat(body.get("code").asText()).isEqualTo("RATE_LIMITED");
            assertThat(body.get("timestamp").asText()).isNotBlank();
        }

        @Test
        @DisplayName("a refused REGISTER check short-circuits before the WRITE bucket is ever consulted")
        void registerRefusalShortCircuitsBeforeWrite() throws Exception {
            given("POST", "/api/users");
            when(rateLimitService.allow(Bucket.REGISTER, CLIENT_IP)).thenReturn(false);
            when(rateLimitService.getWindowMs()).thenReturn(900_000L);

            invokeFilter();

            verify(rateLimitService, never()).allow(eq(Bucket.WRITE), any());
            verify(filterChain, never()).doFilter(any(), any());
            assertThat(response.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
        }
    }

    @Nested
    @DisplayName("When the service allows")
    class Allowed {
        @Test
        @DisplayName("the chain is invoked")
        void allowedRequestReachesTheChain() throws Exception {
            given("POST", "/api/projects");

            invokeFilter();

            verify(filterChain).doFilter(request, response);
            assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
        }
    }
}
