package com.backend.filter;

import com.backend.config.JwtProperties;
import com.backend.config.PublicEndpoints;
import com.backend.web.CookieFactory;
import com.backend.util.SecureTokens;
import com.backend.web.FilterResponseUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 3)
public class CsrfProtectionFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(CsrfProtectionFilter.class);

    private static final String CSRF_COOKIE_NAME = "XSRF-TOKEN";
    private static final String CSRF_HEADER_NAME = "X-CSRF-Token";

    private final ObjectMapper objectMapper;
    private final CookieFactory cookieFactory;
    private final Duration cookieMaxAge;

    public CsrfProtectionFilter(ObjectMapper objectMapper,
                                CookieFactory cookieFactory,
                                JwtProperties jwtProperties) {
        this.objectMapper = objectMapper;
        this.cookieFactory = cookieFactory;
        this.cookieMaxAge = jwtProperties.refreshTokenExpiration();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        var path = request.getRequestURI();
        var method = request.getMethod();

        if (isSafeMethod(method)) {
            ensureCsrfTokenCookie(request, response);
            filterChain.doFilter(request, response);
            return;
        }

        if (PublicEndpoints.isCsrfExempt(path, method)) {
            filterChain.doFilter(request, response);
            return;
        }

        var cookieToken = readCsrfCookie(request);
        var headerToken = request.getHeader(CSRF_HEADER_NAME);

        if (cookieToken == null || headerToken == null || !MessageDigest.isEqual(
                cookieToken.getBytes(StandardCharsets.UTF_8),
                headerToken.getBytes(StandardCharsets.UTF_8))) {
            log.warn("CSRF validation failed: client={} method={} path={} cookiePresent={} headerPresent={}",
                    request.getRemoteAddr(), method, path, cookieToken != null, headerToken != null);
            FilterResponseUtil.sendJsonError(response, HttpStatus.FORBIDDEN,
                    "CSRF token validation failed. Please refresh the page and try again.",
                    objectMapper, "CSRF_ERROR");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private static boolean isSafeMethod(String method) {
        return "GET".equalsIgnoreCase(method)
                || "HEAD".equalsIgnoreCase(method)
                || "OPTIONS".equalsIgnoreCase(method);
    }

    private void ensureCsrfTokenCookie(HttpServletRequest request, HttpServletResponse response) {
        if (readCsrfCookie(request) != null) {
            return;
        }
        var cookie = cookieFactory.build(CSRF_COOKIE_NAME, generateCsrfToken(), cookieMaxAge, false);
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private static String readCsrfCookie(HttpServletRequest request) {
        return CookieFactory.read(request, CSRF_COOKIE_NAME).orElse(null);
    }

    private static String generateCsrfToken() {
        return SecureTokens.urlSafe(SecureTokens.DEFAULT_BYTES);
    }
}
