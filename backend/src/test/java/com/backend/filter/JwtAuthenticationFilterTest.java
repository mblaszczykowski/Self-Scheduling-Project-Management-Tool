package com.backend.filter;

import com.backend.services.TokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private TokenService tokenService;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    private JwtAuthenticationFilter filter;
    private ObjectMapper objectMapper;

    private static final Integer TEST_USER_ID = 123;
    private static final String VALID_TOKEN = "valid.jwt.token";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        filter = new JwtAuthenticationFilter(tokenService, objectMapper);
    }

    @Nested
    @DisplayName("Public Endpoints")
    class PublicEndpointTests {

        @ParameterizedTest
        @CsvSource({
                "/api/auth/login, POST",
                "/api/auth/refresh, POST",
                "/api/users/exists, GET"
        })
        @DisplayName("should bypass authentication for public endpoints")
        void shouldBypassPublicEndpoints(String path, String method) throws Exception {
            when(request.getRequestURI()).thenReturn(path);
            when(request.getMethod()).thenReturn(method);

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
            verify(tokenService, never()).extractTokenFromRequest(any());
        }

        @Test
        @DisplayName("should bypass authentication for POST /api/users (registration)")
        void shouldBypassRegistration() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/users");
            when(request.getMethod()).thenReturn("POST");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
            verify(tokenService, never()).extractTokenFromRequest(any());
        }

        @Test
        @DisplayName("should NOT bypass GET /api/users (requires auth)")
        void shouldNotBypassGetUsers() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/users");
            when(request.getMethod()).thenReturn("GET");
            when(tokenService.extractTokenFromRequest(request)).thenReturn(null);

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain, never()).doFilter(request, response);
            verify(response).setStatus(HttpStatus.UNAUTHORIZED.value());
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "/static/js/main.js",
                "/static/css/styles.css",
                "/uploads/image.png"
        })
        @DisplayName("should bypass authentication for static content paths (/files is authenticated)")
        void shouldBypassStaticPaths(String path) throws Exception {
            when(request.getRequestURI()).thenReturn(path);
            when(request.getMethod()).thenReturn("GET");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("should bypass authentication for /error endpoint")
        void shouldBypassErrorEndpoint() throws Exception {
            when(request.getRequestURI()).thenReturn("/error");
            when(request.getMethod()).thenReturn("GET");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }
    }

    @Nested
    @DisplayName("OPTIONS Requests")
    class OptionsRequestTests {

        @Test
        @DisplayName("should bypass authentication for OPTIONS requests (CORS preflight)")
        void shouldBypassOptionsRequests() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("OPTIONS");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
            verify(tokenService, never()).extractTokenFromRequest(any());
        }

        @Test
        @DisplayName("should bypass OPTIONS for any protected endpoint")
        void shouldBypassOptionsForProtectedEndpoint() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/users");
            when(request.getMethod()).thenReturn("OPTIONS");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }
    }

    @Nested
    @DisplayName("Token Validation")
    class TokenValidationTests {

        @Test
        @DisplayName("should authenticate and set userId for valid token")
        void shouldAuthenticateValidToken() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("GET");
            when(tokenService.extractTokenFromRequest(request)).thenReturn(VALID_TOKEN);
            when(tokenService.validateTokenAndGetUserId(VALID_TOKEN)).thenReturn(TEST_USER_ID);

            filter.doFilterInternal(request, response, filterChain);

            verify(request).setAttribute("userId", TEST_USER_ID);
            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("should return 401 when token is missing")
        void shouldReturn401WhenTokenMissing() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("GET");
            when(tokenService.extractTokenFromRequest(request)).thenReturn(null);

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.UNAUTHORIZED.value());
            verify(response).setContentType(MediaType.APPLICATION_JSON_VALUE);
            verify(filterChain, never()).doFilter(request, response);

            String jsonResponse = stringWriter.toString();
            assertTrue(jsonResponse.contains("Missing authentication token"));
            assertTrue(jsonResponse.contains("AUTH_ERROR"));
        }

        @Test
        @DisplayName("should return 401 when token is invalid")
        void shouldReturn401WhenTokenInvalid() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("GET");
            when(tokenService.extractTokenFromRequest(request)).thenReturn("invalid-token");
            when(tokenService.validateTokenAndGetUserId("invalid-token")).thenReturn(null);

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.UNAUTHORIZED.value());
            verify(filterChain, never()).doFilter(request, response);

            String jsonResponse = stringWriter.toString();
            assertTrue(jsonResponse.contains("Invalid or expired token"));
        }

        @Test
        @DisplayName("should return 401 when token validation throws exception")
        void shouldReturn401OnException() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("GET");
            when(tokenService.extractTokenFromRequest(request)).thenThrow(new RuntimeException("Unexpected error"));

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.UNAUTHORIZED.value());
            verify(filterChain, never()).doFilter(request, response);

            String jsonResponse = stringWriter.toString();
            assertTrue(jsonResponse.contains("Authentication failed"));
        }
    }

    @Nested
    @DisplayName("Error Response Format")
    class ErrorResponseFormatTests {

        @Test
        @DisplayName("should return JSON error with correct structure")
        void shouldReturnJsonErrorWithCorrectStructure() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("GET");
            when(tokenService.extractTokenFromRequest(request)).thenReturn(null);

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            String jsonResponse = stringWriter.toString();
            assertTrue(jsonResponse.contains("\"status\":401"));
            assertTrue(jsonResponse.contains("\"error\":\"Unauthorized\""));
            assertTrue(jsonResponse.contains("\"code\":\"AUTH_ERROR\""));
            assertTrue(jsonResponse.contains("\"message\":"));
            assertTrue(jsonResponse.contains("\"timestamp\":"));
        }
    }

    @Nested
    @DisplayName("Protected Endpoints")
    class ProtectedEndpointTests {

        @ParameterizedTest
        @CsvSource({
                "/api/projects, GET",
                "/api/projects, POST",
                "/api/projects/ABC, PUT",
                "/api/projects/ABC, DELETE",
                "/api/tasks/assigned, GET",
                "/api/notifications, GET",
                "/api/users, PUT"
        })
        @DisplayName("should require authentication for protected endpoints")
        void shouldRequireAuthForProtectedEndpoints(String path, String method) throws Exception {
            when(request.getRequestURI()).thenReturn(path);
            when(request.getMethod()).thenReturn(method);
            when(tokenService.extractTokenFromRequest(request)).thenReturn(null);

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.UNAUTHORIZED.value());
            verify(filterChain, never()).doFilter(request, response);
        }
    }

    @Nested
    @DisplayName("Edge Cases")
    class EdgeCaseTests {

        @Test
        @DisplayName("should handle case-insensitive OPTIONS method")
        void shouldHandleCaseInsensitiveOptions() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("options");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("should handle case-insensitive POST for registration")
        void shouldHandleCaseInsensitivePost() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/users");
            when(request.getMethod()).thenReturn("post");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }
    }
}
