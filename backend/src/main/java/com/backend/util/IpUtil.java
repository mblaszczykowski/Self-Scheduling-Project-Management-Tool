package com.backend.util;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

public final class IpUtil {

    private IpUtil() {}

    public static Set<String> parseTrustedProxies(String config) {
        if (config == null || config.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(config.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    public static String getClientIp(HttpServletRequest request, Set<String> trustedProxies) {
        String remoteAddr = request.getRemoteAddr();

        if (trustedProxies != null && !trustedProxies.isEmpty() && trustedProxies.contains(remoteAddr)) {
            String xForwardedFor = request.getHeader("X-Forwarded-For");
            if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
                return xForwardedFor.split(",")[0].trim();
            }
            String xRealIp = request.getHeader("X-Real-IP");
            if (xRealIp != null && !xRealIp.isEmpty()) {
                return xRealIp.trim();
            }
        }

        return remoteAddr;
    }
}
