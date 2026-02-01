package com.backend.services;

import com.backend.entities.User;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserService userService;

    @Mock
    private TokenService tokenService;

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
        authService = new AuthService(userService, tokenService, false, "Strict");
        passwordEncoder = new BCryptPasswordEncoder(12);

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

            LoginRequest request = new LoginRequest(TEST_EMAIL, TEST_PASSWORD);
            ResponseEntity<?> response = authService.authenticateUser(request);

            assertEquals(HttpStatus.OK, response.getStatusCode());
            assertTrue(response.getHeaders().containsKey(HttpHeaders.SET_COOKIE));

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertNotNull(body);
            assertEquals("Login successful", body.get("message"));
            assertEquals(TEST_USER_ID, body.get("userId"));
        }

        @Test
        @DisplayName("should return bad request for invalid password")
        void shouldReturnBadRequestForInvalidPassword() {
            when(userService.findUserByEmailOrNull(TEST_EMAIL)).thenReturn(testUser);

            LoginRequest request = new LoginRequest(TEST_EMAIL, "WrongPassword123!");
            ResponseEntity<?> response = authService.authenticateUser(request);

            assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertNotNull(body);
            assertEquals("Invalid email or password", body.get("error"));
        }

        @Test
        @DisplayName("should return bad request for non-existent user without revealing user existence")
        void shouldReturnBadRequestForNonExistentUser() {
            when(userService.findUserByEmailOrNull("nonexistent@example.com")).thenReturn(null);

            LoginRequest request = new LoginRequest("nonexistent@example.com", TEST_PASSWORD);
            ResponseEntity<?> response = authService.authenticateUser(request);

            assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertNotNull(body);
            assertEquals("Invalid email or password", body.get("error"));
        }

        @Test
        @DisplayName("should throw ValidationException for empty email")
        void shouldThrowForEmptyEmail() {
            LoginRequest request = new LoginRequest("", TEST_PASSWORD);

            assertThrows(ValidationException.class, () ->
                    authService.authenticateUser(request)
            );
        }

        @Test
        @DisplayName("should throw ValidationException for null password")
        void shouldThrowForNullPassword() {
            LoginRequest request = new LoginRequest(TEST_EMAIL, null);

            assertThrows(ValidationException.class, () ->
                    authService.authenticateUser(request)
            );
        }

        @Test
        @DisplayName("should throw ValidationException for invalid email format")
        void shouldThrowForInvalidEmailFormat() {
            LoginRequest request = new LoginRequest("not-an-email", TEST_PASSWORD);

            assertThrows(ValidationException.class, () ->
                    authService.authenticateUser(request)
            );
        }

        @Test
        @DisplayName("should throw ValidationException for whitespace-only email")
        void shouldThrowForWhitespaceEmail() {
            LoginRequest request = new LoginRequest("   ", TEST_PASSWORD);

            assertThrows(ValidationException.class, () ->
                    authService.authenticateUser(request)
            );
        }

        @Test
        @DisplayName("should throw ValidationException for whitespace-only password")
        void shouldThrowForWhitespacePassword() {
            LoginRequest request = new LoginRequest(TEST_EMAIL, "   ");

            assertThrows(ValidationException.class, () ->
                    authService.authenticateUser(request)
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
                authService.authenticateUser(new LoginRequest(TEST_EMAIL, "WrongPassword123!"));
                existingUserTotalTime += System.nanoTime() - startExisting;

                // Time for non-existing user
                long startNonExisting = System.nanoTime();
                authService.authenticateUser(new LoginRequest("nonexistent@example.com", "WrongPassword123!"));
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

            ResponseEntity<?> response = authService.refreshAccessToken(request);

            assertEquals(HttpStatus.OK, response.getStatusCode());
            assertTrue(response.getHeaders().containsKey(HttpHeaders.SET_COOKIE));
        }

        @Test
        @DisplayName("should return 401 when refresh token cookie is missing")
        void shouldReturn401WhenCookieMissing() {
            when(request.getCookies()).thenReturn(null);

            ResponseEntity<?> response = authService.refreshAccessToken(request);

            assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertNotNull(body);
            assertEquals("Refresh token not provided", body.get("error"));
        }

        @Test
        @DisplayName("should return 401 when refresh token is invalid")
        void shouldReturn401WhenTokenInvalid() {
            Cookie refreshCookie = new Cookie("refreshToken", "invalid-token");
            when(request.getCookies()).thenReturn(new Cookie[]{refreshCookie});
            when(tokenService.validateRefreshToken("invalid-token")).thenReturn(null);

            ResponseEntity<?> response = authService.refreshAccessToken(request);

            assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertNotNull(body);
            assertEquals("Invalid or expired refresh token", body.get("error"));
        }

        @Test
        @DisplayName("should return 401 when no refreshToken cookie among multiple cookies")
        void shouldReturn401WhenNoRefreshTokenCookie() {
            Cookie[] cookies = {
                    new Cookie("accessToken", "some-access-token"),
                    new Cookie("otherCookie", "other-value")
            };
            when(request.getCookies()).thenReturn(cookies);

            ResponseEntity<?> response = authService.refreshAccessToken(request);

            assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
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

            ResponseEntity<?> response = authService.refreshAccessToken(request);

            assertEquals(HttpStatus.OK, response.getStatusCode());
        }
    }

    @Nested
    @DisplayName("logoutUser")
    class LogoutUserTests {

        @Test
        @DisplayName("should revoke tokens and delete cookies")
        void shouldRevokeTokensAndDeleteCookies() {
            when(request.getAttribute("userId")).thenReturn(TEST_USER_ID);

            authService.logoutUser(request, response);

            verify(tokenService).revokeRefreshToken(TEST_USER_ID);
            verify(response).setHeader(eq(HttpHeaders.SET_COOKIE), contains("accessToken"));
            verify(response).addHeader(eq(HttpHeaders.SET_COOKIE), contains("refreshToken"));
        }

        @Test
        @DisplayName("should delete cookies even when userId is null")
        void shouldDeleteCookiesWhenUserIdNull() {
            when(request.getAttribute("userId")).thenReturn(null);

            authService.logoutUser(request, response);

            verify(tokenService, never()).revokeRefreshToken(anyInt());
            verify(response).setHeader(eq(HttpHeaders.SET_COOKIE), contains("accessToken"));
            verify(response).addHeader(eq(HttpHeaders.SET_COOKIE), contains("refreshToken"));
        }

        @Test
        @DisplayName("should set maxAge to 0 for deleted cookies")
        void shouldSetMaxAgeToZero() {
            when(request.getAttribute("userId")).thenReturn(TEST_USER_ID);

            authService.logoutUser(request, response);

            verify(response).setHeader(eq(HttpHeaders.SET_COOKIE), contains("Max-Age=0"));
            verify(response).addHeader(eq(HttpHeaders.SET_COOKIE), contains("Max-Age=0"));
        }
    }
}
