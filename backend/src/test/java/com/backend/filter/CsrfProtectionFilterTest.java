package com.backend.filter;

import com.backend.config.CookieProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CsrfProtectionFilterTest {

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    private CsrfProtectionFilter filter;
    private ObjectMapper objectMapper;

    private static final String CSRF_COOKIE_NAME = "XSRF-TOKEN";
    private static final String CSRF_HEADER_NAME = "X-CSRF-Token";
    private static final String VALID_TOKEN = "validCsrfToken123456789012345678901234567890";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        CookieProperties cookieProperties = new CookieProperties();
        cookieProperties.setSecure(false);
        cookieProperties.setSameSite("Lax");
        filter = new CsrfProtectionFilter(objectMapper, cookieProperties);
    }

    @Nested
    @DisplayName("Safe Methods (GET, HEAD, OPTIONS)")
    class SafeMethodTests {

        @ParameterizedTest
        @ValueSource(strings = {"GET", "HEAD", "OPTIONS"})
        @DisplayName("should allow safe methods without CSRF validation")
        void shouldAllowSafeMethodsWithoutCsrf(String method) throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn(method);
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie(CSRF_COOKIE_NAME, VALID_TOKEN)});

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("should set CSRF cookie on GET request when missing")
        void shouldSetCsrfCookieOnGet() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("GET");
            when(request.getCookies()).thenReturn(null);

            filter.doFilterInternal(request, response, filterChain);

            ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
            verify(response).addCookie(cookieCaptor.capture());

            Cookie cookie = cookieCaptor.getValue();
            assertEquals(CSRF_COOKIE_NAME, cookie.getName());
            assertNotNull(cookie.getValue());
            assertFalse(cookie.isHttpOnly()); // Must be readable by JS
            assertEquals("/", cookie.getPath());
            assertEquals(3600, cookie.getMaxAge());
        }

        @Test
        @DisplayName("should generate Base64 URL-encoded CSRF token")
        void shouldGenerateBase64UrlEncodedToken() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("GET");
            when(request.getCookies()).thenReturn(null);

            filter.doFilterInternal(request, response, filterChain);

            ArgumentCaptor<Cookie> cookieCaptor = ArgumentCaptor.forClass(Cookie.class);
            verify(response).addCookie(cookieCaptor.capture());

            String token = cookieCaptor.getValue().getValue();
            // Token should be 32 bytes = 43 Base64 URL-safe characters (no padding)
            assertTrue(token.length() >= 40);
            // Should be valid Base64 URL
            assertDoesNotThrow(() -> Base64.getUrlDecoder().decode(token));
        }

        @Test
        @DisplayName("should NOT set new cookie when CSRF cookie already exists")
        void shouldNotSetCookieWhenExists() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("GET");
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie(CSRF_COOKIE_NAME, VALID_TOKEN)});

            filter.doFilterInternal(request, response, filterChain);

            verify(response, never()).addCookie(any());
            verify(filterChain).doFilter(request, response);
        }
    }

    @Nested
    @DisplayName("State-Changing Methods (POST, PUT, DELETE, PATCH)")
    class StateChangingMethodTests {

        @Test
        @DisplayName("should allow POST with matching CSRF tokens")
        void shouldAllowPostWithMatchingTokens() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("POST");
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie(CSRF_COOKIE_NAME, VALID_TOKEN)});
            when(request.getHeader(CSRF_HEADER_NAME)).thenReturn(VALID_TOKEN);

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("should reject POST with mismatched CSRF tokens")
        void shouldRejectPostWithMismatchedTokens() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("POST");
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie(CSRF_COOKIE_NAME, VALID_TOKEN)});
            when(request.getHeader(CSRF_HEADER_NAME)).thenReturn("different-token");

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.FORBIDDEN.value());
            verify(filterChain, never()).doFilter(request, response);
        }

        @Test
        @DisplayName("should reject POST with missing CSRF header")
        void shouldRejectPostWithMissingHeader() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("POST");
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie(CSRF_COOKIE_NAME, VALID_TOKEN)});
            when(request.getHeader(CSRF_HEADER_NAME)).thenReturn(null);

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.FORBIDDEN.value());
            verify(filterChain, never()).doFilter(request, response);
        }

        @Test
        @DisplayName("should reject POST with missing CSRF cookie")
        void shouldRejectPostWithMissingCookie() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("POST");
            when(request.getCookies()).thenReturn(null);
            when(request.getHeader(CSRF_HEADER_NAME)).thenReturn(VALID_TOKEN);

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.FORBIDDEN.value());
            verify(filterChain, never()).doFilter(request, response);
        }

        @ParameterizedTest
        @ValueSource(strings = {"PUT", "DELETE", "PATCH"})
        @DisplayName("should validate CSRF for PUT, DELETE, PATCH methods")
        void shouldValidateCsrfForAllStateChangingMethods(String method) throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects/ABC");
            when(request.getMethod()).thenReturn(method);
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie(CSRF_COOKIE_NAME, VALID_TOKEN)});
            when(request.getHeader(CSRF_HEADER_NAME)).thenReturn(VALID_TOKEN);

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }
    }

    @Nested
    @DisplayName("Exempt Endpoints")
    class ExemptEndpointTests {

        @Test
        @DisplayName("should exempt login endpoint from CSRF")
        void shouldExemptLogin() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/auth/login");
            when(request.getMethod()).thenReturn("POST");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
            verify(request, never()).getHeader(CSRF_HEADER_NAME);
        }

        @Test
        @DisplayName("should exempt refresh endpoint from CSRF")
        void shouldExemptRefresh() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/auth/refresh");
            when(request.getMethod()).thenReturn("POST");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("should exempt registration endpoint from CSRF")
        void shouldExemptRegistration() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/users");
            when(request.getMethod()).thenReturn("POST");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("should exempt user exists check from CSRF")
        void shouldExemptUserExists() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/users/exists");
            when(request.getMethod()).thenReturn("GET");
            when(request.getCookies()).thenReturn(null);

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }

        @ParameterizedTest
        @ValueSource(strings = {"/files/doc.pdf", "/uploads/image.png", "/static/script.js"})
        @DisplayName("should exempt file endpoints from CSRF")
        void shouldExemptFileEndpoints(String path) throws Exception {
            when(request.getRequestURI()).thenReturn(path);
            when(request.getMethod()).thenReturn("POST");

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }
    }

    @Nested
    @DisplayName("Error Response")
    class ErrorResponseTests {

        @Test
        @DisplayName("should return JSON error with correct format")
        void shouldReturnJsonError() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("POST");
            when(request.getCookies()).thenReturn(null);

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.FORBIDDEN.value());
            verify(response).setContentType(MediaType.APPLICATION_JSON_VALUE);

            String jsonResponse = stringWriter.toString();
            assertTrue(jsonResponse.contains("\"status\":403"));
            assertTrue(jsonResponse.contains("\"error\":\"Forbidden\""));
            assertTrue(jsonResponse.contains("CSRF token validation failed"));
        }
    }

    @Nested
    @DisplayName("Edge Cases")
    class EdgeCaseTests {

        @Test
        @DisplayName("should handle empty cookies array")
        void shouldHandleEmptyCookiesArray() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("POST");
            when(request.getCookies()).thenReturn(new Cookie[]{});

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.FORBIDDEN.value());
        }

        @Test
        @DisplayName("should find CSRF cookie among multiple cookies")
        void shouldFindCsrfCookieAmongMany() throws Exception {
            Cookie[] cookies = {
                    new Cookie("accessToken", "some-token"),
                    new Cookie(CSRF_COOKIE_NAME, VALID_TOKEN),
                    new Cookie("refreshToken", "refresh-token")
            };

            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("POST");
            when(request.getCookies()).thenReturn(cookies);
            when(request.getHeader(CSRF_HEADER_NAME)).thenReturn(VALID_TOKEN);

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("should handle case-insensitive method comparison")
        void shouldHandleCaseInsensitiveMethod() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("get");
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie(CSRF_COOKIE_NAME, VALID_TOKEN)});

            filter.doFilterInternal(request, response, filterChain);

            verify(filterChain).doFilter(request, response);
        }

        @Test
        @DisplayName("should reject empty string as CSRF header")
        void shouldRejectEmptyHeader() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("POST");
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie(CSRF_COOKIE_NAME, VALID_TOKEN)});
            when(request.getHeader(CSRF_HEADER_NAME)).thenReturn("");

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.FORBIDDEN.value());
        }

        @Test
        @DisplayName("should use strict equality for token comparison")
        void shouldUseStrictEqualityForTokens() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/projects");
            when(request.getMethod()).thenReturn("POST");
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie(CSRF_COOKIE_NAME, VALID_TOKEN)});
            // Token with extra whitespace
            when(request.getHeader(CSRF_HEADER_NAME)).thenReturn(VALID_TOKEN + " ");

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.FORBIDDEN.value());
        }
    }

    @Nested
    @DisplayName("Non-exempt PUT /api/users requires CSRF")
    class NonExemptEndpointTests {

        @Test
        @DisplayName("PUT /api/users should require CSRF validation")
        void shouldRequireCsrfForUserUpdate() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/users");
            when(request.getMethod()).thenReturn("PUT");
            when(request.getCookies()).thenReturn(null);

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.FORBIDDEN.value());
        }

        @Test
        @DisplayName("DELETE /api/users should require CSRF validation")
        void shouldRequireCsrfForUserDelete() throws Exception {
            when(request.getRequestURI()).thenReturn("/api/users");
            when(request.getMethod()).thenReturn("DELETE");
            when(request.getCookies()).thenReturn(null);

            StringWriter stringWriter = new StringWriter();
            when(response.getWriter()).thenReturn(new PrintWriter(stringWriter));

            filter.doFilterInternal(request, response, filterChain);

            verify(response).setStatus(HttpStatus.FORBIDDEN.value());
        }
    }
}
