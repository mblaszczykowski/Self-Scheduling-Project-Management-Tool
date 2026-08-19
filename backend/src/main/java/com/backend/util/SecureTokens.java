package com.backend.util;

import java.security.SecureRandom;
import java.util.Base64;

public final class SecureTokens {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    public static final int DEFAULT_BYTES = 32;

    private SecureTokens() {}

    public static String urlSafe(int numBytes) {
        var bytes = new byte[numBytes];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
