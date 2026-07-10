package com.backend.services;

import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ValidationException;
import com.backend.requests.LoginRequest;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserService userService;

    @Mock
    private TokenService tokenService;

    @Mock
    private com.backend.filter.RateLimitFilter rateLimitFilter;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    private AuthService authService;

    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_PASSWORD = "TestPassword123!";
    private static final Integer TEST_USER_ID = 1;

    private User testUser;
    private BCryptPasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder(12);
        var cookieProperties = new com.backend.config.CookieProperties();
        cookieProperties.setSecure(false);
        cookieProperties.setSameSite("Strict");
        var cookieFactory = new com.backend.util.CookieFactory(cookieProperties);
        authService = new AuthService(userService, tokenService, rateLimitFilter, passwordEncoder, cookieFactory, "");

        testUser = new User();
        testUser.setId(TEST_USER_ID);
        testUser.setEmail(TEST_EMAIL);
        testUser.setPassword(passwordEncoder.encode(TEST_PASSWORD));
        testUser.setFirstname("Test");
        testUser.setLastname("User");
    }

    @Nested
    @DisplayName("authenticateUser")
    class AuthenticateUserTests {

        @Test
        @DisplayName("should return tokens for valid credentials")
        void shouldReturnTokensForValidCredentials() {
            when(userService.findUserByEmailOrNull(TEST_EMAIL)).thenReturn(testUser);

            TokenService.AuthTokens mockTokens = new TokenService.AuthTokens(
                    ResponseCookie.from("accessToken", "access-value").build(),
                    ResponseCookie.from("refreshToken", "refresh-value").build()
            );
            when(tokenService.createAuthTokens(TEST_USER_ID)).thenReturn(mockTokens);

            LoginRequest loginReq = new LoginRequest(TEST_EMAIL, TEST_PASSWORD);
            var result = authService.authenticateUser(loginReq, request);

            assertNotNull(result);
            assertNotNull(result.tokens());
            assertEquals("Login successful", result.body().get("message"));
            assertEquals(TEST_USER_ID, result.body().get("userId"));
        }

        @Test
        @DisplayName("should throw ValidationException for invalid password")
        void shouldThrowForInvalidPassword() {
            when(userService.findUserByEmailOrNull(TEST_EMAIL)).thenReturn(testUser);

            LoginRequest loginReq = new LoginRequest(TEST_EMAIL, "WrongPassword123!");

            var ex = assertThrows(ValidationException.class, () ->
                    authService.authenticateUser(loginReq, request));
            assertEquals("Invalid email or password", ex.getMessage());
        }

        @Test
        @DisplayName("should throw ValidationException for non-existent user without revealing user existence")
        void shouldThrowForNonExistentUser() {
            when(userService.findUserByEmailOrNull("nonexistent@example.com")).thenReturn(null);

            LoginRequest loginReq = new LoginRequest("nonexistent@example.com", TEST_PASSWORD);

            var ex = assertThrows(ValidationException.class, () ->
                    authService.authenticateUser(loginReq, request));
            assertEquals("Invalid email or password", ex.getMessage());
        }

        @Test
        @DisplayName("should throw ValidationException for empty email")
        void shouldThrowForEmptyEmail() {
            LoginRequest loginReq = new LoginRequest("", TEST_PASSWORD);

            assertThrows(ValidationException.class, () ->
                    authService.authenticateUser(loginReq, request)
            );
        }

        @Test
        @DisplayName("should throw ValidationException for null password")
        void shouldThrowForNullPassword() {
            LoginRequest loginReq = new LoginRequest(TEST_EMAIL, null);

            assertThrows(ValidationException.class, () ->
                    authService.authenticateUser(loginReq, request)
            );
        }

        @Test
        @DisplayName("should throw ValidationException for invalid email format")
        void shouldThrowForInvalidEmailFormat() {
            LoginRequest loginReq = new LoginRequest("not-an-email", TEST_PASSWORD);

            assertThrows(ValidationException.class, () ->
                    authService.authenticateUser(loginReq, request)
            );
        }

        @Test
        @DisplayName("should throw ValidationException for whitespace-only email")
        void shouldThrowForWhitespaceEmail() {
            LoginRequest loginReq = new LoginRequest("   ", TEST_PASSWORD);

            assertThrows(ValidationException.class, () ->
                    authService.authenticateUser(loginReq, request)
            );
        }

        @Test
        @DisplayName("should throw ValidationException for whitespace-only password")
        void shouldThrowForWhitespacePassword() {
            LoginRequest loginReq = new LoginRequest(TEST_EMAIL, "   ");

            assertThrows(ValidationException.class, () ->
                    authService.authenticateUser(loginReq, request)
            );
        }

        @Test
        @DisplayName("timing attack resistance - should take similar time for existing and non-existing users")
        void shouldBeTimingAttackResistant() {
            when(userService.findUserByEmailOrNull(TEST_EMAIL)).thenReturn(testUser);
            when(userService.findUserByEmailOrNull("nonexistent@example.com")).thenReturn(null);

            // Run multiple iterations to get average time
            int iterations = 5;
            long existingUserTotalTime = 0;
            long nonExistingUserTotalTime = 0;

            for (int i = 0; i < iterations; i++) {
                // Time for existing user with wrong password
                long startExisting = System.nanoTime();
                assertThrows(ValidationException.class, () ->
                        authService.authenticateUser(new LoginRequest(TEST_EMAIL, "WrongPassword123!"), request));
                existingUserTotalTime += System.nanoTime() - startExisting;

                // Time for non-existing user
                long startNonExisting = System.nanoTime();
                assertThrows(ValidationException.class, () ->
                        authService.authenticateUser(new LoginRequest("nonexistent@example.com", "WrongPassword123!"), request));
                nonExistingUserTotalTime += System.nanoTime() - startNonExisting;
            }

            long avgExisting = existingUserTotalTime / iterations;
            long avgNonExisting = nonExistingUserTotalTime / iterations;

            // Times should be within 50% of each other (BCrypt hashing dominates)
            double ratio = (double) Math.max(avgExisting, avgNonExisting) / Math.min(avgExisting, avgNonExisting);
            assertTrue(ratio < 2.0, "Timing difference too large: ratio = " + ratio);
        }
    }

    @Nested
    @DisplayName("refreshAccessToken")
    class RefreshAccessTokenTests {

        @Test
        @DisplayName("should return new tokens for valid refresh token")
        void shouldReturnNewTokensForValidRefreshToken() {
            Cookie refreshCookie = new Cookie("refreshToken", "valid-refresh-token");
            when(request.getCookies()).thenReturn(new Cookie[]{refreshCookie});
            when(tokenService.validateRefreshToken("valid-refresh-token")).thenReturn(TEST_USER_ID);

            TokenService.AuthTokens mockTokens = new TokenService.AuthTokens(
                    ResponseCookie.from("accessToken", "new-access").build(),
                    ResponseCookie.from("refreshToken", "new-refresh").build()
            );
            when(tokenService.createAuthTokens(TEST_USER_ID)).thenReturn(mockTokens);

            var tokens = authService.refreshAccessToken(request);

            assertNotNull(tokens);
            assertNotNull(tokens.accessCookie());
            assertNotNull(tokens.refreshCookie());
        }

        @Test
        @DisplayName("should throw when refresh token cookie is missing")
        void shouldThrowWhenCookieMissing() {
            when(request.getCookies()).thenReturn(null);

            var ex = assertThrows(AuthorizationException.class, () ->
                    authService.refreshAccessToken(request));
            assertEquals("Refresh token not provided", ex.getMessage());
        }

        @Test
        @DisplayName("should throw when refresh token is invalid")
        void shouldThrowWhenTokenInvalid() {
            Cookie refreshCookie = new Cookie("refreshToken", "invalid-token");
            when(request.getCookies()).thenReturn(new Cookie[]{refreshCookie});
            when(tokenService.validateRefreshToken("invalid-token")).thenReturn(null);

            var ex = assertThrows(AuthorizationException.class, () ->
                    authService.refreshAccessToken(request));
            assertEquals("Invalid or expired refresh token", ex.getMessage());
        }

        @Test
        @DisplayName("should throw when no refreshToken cookie among multiple cookies")
        void shouldThrowWhenNoRefreshTokenCookie() {
            Cookie[] cookies = {
                    new Cookie("accessToken", "some-access-token"),
                    new Cookie("otherCookie", "other-value")
            };
            when(request.getCookies()).thenReturn(cookies);

            assertThrows(AuthorizationException.class, () ->
                    authService.refreshAccessToken(request));
        }

        @Test
        @DisplayName("should find refresh token among multiple cookies")
        void shouldFindRefreshTokenAmongMultipleCookies() {
            Cookie[] cookies = {
                    new Cookie("accessToken", "some-access-token"),
                    new Cookie("refreshToken", "valid-refresh-token"),
                    new Cookie("otherCookie", "other-value")
            };
            when(request.getCookies()).thenReturn(cookies);
            when(tokenService.validateRefreshToken("valid-refresh-token")).thenReturn(TEST_USER_ID);

            TokenService.AuthTokens mockTokens = new TokenService.AuthTokens(
                    ResponseCookie.from("accessToken", "new-access").build(),
                    ResponseCookie.from("refreshToken", "new-refresh").build()
            );
            when(tokenService.createAuthTokens(TEST_USER_ID)).thenReturn(mockTokens);

            var tokens = authService.refreshAccessToken(request);

            assertNotNull(tokens);
        }
    }

    @Nested
    @DisplayName("logoutUser")
    class LogoutUserTests {

        @Test
        @DisplayName("should revoke only the presented refresh token and delete cookies")
        void shouldRevokeTokensAndDeleteCookies() {
            var refreshCookie = new jakarta.servlet.http.Cookie("refreshToken", "device-token");
            when(request.getCookies()).thenReturn(new jakarta.servlet.http.Cookie[]{refreshCookie});

            authService.logoutUser(request, response);

            verify(tokenService).deleteRefreshToken("device-token"); // per-device, not all sessions
            verify(response).setHeader(eq(HttpHeaders.SET_COOKIE), contains("accessToken"));
            verify(response).addHeader(eq(HttpHeaders.SET_COOKIE), contains("refreshToken"));
        }

        @Test
        @DisplayName("should delete cookies even when no refresh token is present")
        void shouldDeleteCookiesWhenNoRefreshToken() {
            when(request.getCookies()).thenReturn(null);

            authService.logoutUser(request, response);

            verify(tokenService, never()).deleteRefreshToken(any());
            verify(response).setHeader(eq(HttpHeaders.SET_COOKIE), contains("accessToken"));
            verify(response).addHeader(eq(HttpHeaders.SET_COOKIE), contains("refreshToken"));
        }

        @Test
        @DisplayName("should set maxAge to 0 for deleted cookies")
        void shouldSetMaxAgeToZero() {
            authService.logoutUser(request, response);

            verify(response).setHeader(eq(HttpHeaders.SET_COOKIE), contains("Max-Age=0"));
            verify(response).addHeader(eq(HttpHeaders.SET_COOKIE), contains("Max-Age=0"));
        }
    }
}
