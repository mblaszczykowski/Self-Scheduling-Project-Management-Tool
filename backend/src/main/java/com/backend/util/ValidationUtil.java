package com.backend.util;

import com.backend.exception.ValidationException;
import java.util.regex.Pattern;
import java.nio.charset.StandardCharsets;

public final class ValidationUtil {

    public static final int MAX_PASSWORD_BYTES = 72;

    public static final int MAX_COMMENT_LENGTH = 10000;

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern SPECIAL_CHAR_PATTERN = Pattern.compile(
            "[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?]"
    );

    private ValidationUtil() {
    }

    public static boolean isNullOrEmpty(String str) {
        return str == null || str.trim().isEmpty();
    }

    public static boolean isValidEmail(String email) {
        if (isNullOrEmpty(email) || email.length() > 255) {
            return false;
        }
        if (email.contains("..")) {
            return false;
        }
        return EMAIL_PATTERN.matcher(email).matches();
    }

    public static void validatePassword(String password) {
        if (isNullOrEmpty(password)) {
            throw new ValidationException("Password is required");
        }

        if (password.length() < 8) {
            throw new ValidationException("Password must be at least 8 characters long");
        }

        validatePasswordLength(password);

        if (!password.matches(".*[A-Z].*")) {
            throw new ValidationException("Password must contain at least one uppercase letter");
        }

        if (!password.matches(".*[a-z].*")) {
            throw new ValidationException("Password must contain at least one lowercase letter");
        }

        if (!password.matches(".*\\d.*")) {
            throw new ValidationException("Password must contain at least one number");
        }

        if (!SPECIAL_CHAR_PATTERN.matcher(password).find()) {
            throw new ValidationException("Password must contain at least one special character");
        }

        if (password.contains(" ")) {
            throw new ValidationException("Password must not contain spaces");
        }
    }

    public static void validatePasswordLength(String password) {
        if (password != null && password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            throw new ValidationException("Password must not exceed 72 bytes in UTF-8");
        }
    }

}
