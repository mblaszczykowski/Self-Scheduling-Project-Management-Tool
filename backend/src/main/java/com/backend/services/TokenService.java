package com.backend.services;

import com.backend.entities.RefreshToken;
import com.backend.exception.AuthorizationException;
import com.backend.repositories.RefreshTokenRepository;
import io.jsonwebtoken.*;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
    private final boolean secureCookie;
    private final String sameSite;

    @Autowired
    public TokenService(SecretKey jwtSecretKey,
                        Duration accessTokenExpiration,
                        Duration refreshTokenExpiration,
                        RefreshTokenRepository refreshTokenRepository,
                        @Value("${app.cookie.secure:true}") boolean secureCookie,
                        @Value("${app.cookie.same-site:Strict}") String sameSite) {
        this.jwtSecretKey = jwtSecretKey;
        this.accessTokenExpiration = accessTokenExpiration;
        this.refreshTokenExpiration = refreshTokenExpiration;
        this.refreshTokenRepository = refreshTokenRepository;
        this.secureCookie = secureCookie;
        this.sameSite = sameSite;
    }

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

    @Transactional
    public String generateRefreshToken(Integer userId) {
        refreshTokenRepository.deleteByUserId(userId);

        String tokenValue = UUID.randomUUID().toString();
        Instant expiryDate = Instant.now().plus(refreshTokenExpiration);

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken(tokenValue);
        refreshToken.setUserId(userId);
        refreshToken.setExpiryDate(expiryDate);

        refreshTokenRepository.save(refreshToken);

        return tokenValue;
    }

    public AuthTokens createAuthTokens(Integer userId) {
        String accessToken = generateAccessToken(userId);
        String refreshToken = generateRefreshToken(userId);

        ResponseCookie accessCookie = ResponseCookie.from("accessToken", accessToken)
                .httpOnly(true)
                .secure(secureCookie)
                .path("/")
                .maxAge(accessTokenExpiration)
                .sameSite(sameSite)
                .build();

        ResponseCookie refreshCookie = ResponseCookie.from("refreshToken", refreshToken)
                .httpOnly(true)
                .secure(secureCookie)
                .path("/")
                .maxAge(refreshTokenExpiration)
                .sameSite(sameSite)
                .build();

        return new AuthTokens(accessCookie, refreshCookie);
    }

    public Duration getAccessTokenExpiration() {
        return accessTokenExpiration;
    }

    public boolean isSecureCookie() {
        return secureCookie;
    }

    public Integer validateTokenAndGetUserId(String token) {
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(jwtSecretKey)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            String tokenType = claims.get("type", String.class);
            if (!"access".equals(tokenType)) {
                return null;
            }

            return Integer.parseInt(claims.getSubject());
        } catch (JwtException | NumberFormatException e) {
            return null;
        }
    }

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

    public String extractTokenFromRequest(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("accessToken".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        return null;
    }

    public Integer getUserIdFromRequest(HttpServletRequest request) {
        Integer userId = (Integer) request.getAttribute("userId");
        if (userId == null) {
            throw new AuthorizationException("User not authenticated");
        }
        return userId;
    }

    @Transactional
    public void revokeRefreshToken(Integer userId) {
        refreshTokenRepository.deleteByUserId(userId);
    }

    @Transactional
    public void cleanupExpiredTokens() {
        refreshTokenRepository.deleteByExpiryDateBefore(Instant.now());
    }

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