package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.config.AppProperties;
import com.backend.config.JwtProperties;
import com.backend.entities.RefreshToken;
import com.backend.repositories.RefreshTokenRepository;
import com.backend.repositories.UserRepository;
import com.backend.web.CookieFactory;
import io.jsonwebtoken.Jwts;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("TokenService")
class TokenServiceTest {
    private static final String SECRET = "unit-test-signing-secret-32-chars-min!!";
    private static final String ISSUER = "flowlink";
    private static final String AUDIENCE = "flowlink-app";

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private CookieFactory cookieFactory;

    private JwtProperties jwtProperties;
    private TokenService tokenService;

    @BeforeEach
    void setUp() {
        jwtProperties = jwtProperties(SECRET, Duration.ofMinutes(15), ISSUER, AUDIENCE);
        tokenService = tokenService(jwtProperties, 30);
    }

    private static SecretKey deriveKey(String secret) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return new SecretKeySpec(digest.digest(secret.getBytes(StandardCharsets.UTF_8)), "HmacSHA256");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static JwtProperties jwtProperties(String secret, Duration accessTokenExpiration,
                                               String issuer, String audience) {
        return new JwtProperties(secret, accessTokenExpiration, Duration.ofDays(7),
                Duration.ofSeconds(30), issuer, audience);
    }

    private TokenService tokenService(JwtProperties properties, int absoluteMaxDays) {
        var appProperties = new AppProperties();
        appProperties.getSession().setAbsoluteMaxDays(absoluteMaxDays);
        return new TokenService(deriveKey(properties.secret()), properties, appProperties,
                refreshTokenRepository, userRepository, cookieFactory);
    }

