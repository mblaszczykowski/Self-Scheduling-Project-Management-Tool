package com.backend.services;

import com.backend.config.JwtProperties;
import com.backend.entities.RefreshToken;
import com.backend.repositories.RefreshTokenRepository;
import com.backend.repositories.UserRepository;
import com.backend.web.CookieFactory;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

/**
 * Issues and validates the two credentials: a short-lived signed access token, and an opaque
 * refresh token whose hash is the only thing stored server-side.
 */
@Service
public class TokenService {

    private static final Logger log = LoggerFactory.getLogger(TokenService.class);

    private static final String ACCESS_TOKEN_COOKIE = "accessToken";
    private static final String REFRESH_TOKEN_COOKIE = "refreshToken";
    private static final String TOKEN_TYPE_CLAIM = "type";
    private static final String ACCESS_TOKEN_TYPE = "access";
    /** Request attribute written by JwtAuthenticationFilter and read by the argument resolver. */
    public static final String USER_ID_ATTRIBUTE = "userId";

    private static final String INVALID_REFRESH_TOKEN = "Invalid or expired refresh token";

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int REFRESH_TOKEN_BYTES = 32;

    private final SecretKey jwtSecretKey;
    private final JwtProperties jwtProperties;
    private final Duration absoluteSessionMax;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    private final CookieFactory cookieFactory;

    public TokenService(SecretKey jwtSecretKey,
                        JwtProperties jwtProperties,
                        com.backend.config.AppProperties appProperties,
                        RefreshTokenRepository refreshTokenRepository,
                        UserRepository userRepository,
                        CookieFactory cookieFactory) {
        this.jwtSecretKey = jwtSecretKey;
        this.jwtProperties = jwtProperties;
        this.absoluteSessionMax = Duration.ofDays(appProperties.getSession().getAbsoluteMaxDays());
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
        this.cookieFactory = cookieFactory;
    }

