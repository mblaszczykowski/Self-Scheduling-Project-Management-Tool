package com.backend.services;

import com.backend.exception.AuthorizationException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.time.Duration;
import java.util.Date;

import static io.jsonwebtoken.SignatureAlgorithm.HS512;

@Service
public class TokenService {

    private static final long EXPIRATION_TIME = Duration.ofDays(1).toMillis();
    private static Key jwtKey;

    public TokenService(@Value("${jwt.Key}") String secretKey) {
        jwtKey = Keys.hmacShaKeyFor(secretKey.getBytes());
    }

    public ResponseCookie createAuthCookie(String userId) {
        var expiration = new Date(System.currentTimeMillis() + EXPIRATION_TIME);
        var token = Jwts.builder()
                .setSubject(String.valueOf(userId))
                .setExpiration(expiration)
                .signWith(jwtKey, HS512)
                .compact();

        return ResponseCookie.from("accessToken", token)
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(EXPIRATION_TIME)
                .sameSite("Lax")
                .build();
    }

    public int getUserIdFromRequest(HttpServletRequest request) {
        String token = getTokenFromCookie(request);
        if (token == null) {
            throw new AuthorizationException("Missing authentication token");
        }
        if (!validateToken(token)) {
            throw new AuthorizationException("Invalid or expired token");
        }
        return getUserIdFromToken(token);
    }

    private String getTokenFromCookie(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (var cookie : request.getCookies()) {
                if ("accessToken".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(jwtKey)
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (JwtException e) {
            return false;
        }
    }

    public Integer getUserIdFromToken(String token) {
        var claims = Jwts.parserBuilder()
                .setSigningKey(jwtKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
        return Integer.parseInt(claims.getSubject());
    }
}
