package com.backend.filter;

import com.backend.config.PublicEndpoints;
import com.backend.services.RateLimitService;
import com.backend.util.FilterResponseUtil;
import com.backend.util.IpUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1) // right after SecurityHeaders, before authentication
public class RateLimitFilter extends OncePerRequestFilter {

    private final ObjectMapper objectMapper;
    private final RateLimitService rateLimitService;
    private final Set<String> trustedProxies;

    public RateLimitFilter(ObjectMapper objectMapper,
                           RateLimitService rateLimitService,
                           @Value("${app.trusted-proxies:}") String trustedProxiesConfig) {
        this.objectMapper = objectMapper;
        this.rateLimitService = rateLimitService;
        this.trustedProxies = IpUtil.parseTrustedProxies(trustedProxiesConfig);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();
        String clientIp = IpUtil.getClientIp(request, trustedProxies);

        if (PublicEndpoints.RATE_LIMIT_LOGIN.equals(path) && "POST".equalsIgnoreCase(method)
                && !rateLimitService.allowLogin(clientIp)) {
            sendRateLimitResponse(response, "Too many login attempts. Please try again later.");
            return;
        }

        if (PublicEndpoints.RATE_LIMIT_REGISTER.equals(path) && "POST".equalsIgnoreCase(method)
                && !rateLimitService.allowRegister(clientIp)) {
            sendRateLimitResponse(response, "Too many registration attempts. Please try again later.");
            return;
        }

        // Unauthenticated account-existence oracle — throttle to blunt enumeration.
        if (PublicEndpoints.USER_EXISTS.equals(path) && "GET".equalsIgnoreCase(method)
                && !rateLimitService.allowExists(clientIp)) {
            sendRateLimitResponse(response, "Too many requests. Please try again later.");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void sendRateLimitResponse(HttpServletResponse response, String message) throws IOException {
        response.setHeader("Retry-After", String.valueOf(rateLimitService.getWindowMs() / 1000));
        FilterResponseUtil.sendJsonError(response, HttpStatus.TOO_MANY_REQUESTS, message, objectMapper);
    }
}