    public String generateAccessToken(Integer userId) {
        var now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .issuer(jwtProperties.issuer())
                .audience().add(jwtProperties.audience()).and()
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(jwtProperties.accessTokenExpiration())))
                .claim(TOKEN_TYPE_CLAIM, ACCESS_TOKEN_TYPE)
                .signWith(jwtSecretKey, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * @return the authenticated user id, or {@code null} for any token that is unsigned, expired,
     *         issued for a different audience, or not of type {@code access}.
     */
    public Integer validateTokenAndGetUserId(String token) {
        if (token == null || token.isEmpty()) {
            return null;
        }
        try {
            var claims = Jwts.parser()
                    .verifyWith(jwtSecretKey)
                    .requireIssuer(jwtProperties.issuer())
                    .requireAudience(jwtProperties.audience())
                    .clockSkewSeconds(jwtProperties.clockSkew().toSeconds())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            // Refresh tokens are opaque, not JWTs, so they can never reach here — but an
            // explicit type check keeps that from becoming an implicit assumption.
            if (!ACCESS_TOKEN_TYPE.equals(claims.get(TOKEN_TYPE_CLAIM, String.class))) {
                return null;
            }
            return Integer.parseInt(claims.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            // IllegalArgumentException covers NumberFormatException from a non-numeric subject.
            return null;
        }
    }

    /** Starts a new session family. Other devices' sessions are deliberately left alone. */
    @Transactional(rollbackFor = Exception.class)
    public String issueRefreshTokenForNewSession(Integer userId) {
        var now = Instant.now();
        return persistRefreshToken(userId, UUID.randomUUID().toString(), now, now);
    }

    /**
     * Exchanges a presented refresh token for a fresh one in the same family.
     *
     * <p>Returns a failed {@link RotationResult} rather than throwing: the failure paths revoke
     * tokens, and an exception thrown from inside this transaction would roll that revocation
     * back. The caller turns a failure into the 401.
     */
    @Transactional(rollbackFor = Exception.class)
    public RotationResult rotateRefreshToken(String presentedToken) {
        if (presentedToken == null || presentedToken.isBlank()) {
            return RotationResult.failed(INVALID_REFRESH_TOKEN);
        }

        var now = Instant.now();
        var stored = refreshTokenRepository.findByTokenHash(hash(presentedToken)).orElse(null);
        if (stored == null) {
            return RotationResult.failed(INVALID_REFRESH_TOKEN);
        }

        if (stored.isConsumed()) {
            // Someone is replaying a token that was already exchanged. Either it leaked or the
            // legitimate client raced with itself; either way the safe move is to end the family.
            log.warn("Refresh token replay detected for user {} (family {}) - revoking family",
                    stored.getUserId(), stored.getFamilyId());
            refreshTokenRepository.deleteFamily(stored.getFamilyId());
            return RotationResult.failed(INVALID_REFRESH_TOKEN);
        }

        if (stored.isExpired(now)) {
            refreshTokenRepository.deleteFamily(stored.getFamilyId());
            return RotationResult.failed(INVALID_REFRESH_TOKEN);
        }

        if (stored.getFamilyStartedAt().plus(absoluteSessionMax).isBefore(now)) {
            log.info("Session for user {} exceeded the absolute lifetime - requiring a fresh login",
                    stored.getUserId());
            refreshTokenRepository.deleteFamily(stored.getFamilyId());
            return RotationResult.failed("Session expired. Please sign in again.");
        }

        stored.markConsumed();
        var newToken = persistRefreshToken(stored.getUserId(), stored.getFamilyId(),
                stored.getFamilyStartedAt(), now);
        return RotationResult.rotated(stored.getUserId(), newToken);
    }

    private String persistRefreshToken(Integer userId, String familyId,
                                       Instant familyStartedAt, Instant now) {
        var tokenValue = generateOpaqueToken();
        refreshTokenRepository.save(new RefreshToken(
                hash(tokenValue),
                userRepository.getReferenceById(userId),
                familyId,
                familyStartedAt,
                now.plus(jwtProperties.refreshTokenExpiration())
        ));
        return tokenValue;
    }

    /** Revokes one refresh token (per-device sign-out). No-op if unknown. */
    @Transactional(rollbackFor = Exception.class)
    public void revokeRefreshToken(String tokenValue) {
        if (tokenValue == null || tokenValue.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(hash(tokenValue))
                .ifPresent(token -> refreshTokenRepository.deleteFamily(token.getFamilyId()));
    }

    /**
     * Revokes every session of one user. Called on password change, so the canonical
     * "my account was compromised" remediation actually ends the attacker's access.
     */
    @Transactional(rollbackFor = Exception.class)
    public int revokeAllSessionsForUser(Integer userId) {
        int revoked = refreshTokenRepository.deleteAllForUser(userId);
        if (revoked > 0) {
            log.info("Revoked {} refresh token(s) for user {}", revoked, userId);
        }
        return revoked;
    }

    @Transactional(rollbackFor = Exception.class)
    public int cleanupExpiredTokens() {
        return refreshTokenRepository.deleteExpired(Instant.now());
    }

    public AuthTokens createAuthTokens(Integer userId) {
        return buildCookies(userId, issueRefreshTokenForNewSession(userId));
    }

    public AuthTokens buildCookies(Integer userId, String refreshTokenValue) {
        var accessCookie = cookieFactory.build(ACCESS_TOKEN_COOKIE, generateAccessToken(userId),
                jwtProperties.accessTokenExpiration(), true);
        var refreshCookie = cookieFactory.build(REFRESH_TOKEN_COOKIE, refreshTokenValue,
                jwtProperties.refreshTokenExpiration(), true);
        return new AuthTokens(accessCookie, refreshCookie);
    }

    public ResponseCookie accessCookieDeletion() {
        return cookieFactory.deletion(ACCESS_TOKEN_COOKIE, true);
    }

    public ResponseCookie refreshCookieDeletion() {
        return cookieFactory.deletion(REFRESH_TOKEN_COOKIE, true);
    }

    public String extractTokenFromRequest(HttpServletRequest request) {
        return CookieFactory.read(request, ACCESS_TOKEN_COOKIE)
                .or(() -> bearerToken(request))
                .orElse(null);
    }

    private java.util.Optional<String> bearerToken(HttpServletRequest request) {
        var authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return java.util.Optional.of(authHeader.substring(7));
        }
        return java.util.Optional.empty();
    }

    public static java.util.Optional<String> readRefreshCookie(HttpServletRequest request) {
        return CookieFactory.read(request, REFRESH_TOKEN_COOKIE);
    }

    private static String generateOpaqueToken() {
        var bytes = new byte[REFRESH_TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * A plain SHA-256, not a password hash: the input is 256 bits of {@link SecureRandom} output,
     * so there is nothing to brute-force and a deliberately slow KDF would only add latency to
     * every refresh.
     */
    private static String hash(String tokenValue) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(digest.digest(tokenValue.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    public record AuthTokens(ResponseCookie accessCookie, ResponseCookie refreshCookie) {}

    /** Either a successful rotation (userId + new token) or a failure with a client-safe reason. */
    public record RotationResult(Integer userId, String refreshToken, String failureMessage) {

        static RotationResult rotated(Integer userId, String refreshToken) {
            return new RotationResult(userId, refreshToken, null);
        }

        static RotationResult failed(String failureMessage) {
            return new RotationResult(null, null, failureMessage);
        }

        public boolean succeeded() {
            return failureMessage == null;
        }
    }
}
