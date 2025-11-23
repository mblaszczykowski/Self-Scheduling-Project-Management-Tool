package com.backend.services;

import com.backend.entities.RefreshToken;
import com.backend.exception.AuthorizationException;
import com.backend.repositories.RefreshTokenRepository;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
public class TokenService {

    private final SecretKey jwtSecretKey;
    private final Duration accessTokenExpiration;
    private final Duration refreshTokenExpiration;
    private final RefreshTokenRepository refreshTokenRepository;

    @Autowired
    public TokenService(SecretKey jwtSecretKey,
                        Duration accessTokenExpiration,
                        Duration refreshTokenExpiration,
                        RefreshTokenRepository refreshTokenRepository) {
        this.jwtSecretKey = jwtSecretKey;
        this.accessTokenExpiration = accessTokenExpiration;
        this.refreshTokenExpiration = refreshTokenExpiration;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    // Generate Access Token
    public String generateAccessToken(Integer userId) {
        Date expiration = Date.from(Instant.now().plus(accessTokenExpiration));

        return Jwts.builder()
                .setSubject(String.valueOf(userId))
                .setIssuedAt(new Date())
                .setExpiration(expiration)
                .claim("type", "access")
                .signWith(jwtSecretKey, SignatureAlgorithm.HS256)
                .compact();
    }

    // Generate Refresh Token
    @Transactional
    public String generateRefreshToken(Integer userId) {
        // Clean up old refresh tokens for this user
        refreshTokenRepository.deleteByUserId(userId);

        // Generate new refresh token
        String tokenValue = UUID.randomUUID().toString();
        Instant expiryDate = Instant.now().plus(refreshTokenExpiration);

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken(tokenValue);
        refreshToken.setUserId(userId);
        refreshToken.setExpiryDate(expiryDate);

        refreshTokenRepository.save(refreshToken);

        return tokenValue;
    }

    // Create Auth Cookies
    public AuthTokens createAuthTokens(Integer userId) {
        String accessToken = generateAccessToken(userId);
        String refreshToken = generateRefreshToken(userId);

        ResponseCookie accessCookie = ResponseCookie.from("accessToken", accessToken)
                .httpOnly(true)
                .secure(false) // Set to true in production with HTTPS
                .path("/")
                .maxAge(accessTokenExpiration)
                .sameSite("Lax")
                .build();

        ResponseCookie refreshCookie = ResponseCookie.from("refreshToken", refreshToken)
                .httpOnly(true)
                .secure(false) // Set to true in production with HTTPS
                .path("/api/auth/refresh")
                .maxAge(refreshTokenExpiration)
                .sameSite("Lax")
                .build();

        return new AuthTokens(accessCookie, refreshCookie);
    }

    // Getter for access token expiration (for use in AuthService)
    public Duration getAccessTokenExpiration() {
        return accessTokenExpiration;
    }

    // Validate Access Token
    public Integer validateTokenAndGetUserId(String token) {
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(jwtSecretKey)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            // Verify it's an access token
            String tokenType = claims.get("type", String.class);
            if (!"access".equals(tokenType)) {
                return null;
            }

            return Integer.parseInt(claims.getSubject());
        } catch (JwtException | NumberFormatException e) {
            return null;
        }
    }

    // Validate Refresh Token
    @Transactional
    public Integer validateRefreshToken(String token) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(token)
                .orElse(null);

        if (refreshToken == null || refreshToken.getExpiryDate().isBefore(Instant.now())) {
            if (refreshToken != null) {
                refreshTokenRepository.delete(refreshToken);
            }
            return null;
        }

        return refreshToken.getUserId();
    }

    // Extract Token from Request
    public String extractTokenFromRequest(HttpServletRequest request) {
        // Try to get from cookie first
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("accessToken".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }

        // Fallback to Authorization header (for API clients)
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        return null;
    }

    // Get User ID from Request (for use in controllers)
    public Integer getUserIdFromRequest(HttpServletRequest request) {
        Integer userId = (Integer) request.getAttribute("userId");
        if (userId == null) {
            throw new AuthorizationException("User not authenticated");
        }
        return userId;
    }

    // Revoke Refresh Token (for logout)
    @Transactional
    public void revokeRefreshToken(Integer userId) {
        refreshTokenRepository.deleteByUserId(userId);
    }

    // Clean up expired tokens (scheduled job)
    @Transactional
    public void cleanupExpiredTokens() {
        refreshTokenRepository.deleteByExpiryDateBefore(Instant.now());
    }

    // Inner class for returning both cookies
    public static class AuthTokens {
        private final ResponseCookie accessCookie;
        private final ResponseCookie refreshCookie;

        public AuthTokens(ResponseCookie accessCookie, ResponseCookie refreshCookie) {
            this.accessCookie = accessCookie;
            this.refreshCookie = refreshCookie;
        }

        public ResponseCookie getAccessCookie() {
            return accessCookie;
        }

        public ResponseCookie getRefreshCookie() {
            return refreshCookie;
        }
    }
}