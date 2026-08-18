package com.backend.util;

import com.backend.exception.ValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

class ValidationUtilTest {

    @Nested
    @DisplayName("isNullOrEmpty")
    class IsNullOrEmptyTests {

        @Test
        @DisplayName("should return true for null")
        void shouldReturnTrueForNull() {
            assertTrue(ValidationUtil.isNullOrEmpty(null));
        }

        @Test
        @DisplayName("should return true for empty string")
        void shouldReturnTrueForEmptyString() {
            assertTrue(ValidationUtil.isNullOrEmpty(""));
        }

        @Test
        @DisplayName("should return true for whitespace-only string")
        void shouldReturnTrueForWhitespace() {
            assertTrue(ValidationUtil.isNullOrEmpty("   "));
            assertTrue(ValidationUtil.isNullOrEmpty("\t"));
            assertTrue(ValidationUtil.isNullOrEmpty("\n"));
            assertTrue(ValidationUtil.isNullOrEmpty("  \t\n  "));
        }

        @Test
        @DisplayName("should return false for non-empty string")
        void shouldReturnFalseForNonEmpty() {
            assertFalse(ValidationUtil.isNullOrEmpty("hello"));
            assertFalse(ValidationUtil.isNullOrEmpty(" hello "));
        }
    }

    @Nested
    @DisplayName("isValidEmail")
    class IsValidEmailTests {

        @ParameterizedTest
        @ValueSource(strings = {
                "test@example.com",
                "user.name@domain.co.uk",
                "user+tag@example.org",
                "user123@test-domain.com",
                "a@b.co"
        })
        @DisplayName("should return true for valid email formats")
        void shouldReturnTrueForValidEmails(String email) {
            assertTrue(ValidationUtil.isValidEmail(email));
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "invalid-email",
                "@nodomain.com",
                "user@",
                "user@.com",
                "user@domain",
                "user name@domain.com",
                "user@domain..com"
        })
        @DisplayName("should return false for invalid email formats")
        void shouldReturnFalseForInvalidEmails(String email) {
            assertFalse(ValidationUtil.isValidEmail(email));
        }

        @ParameterizedTest
        @NullAndEmptySource
        @DisplayName("should return false for null or empty")
        void shouldReturnFalseForNullOrEmpty(String email) {
            assertFalse(ValidationUtil.isValidEmail(email));
        }

        @Test
        @DisplayName("should return false for email longer than 255 characters")
        void shouldReturnFalseForTooLongEmail() {
            String longLocalPart = "a".repeat(250);
            String longEmail = longLocalPart + "@example.com";
            assertFalse(ValidationUtil.isValidEmail(longEmail));
        }

