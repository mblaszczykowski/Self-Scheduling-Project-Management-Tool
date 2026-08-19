package com.backend.web;

import com.backend.config.CookieProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

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
