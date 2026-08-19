package com.backend.filter;

import com.backend.services.TokenService;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {
    private static final Integer TEST_USER_ID = 123;
    private static final String VALID_TOKEN = "valid.jwt.token";

    @Mock private TokenService tokenService;
    @Mock private FilterChain filterChain;

    private JwtAuthenticationFilter filter;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(tokenService,
                JsonMapper.builder().addModule(new JavaTimeModule()).build());
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
    }

    private void given(String method, String path) {
        request.setMethod(method);
        request.setRequestURI(path);
    }

    @Nested
    @DisplayName("Endpoints reachable without a token")
    class PublicEndpoints {
        @ParameterizedTest
        @CsvSource({
                "POST, /api/auth/login",
                "POST, /api/auth/refresh",
                "POST, /api/auth/logout",
                "POST, /api/users",
                "GET,  /error",
                "GET,  /actuator/health",
                "GET,  /swagger-ui.html",
                "GET,  /swagger-ui/index.html",
                "GET,  /v3/api-docs",
                "GET,  /v3/api-docs.yaml",
                "GET,  /v3/api-docs/swagger-config"
        })
        @DisplayName("pass straight through without a token being looked for")
        void publicEndpointsBypassAuthentication(String method, String path) throws Exception {
            given(method, path);

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
            verifyNoInteractions(tokenService);
        }

        @Test
        @DisplayName("registration is public but reading the current user is not")
        void registrationIsPublicButReadingIsNot() throws Exception {
            given("GET", "/api/users");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain, never()).doFilter(any(), any());
            assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "/uploads/image.png",
                "/static/js/main.js",
                "/api/users/exists",
                "/files/8f1c.pdf",
                "/api/projects"
        })
        @DisplayName("everything not explicitly listed requires a token")
        void unlistedPathsRequireAuthentication(String path) throws Exception {
            given("GET", path);

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain, never()).doFilter(any(), any());
            assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        }

        @Test
        @DisplayName("a preflight request is not authenticated")
        void optionsBypassesAuthentication() throws Exception {
            given("OPTIONS", "/api/projects");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("exemption matching is exact, so a path that merely starts with one is refused")
        void exemptionMatchingIsExact() throws Exception {
            given("POST", "/api/auth/login/../projects");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain, never()).doFilter(any(), any());
            assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        }
    }

    @Nested
    @DisplayName("Protected endpoints")
    class ProtectedEndpoints {
        @Test
        @DisplayName("a valid token authenticates the request and publishes the user id")
        void validTokenAuthenticates() throws Exception {
            given("GET", "/api/projects");
            when(tokenService.extractTokenFromRequest(request)).thenReturn(VALID_TOKEN);
            when(tokenService.validateTokenAndGetUserId(VALID_TOKEN)).thenReturn(TEST_USER_ID);

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
            assertThat(request.getAttribute(TokenService.USER_ID_ATTRIBUTE)).isEqualTo(TEST_USER_ID);
        }

        @Test
        @DisplayName("a missing token is refused and never reaches the handler")
        void missingTokenIsRefused() throws Exception {
            given("GET", "/api/projects");
            when(tokenService.extractTokenFromRequest(request)).thenReturn(null);

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain, never()).doFilter(any(), any());
            assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
            assertThat(request.getAttribute(TokenService.USER_ID_ATTRIBUTE)).isNull();
        }

        @Test
        @DisplayName("a token that does not validate is refused")
        void invalidTokenIsRefused() throws Exception {
            given("GET", "/api/projects");
            when(tokenService.extractTokenFromRequest(request)).thenReturn("tampered");
            when(tokenService.validateTokenAndGetUserId("tampered")).thenReturn(null);

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain, never()).doFilter(any(), any());
            assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        }

        @Test
        @DisplayName("a failure while validating becomes a 401, not a leaked 500")
        void validationFailureBecomesUnauthorized() throws Exception {
            given("GET", "/api/projects");
            when(tokenService.extractTokenFromRequest(request))
                    .thenThrow(new RuntimeException("boom"));

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain, never()).doFilter(any(), any());
            assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
            assertThat(response.getContentAsString()).doesNotContain("boom");
        }
    }

    @Nested
    @DisplayName("The refusal body")
    class RefusalBody {
        @Test
        @DisplayName("is the application's single error shape, as JSON")
        void refusalBodyIsApiError() throws Exception {
            given("GET", "/api/projects");
            when(tokenService.extractTokenFromRequest(request)).thenReturn(null);

            filter.doFilterInternal(request, response, filterChain);

            assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_JSON_VALUE);

            var body = JsonMapper.builder().addModule(new JavaTimeModule()).build()
                    .readTree(response.getContentAsString());
            assertThat(body.get("status").asInt()).isEqualTo(401);
            assertThat(body.get("error").asText()).isEqualTo("Unauthorized");
            assertThat(body.get("message").asText()).isNotBlank();
            assertThat(body.get("code").asText()).isEqualTo("AUTH_ERROR");
            assertThat(body.get("timestamp").asText()).isNotBlank();
        }

        @Test
        @DisplayName("never reveals why the token was rejected")
        void refusalBodyRevealsNothing() throws Exception {
            given("GET", "/api/projects");
            when(tokenService.extractTokenFromRequest(request)).thenReturn("expired.token.value");
            when(tokenService.validateTokenAndGetUserId("expired.token.value")).thenReturn(null);

            filter.doFilterInternal(request, response, filterChain);

            assertThat(response.getContentAsString()).doesNotContain("expired.token.value");
        }
    }
}