        @Test
        @DisplayName("should be case insensitive for domain")
        void shouldBeCaseInsensitive() {
            assertTrue(ValidationUtil.isValidEmail("TEST@EXAMPLE.COM"));
            assertTrue(ValidationUtil.isValidEmail("test@EXAMPLE.com"));
        }
    }

    @Nested
    @DisplayName("validatePassword")
    class ValidatePasswordTests {

        @Test
        @DisplayName("should accept valid password")
        void shouldAcceptValidPassword() {
            assertDoesNotThrow(() -> ValidationUtil.validatePassword("ValidPass123!"));
        }

        @Test
        @DisplayName("should throw for null password")
        void shouldThrowForNull() {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validatePassword(null));
            assertEquals("Password is required", ex.getMessage());
        }

        @Test
        @DisplayName("should throw for empty password")
        void shouldThrowForEmpty() {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validatePassword(""));
            assertEquals("Password is required", ex.getMessage());
        }

        @Test
        @DisplayName("should throw for whitespace-only password")
        void shouldThrowForWhitespace() {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validatePassword("   "));
            assertEquals("Password is required", ex.getMessage());
        }

        @Test
        @DisplayName("should throw for password shorter than 8 characters")
        void shouldThrowForShortPassword() {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validatePassword("Short1!"));
            assertEquals("Password must be at least 8 characters long", ex.getMessage());
        }

        @Test
        @DisplayName("should throw for password longer than 128 characters")
        void shouldThrowForLongPassword() {
            String longPassword = "A1!" + "a".repeat(126);
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validatePassword(longPassword));
            assertEquals("Password must not exceed 128 characters", ex.getMessage());
        }

        @Test
        @DisplayName("should throw for password without uppercase letter")
        void shouldThrowForNoUppercase() {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validatePassword("lowercase123!"));
            assertEquals("Password must contain at least one uppercase letter", ex.getMessage());
        }

        @Test
        @DisplayName("should throw for password without lowercase letter")
        void shouldThrowForNoLowercase() {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validatePassword("UPPERCASE123!"));
            assertEquals("Password must contain at least one lowercase letter", ex.getMessage());
        }

        @Test
        @DisplayName("should throw for password without digit")
        void shouldThrowForNoDigit() {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validatePassword("NoDigitsHere!"));
            assertEquals("Password must contain at least one number", ex.getMessage());
        }

        @Test
        @DisplayName("should throw for password without special character")
        void shouldThrowForNoSpecialChar() {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validatePassword("NoSpecial123"));
            assertEquals("Password must contain at least one special character", ex.getMessage());
        }

        @Test
        @DisplayName("should throw for password containing spaces")
        void shouldThrowForSpaces() {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validatePassword("Has Space123!"));
            assertEquals("Password must not contain spaces", ex.getMessage());
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "Valid123!",
                "P@ssword1",
                "MyP4ss#word",
                "Test_1234",
                "Strong$Pass99",
                "12345678Aa!"
        })
        @DisplayName("should accept various valid passwords")
        void shouldAcceptVariousValidPasswords(String password) {
            assertDoesNotThrow(() -> ValidationUtil.validatePassword(password));
        }

        @Test
        @DisplayName("should accept password at minimum length (8 chars)")
        void shouldAcceptMinLength() {
            assertDoesNotThrow(() -> ValidationUtil.validatePassword("Aa1!aaaa"));
        }

        @Test
        @DisplayName("should accept password at maximum length (128 chars)")
        void shouldAcceptMaxLength() {
            String maxPassword = "Aa1!" + "a".repeat(124);
            assertDoesNotThrow(() -> ValidationUtil.validatePassword(maxPassword));
        }
    }

    @Nested
    @DisplayName("validateName")
    class ValidateNameTests {

        @Test
        @DisplayName("should accept valid name")
        void shouldAcceptValidName() {
            assertDoesNotThrow(() -> ValidationUtil.validateName("John", "First name"));
        }

        @Test
        @DisplayName("should throw for null name")
        void shouldThrowForNull() {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validateName(null, "First name"));
            assertEquals("First name is required", ex.getMessage());
        }

        @Test
        @DisplayName("should throw for empty name")
        void shouldThrowForEmpty() {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validateName("", "Last name"));
            assertEquals("Last name is required", ex.getMessage());
        }

        @Test
        @DisplayName("should throw for name shorter than 2 characters")
        void shouldThrowForShortName() {
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validateName("A", "First name"));
            assertEquals("First name must be at least 2 characters", ex.getMessage());
        }

        @Test
        @DisplayName("should throw for name longer than 50 characters")
        void shouldThrowForLongName() {
            String longName = "A".repeat(51);
            ValidationException ex = assertThrows(ValidationException.class,
                    () -> ValidationUtil.validateName(longName, "First name"));
            assertEquals("First name must not exceed 50 characters", ex.getMessage());
        }

        @Test
        @DisplayName("should accept name at minimum length (2 chars)")
        void shouldAcceptMinLength() {
            assertDoesNotThrow(() -> ValidationUtil.validateName("Jo", "First name"));
        }

        @Test
        @DisplayName("should accept name at maximum length (50 chars)")
        void shouldAcceptMaxLength() {
            String maxName = "A".repeat(50);
            assertDoesNotThrow(() -> ValidationUtil.validateName(maxName, "First name"));
        }
    }

    @Nested
    @DisplayName("Security Edge Cases")
    class SecurityEdgeCaseTests {

        @Test
        @DisplayName("should handle unicode in email validation")
        void shouldHandleUnicodeEmail() {
            // Standard ASCII email should work
            assertTrue(ValidationUtil.isValidEmail("test@example.com"));

            // IDN domains are not supported by the simple regex
            assertFalse(ValidationUtil.isValidEmail("test@日本語.jp"));
        }

        @Test
        @DisplayName("should reject email with SQL injection attempt")
        void shouldRejectSqlInjectionEmail() {
            assertFalse(ValidationUtil.isValidEmail("'; DROP TABLE users;--@example.com"));
            assertFalse(ValidationUtil.isValidEmail("test@example.com; DROP TABLE"));
        }

        @Test
        @DisplayName("should reject email with XSS attempt")
        void shouldRejectXssEmail() {
            assertFalse(ValidationUtil.isValidEmail("<script>alert('xss')</script>@example.com"));
            assertFalse(ValidationUtil.isValidEmail("test@<script>alert('xss')</script>.com"));
        }

        @Test
        @DisplayName("should handle password with unicode characters")
        void shouldHandleUnicodePassword() {
            // Unicode characters should work as special characters
            assertDoesNotThrow(() -> ValidationUtil.validatePassword("Password1日本語!"));
        }

        @Test
        @DisplayName("should handle very long input without hanging")
        void shouldHandleLongInputEfficiently() {
            String veryLongString = "a".repeat(10000);

            long startTime = System.currentTimeMillis();
            assertFalse(ValidationUtil.isValidEmail(veryLongString + "@example.com"));
            long duration = System.currentTimeMillis() - startTime;

            // Should complete in reasonable time (less than 1 second)
            assertTrue(duration < 1000, "Email validation took too long: " + duration + "ms");
        }
    }
}
