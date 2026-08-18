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

/**
 * The deny-by-default authentication policy.
 *
 * <p>Uses real {@link MockHttpServletRequest}/{@link MockHttpServletResponse} rather than mocks so
 * the assertions are about the response that was actually produced — status, content type and JSON
 * body — instead of about which setter happened to be called.
 *
 * <p>The {@code ObjectMapper} is built the way Spring Boot builds the application's own, with the
 * JSR-310 module registered. A bare mapper cannot serialize the {@code Instant} in an
 * {@code ApiError}, and a filter that throws while writing a 401 is a bad failure mode to discover
 * in production.
 */
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
                "POST, /api/users",
                "GET,  /error",
                "GET,  /actuator/health"
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
            // /uploads/** and /static/** used to be exempt for paths nothing serves, which made an
            // unauthenticated 500-with-stack-trace reachable; /api/users/exists was removed
            // outright because it was an anonymous account-existence oracle.
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
            // Fail-closed: an encoding or matrix-parameter trick makes a request less likely to
            // match an exemption, never more.
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
            // Serializing an Instant is exactly what a bare ObjectMapper cannot do, so this also
            // pins that the filter's mapper is configured for it.
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