    private static String rawToken(SecretKey key, String issuer, String audience, String type,
                                   Instant issuedAt, Instant expiresAt, String subject) {
        return Jwts.builder()
                .subject(subject)
                .issuer(issuer)
                .audience().add(audience).and()
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .claim("type", type)
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    @Nested
    @DisplayName("generateAccessToken / validateTokenAndGetUserId")
    class AccessTokenTests {
        @Test
        @DisplayName("round-trips a freshly generated token back to its user id")
        void roundTripsAFreshToken() {
            var token = tokenService.generateAccessToken(42);

            assertThat(tokenService.validateTokenAndGetUserId(token)).isEqualTo(42);
        }

        @Test
        @DisplayName("rejects null and empty tokens without throwing")
        void rejectsNullAndEmptyTokens() {
            assertThat(tokenService.validateTokenAndGetUserId(null)).isNull();
            assertThat(tokenService.validateTokenAndGetUserId("")).isNull();
        }

        @Test
        @DisplayName("rejects a syntactically invalid token")
        void rejectsAMalformedToken() {
            assertThat(tokenService.validateTokenAndGetUserId("not-a-jwt-at-all")).isNull();
        }

        @Test
        @DisplayName("rejects a token whose signature does not match the configured secret")
        void rejectsATokenSignedWithADifferentKey() {
            var now = Instant.now();
            var token = rawToken(deriveKey("a-completely-different-signing-secret!!"),
                    ISSUER, AUDIENCE, "access", now, now.plusSeconds(900), "42");

            assertThat(tokenService.validateTokenAndGetUserId(token)).isNull();
        }

        @Test
        @DisplayName("rejects a token issued by a different issuer")
        void rejectsATokenFromADifferentIssuer() {
            var now = Instant.now();
            var token = rawToken(deriveKey(SECRET), "some-other-issuer", AUDIENCE, "access",
                    now, now.plusSeconds(900), "42");

            assertThat(tokenService.validateTokenAndGetUserId(token)).isNull();
        }

        @Test
        @DisplayName("rejects a token issued for a different audience")
        void rejectsATokenForADifferentAudience() {
            var now = Instant.now();
            var token = rawToken(deriveKey(SECRET), ISSUER, "some-other-app", "access",
                    now, now.plusSeconds(900), "42");

            assertThat(tokenService.validateTokenAndGetUserId(token)).isNull();
        }

        @Test
        @DisplayName("rejects an expired token")
        void rejectsAnExpiredToken() {
            var now = Instant.now();
            var token = rawToken(deriveKey(SECRET), ISSUER, AUDIENCE, "access",
                    now.minusSeconds(3600), now.minusSeconds(60), "42");

            assertThat(tokenService.validateTokenAndGetUserId(token)).isNull();
        }

        @Test
        @DisplayName("rejects a refresh-typed token even if otherwise well-formed")
        void rejectsARefreshTypedToken() {
            var now = Instant.now();
            var token = rawToken(deriveKey(SECRET), ISSUER, AUDIENCE, "refresh",
                    now, now.plusSeconds(900), "42");

            assertThat(tokenService.validateTokenAndGetUserId(token)).isNull();
        }

        @Test
        @DisplayName("rejects a token with a non-numeric subject")
        void rejectsANonNumericSubject() {
            var now = Instant.now();
            var token = rawToken(deriveKey(SECRET), ISSUER, AUDIENCE, "access",
                    now, now.plusSeconds(900), "not-a-number");

            assertThat(tokenService.validateTokenAndGetUserId(token)).isNull();
        }

        @Test
        @DisplayName("rejects a tampered token")
        void rejectsATamperedToken() {
            var token = tokenService.generateAccessToken(42);
            var tampered = token.substring(0, token.length() - 1)
                    + (token.charAt(token.length() - 1) == 'a' ? 'b' : 'a');

            assertThat(tokenService.validateTokenAndGetUserId(tampered)).isNull();
        }

        @Test
        @DisplayName("mints an access token whose lifetime matches the configured expiration exactly")
        void accessTokenLifetimeMatchesConfiguration() {
            var token = tokenService.generateAccessToken(42);

            var claims = Jwts.parser()
                    .verifyWith(deriveKey(SECRET))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            var lifetime = Duration.between(claims.getIssuedAt().toInstant(),
                    claims.getExpiration().toInstant());
            assertThat(lifetime).isEqualTo(jwtProperties.accessTokenExpiration());
        }
    }

    @Nested
    @DisplayName("createAuthTokens")
    class CreateAuthTokensTests {
        @Test
        @DisplayName("issues a refresh token whose stored expiry matches the configured refresh-token lifetime")
        void issuedRefreshTokenExpiryMatchesConfiguration() {
            var user = TestEntityFactory.createUser(7, "user@example.com");
            when(userRepository.getReferenceById(7)).thenReturn(user);

            tokenService.createAuthTokens(7);

            var captor = ArgumentCaptor.forClass(RefreshToken.class);
            verify(refreshTokenRepository).save(captor.capture());
            var saved = captor.getValue();

            var refreshLifetime = jwtProperties.refreshTokenExpiration();
            var margin = Duration.ofSeconds(5);

            assertThat(saved.isExpired(Instant.now().plus(refreshLifetime).minus(margin)))
                    .as("not yet expired just inside the configured lifetime")
                    .isFalse();
            assertThat(saved.isExpired(Instant.now().plus(refreshLifetime).plus(margin)))
                    .as("expired just past the configured lifetime")
                    .isTrue();
        }
    }

    @Nested
    @DisplayName("rotateRefreshToken")
    class RotateRefreshTokenTests {
        @Test
        @DisplayName("refuses a null or blank presented token without touching the repository")
        void refusesABlankPresentedToken() {
            var nullResult = tokenService.rotateRefreshToken(null);
            var blankResult = tokenService.rotateRefreshToken("   ");

            assertThat(nullResult.succeeded()).isFalse();
            assertThat(blankResult.succeeded()).isFalse();
            verifyNoRepositoryLookup();
        }

        @Test
        @DisplayName("refuses a presented token that matches no stored hash")
        void refusesAnUnknownToken() {
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

            var result = tokenService.rotateRefreshToken("unknown-token");

            assertThat(result.succeeded()).isFalse();
            verify(refreshTokenRepository, never()).deleteFamily(anyString());
        }

        @Test
        @DisplayName("rotates a fresh, unconsumed token into a new one in the same family")
        void rotatesAFreshToken() {
            var user = TestEntityFactory.createUser(7, "user@example.com");
            var now = Instant.now();
            var stored = new RefreshToken("old-hash", user, "family-1", now.minusSeconds(60),
                    now.plusSeconds(3600));
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            when(refreshTokenRepository.markConsumedIfUnconsumed(anyString(), any())).thenReturn(1);
            when(userRepository.getReferenceById(7)).thenReturn(user);

            var result = tokenService.rotateRefreshToken("presented-token");

            assertThat(result.succeeded()).isTrue();
            assertThat(result.userId()).isEqualTo(7);
            assertThat(result.refreshToken()).isNotBlank();
            verify(refreshTokenRepository).markConsumedIfUnconsumed(anyString(), any());
            verify(refreshTokenRepository).save(argThatFamilyMatches("family-1"));
            verify(refreshTokenRepository, never()).deleteFamily(anyString());
        }

        @Test
        @DisplayName("treats a second presentation of an already-consumed token as replay and revokes the whole family")
        void revokesTheFamilyOnReplay() {
            var user = TestEntityFactory.createUser(7, "user@example.com");
            var now = Instant.now();
            var stored = new RefreshToken("old-hash", user, "family-1", now.minusSeconds(60),
                    now.plusSeconds(3600));
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            when(refreshTokenRepository.markConsumedIfUnconsumed(anyString(), any())).thenReturn(0);

            var result = tokenService.rotateRefreshToken("already-used-token");

            assertThat(result.succeeded()).isFalse();
            verify(refreshTokenRepository).deleteFamily("family-1");
            verify(refreshTokenRepository, never()).save(any());
        }

        @Test
        @DisplayName("refuses and revokes the family when the presented token has expired")
        void revokesTheFamilyOnExpiry() {
            var user = TestEntityFactory.createUser(7, "user@example.com");
            var now = Instant.now();
            var stored = new RefreshToken("old-hash", user, "family-1", now.minusSeconds(60),
                    now.minusSeconds(1));
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            when(refreshTokenRepository.markConsumedIfUnconsumed(anyString(), any())).thenReturn(1);

            var result = tokenService.rotateRefreshToken("expired-token");

            assertThat(result.succeeded()).isFalse();
            verify(refreshTokenRepository).deleteFamily("family-1");
            verify(refreshTokenRepository, never()).save(any());
        }

        @Test
        @DisplayName("refuses and revokes the family once the absolute session lifetime is exceeded, even for an otherwise valid token")
        void revokesTheFamilyPastTheAbsoluteSessionCap() {
            var shortSessionService = tokenService(jwtProperties, 1);
            var user = TestEntityFactory.createUser(7, "user@example.com");
            var now = Instant.now();
            var stored = new RefreshToken("old-hash", user, "family-1",
                    now.minus(Duration.ofDays(2)), now.plusSeconds(3600));
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            when(refreshTokenRepository.markConsumedIfUnconsumed(anyString(), any())).thenReturn(1);

            var result = shortSessionService.rotateRefreshToken("still-valid-but-old-session");

            assertThat(result.succeeded()).isFalse();
            assertThat(result.failureMessage()).contains("Session expired");
            verify(refreshTokenRepository).deleteFamily("family-1");
            verify(refreshTokenRepository, never()).save(any());
        }

        private RefreshToken argThatFamilyMatches(String familyId) {
            return org.mockito.ArgumentMatchers.argThat(saved -> saved != null
                    && familyId.equals(saved.getFamilyId()));
        }

        private void verifyNoRepositoryLookup() {
            verify(refreshTokenRepository, never()).findByTokenHash(anyString());
            verify(refreshTokenRepository, never()).deleteFamily(anyString());
        }
    }
}
