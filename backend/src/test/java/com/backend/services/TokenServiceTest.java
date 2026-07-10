package com.backend.services;

import com.backend.config.CookieProperties;
import com.backend.entities.RefreshToken;
import com.backend.exception.AuthorizationException;
import com.backend.repositories.RefreshTokenRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenServiceTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private HttpServletRequest request;

    private TokenService tokenService;
    private SecretKey secretKey;

    private static final Duration ACCESS_TOKEN_EXPIRATION = Duration.ofMinutes(15);
    private static final Duration REFRESH_TOKEN_EXPIRATION = Duration.ofDays(7);
    private static final Integer TEST_USER_ID = 123;

    @BeforeEach
    void setUp() throws Exception {
        String secret = "test-secret-key-that-is-at-least-32-characters-long";
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(secret.getBytes(StandardCharsets.UTF_8));
        secretKey = new SecretKeySpec(hash, "HmacSHA256");

        CookieProperties cookieProperties = new CookieProperties();
        cookieProperties.setSecure(false);
        cookieProperties.setSameSite("Strict");

        tokenService = new TokenService(
                secretKey,
                ACCESS_TOKEN_EXPIRATION,
                REFRESH_TOKEN_EXPIRATION,
                refreshTokenRepository,
                new com.backend.util.CookieFactory(cookieProperties)
        );
    }

    @Nested
    @DisplayName("generateAccessToken")
    class GenerateAccessTokenTests {

        @Test
        @DisplayName("should generate valid JWT with correct claims")
        void shouldGenerateValidJwtWithCorrectClaims() {
            String token = tokenService.generateAccessToken(TEST_USER_ID);

            assertNotNull(token);

            var claims = Jwts.parserBuilder()
                    .setSigningKey(secretKey)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            assertEquals(String.valueOf(TEST_USER_ID), claims.getSubject());
            assertEquals("access", claims.get("type", String.class));
            assertNotNull(claims.getIssuedAt());
            assertNotNull(claims.getExpiration());
        }

        @Test
        @DisplayName("should set expiration to 15 minutes from now")
        void shouldSetCorrectExpiration() {
            Instant before = Instant.now();
            String token = tokenService.generateAccessToken(TEST_USER_ID);
            Instant after = Instant.now();

            var claims = Jwts.parserBuilder()
                    .setSigningKey(secretKey)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            Instant expiration = claims.getExpiration().toInstant();
            Instant expectedMin = before.plus(ACCESS_TOKEN_EXPIRATION).minusSeconds(1);
            Instant expectedMax = after.plus(ACCESS_TOKEN_EXPIRATION).plusSeconds(1);

            assertTrue(expiration.isAfter(expectedMin) && expiration.isBefore(expectedMax));
        }
    }

    @Nested
    @DisplayName("generateRefreshToken")
    class GenerateRefreshTokenTests {

        @Test
        @DisplayName("should NOT delete the user's other tokens (multi-device sessions)")
        void shouldNotDeleteOtherTokens() {
            tokenService.generateRefreshToken(TEST_USER_ID);

            verify(refreshTokenRepository, never()).deleteByUserId(TEST_USER_ID);
            verify(refreshTokenRepository).save(any(RefreshToken.class));
        }

        @Test
        @DisplayName("should save new refresh token to database")
        void shouldSaveRefreshToken() {
            String token = tokenService.generateRefreshToken(TEST_USER_ID);

            assertNotNull(token);

            ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
            verify(refreshTokenRepository).save(captor.capture());

            RefreshToken saved = captor.getValue();
            assertEquals(TEST_USER_ID, saved.getUserId());
            assertEquals(token, saved.getToken());
            assertTrue(saved.getExpiryDate().isAfter(Instant.now()));
        }

        @Test
        @DisplayName("should generate UUID format token")
        void shouldGenerateUuidToken() {
            String token = tokenService.generateRefreshToken(TEST_USER_ID);

            assertNotNull(token);
            assertTrue(token.matches("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"));
        }
    }

    @Nested
    @DisplayName("validateTokenAndGetUserId")
    class ValidateTokenTests {

        @Test
        @DisplayName("should return user ID for valid token")
        void shouldReturnUserIdForValidToken() {
            String token = tokenService.generateAccessToken(TEST_USER_ID);

            Integer result = tokenService.validateTokenAndGetUserId(token);

            assertEquals(TEST_USER_ID, result);
        }

        @Test
        @DisplayName("should return null for expired token")
        void shouldReturnNullForExpiredToken() {
            String expiredToken = Jwts.builder()
                    .setSubject(String.valueOf(TEST_USER_ID))
                    .setIssuedAt(new Date(System.currentTimeMillis() - 3600000))
                    .setExpiration(new Date(System.currentTimeMillis() - 1800000))
                    .claim("type", "access")
                    .signWith(secretKey, SignatureAlgorithm.HS256)
                    .compact();

            Integer result = tokenService.validateTokenAndGetUserId(expiredToken);

            assertNull(result);
        }

        @Test
        @DisplayName("should return null for token with wrong signature")
        void shouldReturnNullForWrongSignature() throws Exception {
            SecretKey wrongKey = new SecretKeySpec(
                    MessageDigest.getInstance("SHA-256")
                            .digest("wrong-key-at-least-32-characters".getBytes(StandardCharsets.UTF_8)),
                    "HmacSHA256"
            );

            String tokenWithWrongKey = Jwts.builder()
                    .setSubject(String.valueOf(TEST_USER_ID))
                    .setIssuedAt(new Date())
                    .setExpiration(new Date(System.currentTimeMillis() + 900000))
                    .claim("type", "access")
                    .signWith(wrongKey, SignatureAlgorithm.HS256)
                    .compact();

            Integer result = tokenService.validateTokenAndGetUserId(tokenWithWrongKey);

            assertNull(result);
        }

        @Test
        @DisplayName("should return null for token with refresh type")
        void shouldReturnNullForRefreshTokenType() {
            String refreshTypeToken = Jwts.builder()
                    .setSubject(String.valueOf(TEST_USER_ID))
                    .setIssuedAt(new Date())
                    .setExpiration(new Date(System.currentTimeMillis() + 900000))
                    .claim("type", "refresh")
                    .signWith(secretKey, SignatureAlgorithm.HS256)
                    .compact();

            Integer result = tokenService.validateTokenAndGetUserId(refreshTypeToken);

            assertNull(result);
        }

        @Test
        @DisplayName("should return null for token without type claim")
        void shouldReturnNullForMissingTypeClaim() {
            String tokenWithoutType = Jwts.builder()
                    .setSubject(String.valueOf(TEST_USER_ID))
                    .setIssuedAt(new Date())
                    .setExpiration(new Date(System.currentTimeMillis() + 900000))
                    .signWith(secretKey, SignatureAlgorithm.HS256)
                    .compact();

            Integer result = tokenService.validateTokenAndGetUserId(tokenWithoutType);

            assertNull(result);
        }

        @Test
        @DisplayName("should return null for malformed token")
        void shouldReturnNullForMalformedToken() {
            Integer result = tokenService.validateTokenAndGetUserId("not.a.valid.token");

            assertNull(result);
        }

        @Test
        @DisplayName("should return null for empty token")
        void shouldReturnNullForEmptyToken() {
            Integer result = tokenService.validateTokenAndGetUserId("");

            assertNull(result);
        }

        @Test
        @DisplayName("should return null for token with non-integer subject")
        void shouldReturnNullForNonIntegerSubject() {
            String tokenWithStringSubject = Jwts.builder()
                    .setSubject("not-an-integer")
                    .setIssuedAt(new Date())
                    .setExpiration(new Date(System.currentTimeMillis() + 900000))
                    .claim("type", "access")
                    .signWith(secretKey, SignatureAlgorithm.HS256)
                    .compact();

            Integer result = tokenService.validateTokenAndGetUserId(tokenWithStringSubject);

            assertNull(result);
        }
    }

    @Nested
    @DisplayName("validateRefreshToken")
    class ValidateRefreshTokenTests {

        @Test
        @DisplayName("should return user ID for valid refresh token")
        void shouldReturnUserIdForValidToken() {
            RefreshToken refreshToken = new RefreshToken();
            refreshToken.setToken("valid-token");
            refreshToken.setUserId(TEST_USER_ID);
            refreshToken.setExpiryDate(Instant.now().plusSeconds(3600));

            when(refreshTokenRepository.findByToken("valid-token"))
                    .thenReturn(Optional.of(refreshToken));

            Integer result = tokenService.validateRefreshToken("valid-token");

            assertEquals(TEST_USER_ID, result);
        }

        @Test
        @DisplayName("should return null for non-existent token")
        void shouldReturnNullForNonExistentToken() {
            when(refreshTokenRepository.findByToken("non-existent"))
                    .thenReturn(Optional.empty());

            Integer result = tokenService.validateRefreshToken("non-existent");

            assertNull(result);
        }

        @Test
        @DisplayName("should return null and delete expired token")
        void shouldReturnNullAndDeleteExpiredToken() {
            RefreshToken expiredToken = new RefreshToken();
            expiredToken.setToken("expired-token");
            expiredToken.setUserId(TEST_USER_ID);
            expiredToken.setExpiryDate(Instant.now().minusSeconds(3600));

            when(refreshTokenRepository.findByToken("expired-token"))
                    .thenReturn(Optional.of(expiredToken));

            Integer result = tokenService.validateRefreshToken("expired-token");

            assertNull(result);
            verify(refreshTokenRepository).delete(expiredToken);
        }
    }

    @Nested
    @DisplayName("extractTokenFromRequest")
    class ExtractTokenFromRequestTests {

        @Test
        @DisplayName("should extract token from accessToken cookie")
        void shouldExtractFromCookie() {
            Cookie accessTokenCookie = new Cookie("accessToken", "token-from-cookie");
            when(request.getCookies()).thenReturn(new Cookie[]{accessTokenCookie});

            String result = tokenService.extractTokenFromRequest(request);

            assertEquals("token-from-cookie", result);
        }

        @Test
        @DisplayName("should extract token from Bearer header when no cookie")
        void shouldExtractFromBearerHeader() {
            when(request.getCookies()).thenReturn(null);
            when(request.getHeader("Authorization")).thenReturn("Bearer token-from-header");

            String result = tokenService.extractTokenFromRequest(request);

            assertEquals("token-from-header", result);
        }

        @Test
        @DisplayName("should prefer cookie over Bearer header")
        void shouldPreferCookieOverHeader() {
            Cookie accessTokenCookie = new Cookie("accessToken", "cookie-token");
            when(request.getCookies()).thenReturn(new Cookie[]{accessTokenCookie});
            // Note: Authorization header is not stubbed because code returns early when cookie is found

            String result = tokenService.extractTokenFromRequest(request);

            assertEquals("cookie-token", result);
        }

        @Test
        @DisplayName("should return null when no token present")
        void shouldReturnNullWhenNoToken() {
            when(request.getCookies()).thenReturn(new Cookie[]{});
            when(request.getHeader("Authorization")).thenReturn(null);

            String result = tokenService.extractTokenFromRequest(request);

            assertNull(result);
        }

        @Test
        @DisplayName("should return null for Authorization header without Bearer prefix")
        void shouldReturnNullForNonBearerHeader() {
            when(request.getCookies()).thenReturn(null);
            when(request.getHeader("Authorization")).thenReturn("Basic sometoken");

            String result = tokenService.extractTokenFromRequest(request);

            assertNull(result);
        }

        @Test
        @DisplayName("should find accessToken among multiple cookies")
        void shouldFindAccessTokenAmongMultipleCookies() {
            Cookie[] cookies = {
                    new Cookie("otherCookie", "other-value"),
                    new Cookie("accessToken", "correct-token"),
                    new Cookie("refreshToken", "refresh-value")
            };
            when(request.getCookies()).thenReturn(cookies);

            String result = tokenService.extractTokenFromRequest(request);

            assertEquals("correct-token", result);
        }
    }

    @Nested
    @DisplayName("getUserIdFromRequest")
    class GetUserIdFromRequestTests {

        @Test
        @DisplayName("should return userId from request attribute")
        void shouldReturnUserIdFromAttribute() {
            when(request.getAttribute("userId")).thenReturn(TEST_USER_ID);

            Integer result = tokenService.getUserIdFromRequest(request);

            assertEquals(TEST_USER_ID, result);
        }

        @Test
        @DisplayName("should throw AuthorizationException when userId not set")
        void shouldThrowWhenUserIdNotSet() {
            when(request.getAttribute("userId")).thenReturn(null);

            assertThrows(AuthorizationException.class, () ->
                    tokenService.getUserIdFromRequest(request)
            );
        }
    }

    @Nested
    @DisplayName("createAuthTokens")
    class CreateAuthTokensTests {

        @Test
        @DisplayName("should create both access and refresh cookies")
        void shouldCreateBothCookies() {
            TokenService.AuthTokens tokens = tokenService.createAuthTokens(TEST_USER_ID);

            assertNotNull(tokens.accessCookie());
            assertNotNull(tokens.refreshCookie());
            assertEquals("accessToken", tokens.accessCookie().getName());
            assertEquals("refreshToken", tokens.refreshCookie().getName());
        }

        @Test
        @DisplayName("should set httpOnly flag on cookies")
        void shouldSetHttpOnlyFlag() {
            TokenService.AuthTokens tokens = tokenService.createAuthTokens(TEST_USER_ID);

            assertTrue(tokens.accessCookie().isHttpOnly());
            assertTrue(tokens.refreshCookie().isHttpOnly());
        }

        @Test
        @DisplayName("should set correct sameSite attribute")
        void shouldSetSameSiteAttribute() {
            TokenService.AuthTokens tokens = tokenService.createAuthTokens(TEST_USER_ID);

            assertTrue(tokens.accessCookie().toString().contains("SameSite=Strict"));
            assertTrue(tokens.refreshCookie().toString().contains("SameSite=Strict"));
        }
    }

    @Nested
    @DisplayName("deleteRefreshToken")
    class DeleteRefreshTokenTests {

        @Test
        @DisplayName("should delete only the presented refresh token")
        void shouldDeletePresentedToken() {
            var rt = new RefreshToken();
            rt.setToken("device-token");
            when(refreshTokenRepository.findByToken("device-token")).thenReturn(Optional.of(rt));

            tokenService.deleteRefreshToken("device-token");

            verify(refreshTokenRepository).delete(rt);
        }

        @Test
        @DisplayName("should be a no-op for an unknown token")
        void shouldIgnoreUnknownToken() {
            when(refreshTokenRepository.findByToken("unknown")).thenReturn(Optional.empty());

            tokenService.deleteRefreshToken("unknown");

            verify(refreshTokenRepository, never()).delete(any(RefreshToken.class));
        }
    }

    @Nested
    @DisplayName("cleanupExpiredTokens")
    class CleanupExpiredTokensTests {

        @Test
        @DisplayName("should delete tokens with expiry date before now")
        void shouldDeleteExpiredTokens() {
            tokenService.cleanupExpiredTokens();

            verify(refreshTokenRepository).deleteByExpiryDateBefore(any(Instant.class));
        }
    }
}