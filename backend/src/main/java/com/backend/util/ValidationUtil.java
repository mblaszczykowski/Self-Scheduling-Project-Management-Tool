package com.backend.util;

import java.util.regex.Pattern;

public class ValidationUtil {

    public static boolean isNullOrEmpty(String str) {
        return str == null || str.isEmpty();
    }

    public static boolean isValidEmail(String email) {
        final String emailRegex = "^[\\w-.]+@[\\w-]+\\.[a-z]{2,}$";
        return Pattern.compile(emailRegex, Pattern.CASE_INSENSITIVE)
                .matcher(email)
                .matches() && email.length() <= 255;
    }

    public static void validatePassword(String password) {
//        if (password.length() < 8 || password.length() > 32) {
//            throw new ValidationException("Password must be between 8 and 32 characters");
//        }
//        if (!password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?].*")) {
//            throw new ValidationException("Password must contain at least one special character");
//        }
//        if (!password.matches(".*\\d.*")) {
//            throw new ValidationException("Password must contain at least one digit");
//        }
//        if (password.contains(" ")) {
//            throw new ValidationException("Password must not contain spaces");
//        }
    }
}
