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

        // Only trust forwarding headers when the direct peer is a configured trusted proxy;
        // otherwise the client controls them and could spoof its address.
        if (trustedProxies == null || trustedProxies.isEmpty() || !trustedProxies.contains(remoteAddr)) {
            return remoteAddr;
        }

        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            // A proxy APPENDS the real client to the chain, so the genuine client is the
            // right-most entry that is not itself a trusted proxy. Never trust the left-most
            // (client-supplied) value — that is the spoofable part.
            String[] hops = xForwardedFor.split(",");
            for (int i = hops.length - 1; i >= 0; i--) {
                String ip = hops[i].trim();
                if (!ip.isEmpty() && !trustedProxies.contains(ip)) {
                    return ip;
                }
            }
        }

        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }

        return remoteAddr;
    }
}
