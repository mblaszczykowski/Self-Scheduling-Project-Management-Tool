package com.backend.util;

import com.backend.config.CookieProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

/**
 * Central builder for cookies so the security attributes (Secure / SameSite / Path) are applied
 * consistently everywhere. Auth cookies are HttpOnly; the CSRF cookie must be script-readable.
 */
@Component
public class CookieFactory {

    private final CookieProperties cookieProperties;

    public CookieFactory(CookieProperties cookieProperties) {
        this.cookieProperties = cookieProperties;
    }

    public ResponseCookie build(String name, String value, Duration maxAge, boolean httpOnly) {
        return ResponseCookie.from(name, value)
                .httpOnly(httpOnly)
                .secure(cookieProperties.isSecure())
                .path("/")
                .maxAge(maxAge)
                .sameSite(cookieProperties.getSameSite())
                .build();
    }

    /** A cookie that immediately deletes the named cookie (same attributes, zero max-age). */
    public ResponseCookie deletion(String name, boolean httpOnly) {
        return build(name, "", Duration.ZERO, httpOnly);
    }

    public static Optional<String> read(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return Optional.empty();
        }
        for (var cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) {
                return Optional.ofNullable(cookie.getValue());
            }
        }
        return Optional.empty();
    }
}
