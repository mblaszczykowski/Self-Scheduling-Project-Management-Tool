package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.config.AppProperties;
import com.backend.config.CookieProperties;
import com.backend.config.PasswordEncoderConfig;
import com.backend.dtos.LoginResponse;
import com.backend.entities.User;
import com.backend.exception.UnauthenticatedException;
import com.backend.exception.TooManyAttemptsException;
import com.backend.exception.ValidationException;
import com.backend.requests.LoginRequest;
import com.backend.web.CookieFactory;
import jakarta.servlet.http.Cookie;
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
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    private static final String EMAIL = "user@example.com";
    private static final String OTHER_EMAIL = "someone.else@example.com";
    private static final String PASSWORD = "TestPassword123!";
    private static final String WRONG_PASSWORD = "WrongPassword123!";
    private static final Integer USER_ID = 42;
    private static final String CLIENT_IP = "203.0.113.7";
    private static final String OTHER_IP = "198.51.100.9";

    private static final String CREDENTIAL_ERROR = "Invalid email or password";
    private static final String THROTTLE_ERROR = "Too many login attempts. Please try again later.";

    @Mock
    private UserService userService;

    @Mock
    private TokenService tokenService;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    private BCryptPasswordEncoder passwordEncoder;
    private AuthService authService;
    private User user;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder(4);
        authService = authServiceWith(5, passwordEncoder);

        user = TestEntityFactory.createUser(USER_ID, EMAIL);
        user.setPassword(passwordEncoder.encode(PASSWORD));

        lenient().when(request.getRemoteAddr()).thenReturn(CLIENT_IP);
    }

    @Nested
    @DisplayName("authenticateUser: credentials")
    class Credentials {
        @Test
        @DisplayName("returns the signed-in user's details together with the cookies issued for that user")
        void returnsUserDetailsAndIssuedCookies() {
            when(userService.findUserByEmailOrNull(EMAIL)).thenReturn(user);
            var issued = authTokens("access-value", "refresh-value");
            when(tokenService.createAuthTokens(USER_ID)).thenReturn(issued);

            var result = authService.authenticateUser(new LoginRequest(EMAIL, PASSWORD), request);

            assertThat(result.body())
                    .isEqualTo(new LoginResponse("Login successful", USER_ID, EMAIL, "User 42"));
            assertThat(result.tokens()).isSameAs(issued);

            var userIdArg = ArgumentCaptor.forClass(Integer.class);
            verify(tokenService).createAuthTokens(userIdArg.capture());
            assertThat(userIdArg.getValue()).isEqualTo(USER_ID);
        }

        @Test
        @DisplayName("refuses a wrong password and issues no credentials")
        void refusesWrongPassword() {
            when(userService.findUserByEmailOrNull(EMAIL)).thenReturn(user);

            assertThatThrownBy(() -> authService.authenticateUser(
                    new LoginRequest(EMAIL, WRONG_PASSWORD), request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage(CREDENTIAL_ERROR);

            verifyNoInteractions(tokenService);
        }

        @Test
        @DisplayName("refuses an unknown email with the very same message, so accounts cannot be enumerated")
        void refusesUnknownEmailIndistinguishably() {
            when(userService.findUserByEmailOrNull(EMAIL)).thenReturn(user);
            when(userService.findUserByEmailOrNull(OTHER_EMAIL)).thenReturn(null);

            var wrongPassword = catchLoginFailure(authService, new LoginRequest(EMAIL, WRONG_PASSWORD), request);
            var unknownEmail = catchLoginFailure(authService, new LoginRequest(OTHER_EMAIL, PASSWORD), request);

            assertThat(wrongPassword).isInstanceOf(ValidationException.class);
            assertThat(unknownEmail).isInstanceOf(ValidationException.class);
            assertThat(unknownEmail.getMessage())
                    .isEqualTo(wrongPassword.getMessage())
                    .isEqualTo(CREDENTIAL_ERROR);
            verifyNoInteractions(tokenService);
        }

        @ParameterizedTest(name = "email=[{0}] password=[{1}]")
        @CsvSource(nullValues = "NULL", value = {
                "NULL, TestPassword123!",
                "'', TestPassword123!",
                "'   ', TestPassword123!",
                "user@example.com, NULL",
                "user@example.com, ''",
                "user@example.com, '   '"
        })
        @DisplayName("refuses a missing or blank credential before looking any account up")
        void refusesBlankCredentials(String email, String password) {
            assertThatThrownBy(() -> authService.authenticateUser(new LoginRequest(email, password), request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Email and password are required");

            verifyNoInteractions(userService, tokenService);
        }

        @ParameterizedTest(name = "email=[{0}]")
        @ValueSource(strings = {"not-an-email", "user@", "@example.com", "user@example", "a..b@example.com"})
        @DisplayName("refuses a malformed email before looking any account up")
        void refusesMalformedEmail(String email) {
            assertThatThrownBy(() -> authService.authenticateUser(new LoginRequest(email, PASSWORD), request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Invalid email format");

            verifyNoInteractions(userService, tokenService);
        }
    }

    @Nested
    @DisplayName("authenticateUser: timing-attack resistance")
    class TimingAttackResistance {
        private static final BCryptPasswordEncoder PRODUCTION_ENCODER =
                new PasswordEncoderConfig().passwordEncoder();

        @Test
        @DisplayName("still runs a bcrypt comparison, at the application's own cost factor, when the email is unknown")
        void hashesAgainstDummyHashForUnknownEmail() {
            var encoder = mock(BCryptPasswordEncoder.class);
            when(encoder.matches(anyString(), anyString())).thenReturn(false);
            when(userService.findUserByEmailOrNull(OTHER_EMAIL)).thenReturn(null);
            var service = new AuthService(userService, tokenService, rateLimiter(5), encoder);

            assertThatThrownBy(() -> service.authenticateUser(
                    new LoginRequest(OTHER_EMAIL, PASSWORD), request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage(CREDENTIAL_ERROR);

            var raw = ArgumentCaptor.forClass(String.class);
            var hash = ArgumentCaptor.forClass(String.class);
            verify(encoder).matches(raw.capture(), hash.capture());
            assertThat(raw.getValue()).isEqualTo(PASSWORD);
            assertThat(hash.getValue())
                    .hasSize(60)
                    .startsWith(costPrefix(PRODUCTION_ENCODER.encode(PASSWORD)));
        }

        @Test
        @DisplayName("rejects a wrong password and an unknown email in comparable time")
        void takesComparableTimeForBothFailures() {
            var realUser = TestEntityFactory.createUser(USER_ID, EMAIL);
            realUser.setPassword(PRODUCTION_ENCODER.encode(PASSWORD));
            when(userService.findUserByEmailOrNull(EMAIL)).thenReturn(realUser);
            when(userService.findUserByEmailOrNull(OTHER_EMAIL)).thenReturn(null);
            var service = new AuthService(userService, tokenService, rateLimiter(1_000),
                    PRODUCTION_ENCODER);

            var wrongPassword = new LoginRequest(EMAIL, WRONG_PASSWORD);
            var unknownEmail = new LoginRequest(OTHER_EMAIL, WRONG_PASSWORD);
            timeFailure(service, wrongPassword);
            timeFailure(service, unknownEmail);

            var samples = 3;
            var wrongPasswordTimes = new long[samples];
            var unknownEmailTimes = new long[samples];
            for (int i = 0; i < samples; i++) {
                wrongPasswordTimes[i] = timeFailure(service, wrongPassword);
                unknownEmailTimes[i] = timeFailure(service, unknownEmail);
            }

            double slower = Math.max(median(wrongPasswordTimes), median(unknownEmailTimes));
            double faster = Math.min(median(wrongPasswordTimes), median(unknownEmailTimes));
            assertThat(slower / faster)
                    .as("median time for a wrong password vs an unknown email")
                    .isLessThan(2.0);
        }

        private long timeFailure(AuthService service, LoginRequest login) {
            var start = System.nanoTime();
            assertThat(catchLoginFailure(service, login, request)).isInstanceOf(ValidationException.class);
            return System.nanoTime() - start;
        }

        private static double median(long[] samples) {
            var sorted = samples.clone();
            Arrays.sort(sorted);
            return sorted[sorted.length / 2];
        }

        private static String costPrefix(String bcryptHash) {
            return bcryptHash.substring(0, bcryptHash.indexOf('$', 4) + 1);
        }
    }

    @Nested
    @DisplayName("authenticateUser: rate limiting")
    class RateLimiting {
        private static final int LIMIT = 3;

        private AuthService throttled;

        @BeforeEach
        void useATightLimit() {
            throttled = authServiceWith(LIMIT, passwordEncoder);
        }

        @Test
        @DisplayName("throttles further attempts once the limit for one (client, email) pair is used up")
        void throttlesAfterTheConfiguredNumberOfAttempts() {
            when(userService.findUserByEmailOrNull(EMAIL)).thenReturn(user);
            var wrongPassword = new LoginRequest(EMAIL, WRONG_PASSWORD);

            exhaust(wrongPassword, request);

            assertThatThrownBy(() -> throttled.authenticateUser(wrongPassword, request))
                    .isInstanceOf(TooManyAttemptsException.class)
                    .hasMessage(THROTTLE_ERROR);
            verify(userService, times(LIMIT)).findUserByEmailOrNull(EMAIL);
        }

        @Test
        @DisplayName("keys the limit by email too, so flooding one account leaves the others usable from that client")
        void oneFloodedAccountDoesNotBlockAnother() {
            when(userService.findUserByEmailOrNull(EMAIL)).thenReturn(user);
            when(userService.findUserByEmailOrNull(OTHER_EMAIL)).thenReturn(null);

            exhaust(new LoginRequest(EMAIL, WRONG_PASSWORD), request);

            assertThat(catchLoginFailure(throttled, new LoginRequest(OTHER_EMAIL, WRONG_PASSWORD), request))
                    .as("a different account from the same client must still be evaluated")
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("keys the limit by client too, so one flooded address cannot lock the account out everywhere")
        void oneFloodedClientDoesNotLockTheAccountOut() {
            when(userService.findUserByEmailOrNull(EMAIL)).thenReturn(user);
            var attacker = requestFrom(OTHER_IP);
            var wrongPassword = new LoginRequest(EMAIL, WRONG_PASSWORD);

            exhaust(wrongPassword, attacker);
            assertThat(catchLoginFailure(throttled, wrongPassword, attacker))
                    .isInstanceOf(TooManyAttemptsException.class);

            assertThat(catchLoginFailure(throttled, wrongPassword, request))
                    .as("the legitimate client must still be evaluated")
                    .isInstanceOf(ValidationException.class);
        }

        @Test
        @DisplayName("a successful login clears the counter for that (client, email) pair only")
        void successResetsOnlyItsOwnCounter() {
            when(userService.findUserByEmailOrNull(EMAIL)).thenReturn(user);
            when(tokenService.createAuthTokens(USER_ID)).thenReturn(authTokens("access", "refresh"));
            var attacker = requestFrom(OTHER_IP);
            var wrongPassword = new LoginRequest(EMAIL, WRONG_PASSWORD);

            exhaust(wrongPassword, attacker);
            assertThat(catchLoginFailure(throttled, wrongPassword, attacker))
                    .isInstanceOf(TooManyAttemptsException.class);

            assertThat(catchLoginFailure(throttled, wrongPassword, request)).isInstanceOf(ValidationException.class);
            assertThat(catchLoginFailure(throttled, wrongPassword, request)).isInstanceOf(ValidationException.class);
            assertThat(throttled.authenticateUser(new LoginRequest(EMAIL, PASSWORD), request)).isNotNull();

            exhaust(wrongPassword, request);
            assertThat(catchLoginFailure(throttled, wrongPassword, attacker))
                    .as("the reset must not clear another client's counter")
                    .isInstanceOf(TooManyAttemptsException.class);
        }

        private void exhaust(LoginRequest login, HttpServletRequest from) {
            for (int attempt = 1; attempt <= LIMIT; attempt++) {
                assertThat(catchLoginFailure(throttled, login, from))
                        .as("attempt %d must be evaluated, not throttled", attempt)
                        .isInstanceOf(ValidationException.class);
            }
        }
    }

    @Nested
    @DisplayName("refreshAccessToken")
    class RefreshAccessToken {
        @Test
        @DisplayName("rotates the presented refresh token and re-issues both cookies for the rotated one")
        void rotatesAndReissuesCookies() {
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie("refreshToken", "presented")});
            when(tokenService.rotateRefreshToken("presented"))
                    .thenReturn(TokenService.RotationResult.rotated(USER_ID, "rotated"));
            var reissued = authTokens("new-access", "rotated");
            when(tokenService.buildCookies(USER_ID, "rotated")).thenReturn(reissued);

            assertThat(authService.refreshAccessToken(request)).isSameAs(reissued);

            var userId = ArgumentCaptor.forClass(Integer.class);
            var refreshValue = ArgumentCaptor.forClass(String.class);
            verify(tokenService).buildCookies(userId.capture(), refreshValue.capture());
            assertThat(userId.getValue()).isEqualTo(USER_ID);
            assertThat(refreshValue.getValue())
                    .as("the new cookie must carry the rotated token, not the one just consumed")
                    .isEqualTo("rotated")
                    .isNotEqualTo("presented");
        }

        @Test
        @DisplayName("picks the refreshToken cookie out from among the other cookies")
        void findsTheRefreshCookieAmongOthers() {
            when(request.getCookies()).thenReturn(new Cookie[]{
                    new Cookie("accessToken", "some-access-token"),
                    new Cookie("refreshToken", "the-refresh-token"),
                    new Cookie("otherCookie", "other-value")
            });
            when(tokenService.rotateRefreshToken("the-refresh-token"))
                    .thenReturn(TokenService.RotationResult.rotated(USER_ID, "rotated"));
            when(tokenService.buildCookies(USER_ID, "rotated")).thenReturn(authTokens("a", "rotated"));

            assertThat(authService.refreshAccessToken(request)).isNotNull();

            var presented = ArgumentCaptor.forClass(String.class);
            verify(tokenService).rotateRefreshToken(presented.capture());
            assertThat(presented.getValue()).isEqualTo("the-refresh-token");
        }

        @Test
        @DisplayName("turns a failed rotation into a 401 that carries the rotation's own reason")
        void failedRotationBecomesUnauthenticated() {
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie("refreshToken", "stale")});
            when(tokenService.rotateRefreshToken("stale"))
                    .thenReturn(TokenService.RotationResult.failed("Session expired. Please sign in again."));

            assertThatThrownBy(() -> authService.refreshAccessToken(request))
                    .isInstanceOf(UnauthenticatedException.class)
                    .hasMessage("Session expired. Please sign in again.");

            verify(tokenService, never()).buildCookies(any(), any());
        }

        @Test
        @DisplayName("does not attempt a rotation when the request carries no cookies at all")
        void refusesWithoutARefreshCookie() {
            when(request.getCookies()).thenReturn(null);

            assertThatThrownBy(() -> authService.refreshAccessToken(request))
                    .isInstanceOf(UnauthenticatedException.class)
                    .hasMessage("Refresh token not provided");

            verifyNoInteractions(tokenService);
        }

        @Test
        @DisplayName("does not attempt a rotation when only other cookies were sent")
        void refusesWhenOnlyOtherCookiesArePresent() {
            when(request.getCookies()).thenReturn(new Cookie[]{
                    new Cookie("accessToken", "some-access-token"),
                    new Cookie("otherCookie", "other-value")
            });

            assertThatThrownBy(() -> authService.refreshAccessToken(request))
                    .isInstanceOf(UnauthenticatedException.class)
                    .hasMessage("Refresh token not provided");

            verifyNoInteractions(tokenService);
        }
    }

    @Nested
    @DisplayName("logoutUser")
    class LogoutUser {
        @Test
        @DisplayName("revokes the presented refresh token and sends both deletion cookies")
        void revokesThisDeviceAndClearsCookies() {
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie("refreshToken", "device-token")});
            stubDeletionCookies();

            authService.logoutUser(request, response);

            var revoked = ArgumentCaptor.forClass(String.class);
            verify(tokenService).revokeRefreshToken(revoked.capture());
            assertThat(revoked.getValue()).isEqualTo("device-token");
            verify(tokenService, never()).revokeAllSessionsForUser(any());

            assertThat(setCookieHeaders())
                    .anySatisfy(header -> assertThat(header).contains("accessToken=").contains("Max-Age=0"))
                    .anySatisfy(header -> assertThat(header).contains("refreshToken=").contains("Max-Age=0"));
        }

        @Test
        @DisplayName("adds each deletion cookie as its own header, so neither overwrites the other")
        void addsBothCookiesAsSeparateHeaders() {
            when(request.getCookies()).thenReturn(new Cookie[]{new Cookie("refreshToken", "device-token")});
            stubDeletionCookies();

            authService.logoutUser(request, response);

            assertThat(setCookieHeaders()).hasSize(2);
            verify(response, never()).setHeader(anyString(), anyString());
        }

        @Test
        @DisplayName("still clears the cookies when the request carried no refresh token")
        void clearsCookiesWithoutARefreshToken() {
            when(request.getCookies()).thenReturn(null);
            stubDeletionCookies();

            authService.logoutUser(request, response);

            verify(tokenService, never()).revokeRefreshToken(any());
            assertThat(setCookieHeaders()).hasSize(2);
        }

        private void stubDeletionCookies() {
            var cookieFactory = new CookieFactory(cookieProperties());
            when(tokenService.accessCookieDeletion()).thenReturn(cookieFactory.deletion("accessToken", true));
            when(tokenService.refreshCookieDeletion()).thenReturn(cookieFactory.deletion("refreshToken", true));
        }

        private List<String> setCookieHeaders() {
            var headers = ArgumentCaptor.forClass(String.class);
            verify(response, times(2)).addHeader(eq(HttpHeaders.SET_COOKIE), headers.capture());
            return headers.getAllValues();
        }
    }

    private AuthService authServiceWith(int loginLimit, BCryptPasswordEncoder encoder) {
        return new AuthService(userService, tokenService, rateLimiter(loginLimit), encoder);
    }

    private static RateLimitService rateLimiter(int loginLimit) {
        var appProperties = new AppProperties();
        appProperties.getRateLimit().setLogin(loginLimit);
        return new RateLimitService(appProperties);
    }

    private static CookieProperties cookieProperties() {
        var cookieProperties = new CookieProperties();
        cookieProperties.setSecure(false);
        cookieProperties.setSameSite("Strict");
        return cookieProperties;
    }

    private static TokenService.AuthTokens authTokens(String accessValue, String refreshValue) {
        var cookieFactory = new CookieFactory(cookieProperties());
        return new TokenService.AuthTokens(
                cookieFactory.build("accessToken", accessValue, Duration.ofMinutes(15), true),
                cookieFactory.build("refreshToken", refreshValue, Duration.ofDays(7), true));
    }

    private static Throwable catchLoginFailure(AuthService service, LoginRequest login,
                                               HttpServletRequest from) {
        try {
            service.authenticateUser(login, from);
            throw new AssertionError("expected the login to be refused, but it succeeded");
        } catch (RuntimeException expected) {
            return expected;
        }
    }

    private static HttpServletRequest requestFrom(String clientIp) {
        var other = mock(HttpServletRequest.class);
        when(other.getRemoteAddr()).thenReturn(clientIp);
        return other;
    }
}
