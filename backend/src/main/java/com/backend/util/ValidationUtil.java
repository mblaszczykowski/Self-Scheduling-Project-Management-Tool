package com.backend.util;

import com.backend.exception.ValidationException;
import java.util.regex.Pattern;

public final class ValidationUtil {

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

        if (password.length() > 128) {
            throw new ValidationException("Password must not exceed 128 characters");
        }

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

    public static void validateName(String name, String fieldName) {
        if (isNullOrEmpty(name)) {
            throw new ValidationException(fieldName + " is required");
        }

        if (name.length() < 2) {
            throw new ValidationException(fieldName + " must be at least 2 characters");
        }

        if (name.length() > 50) {
            throw new ValidationException(fieldName + " must not exceed 50 characters");
        }
    }
}