package com.backend.util;

import com.backend.exception.ValidationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ValidationUtilTest {

    @Nested
    @DisplayName("isNullOrEmpty")
    class IsNullOrEmptyTests {

        @Test
        @DisplayName("should return true for null")
        void shouldReturnTrueForNull() {
            assertThat(ValidationUtil.isNullOrEmpty(null)).isTrue();
        }

        @Test
        @DisplayName("should return true for empty string")
        void shouldReturnTrueForEmptyString() {
            assertThat(ValidationUtil.isNullOrEmpty("")).isTrue();
        }

        @Test
        @DisplayName("should return true for whitespace-only string")
        void shouldReturnTrueForWhitespace() {
            assertThat(ValidationUtil.isNullOrEmpty("   ")).isTrue();
            assertThat(ValidationUtil.isNullOrEmpty("\t")).isTrue();
            assertThat(ValidationUtil.isNullOrEmpty("\n")).isTrue();
            assertThat(ValidationUtil.isNullOrEmpty("  \t\n  ")).isTrue();
        }

        @Test
        @DisplayName("should return false for non-empty string")
        void shouldReturnFalseForNonEmpty() {
            assertThat(ValidationUtil.isNullOrEmpty("hello")).isFalse();
            assertThat(ValidationUtil.isNullOrEmpty(" hello ")).isFalse();
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
            assertThat(ValidationUtil.isValidEmail(email)).isTrue();
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
            assertThat(ValidationUtil.isValidEmail(email)).isFalse();
        }

        @ParameterizedTest
        @NullAndEmptySource
        @DisplayName("should return false for null or empty")
        void shouldReturnFalseForNullOrEmpty(String email) {
            assertThat(ValidationUtil.isValidEmail(email)).isFalse();
        }

        @Test
        @DisplayName("should return false for email longer than 255 characters")
        void shouldReturnFalseForTooLongEmail() {
            String longLocalPart = "a".repeat(250);
            String longEmail = longLocalPart + "@example.com";
            assertThat(ValidationUtil.isValidEmail(longEmail)).isFalse();
        }

        @Test
        @DisplayName("should be case insensitive for domain")
        void shouldBeCaseInsensitive() {
            assertThat(ValidationUtil.isValidEmail("TEST@EXAMPLE.COM")).isTrue();
            assertThat(ValidationUtil.isValidEmail("test@EXAMPLE.com")).isTrue();
        }
    }

    @Nested
    @DisplayName("validatePassword")
    class ValidatePasswordTests {

        @Test
        @DisplayName("should accept valid password")
        void shouldAcceptValidPassword() {
            assertThatCode(() -> ValidationUtil.validatePassword("ValidPass123!")).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("should throw for null password")
        void shouldThrowForNull() {
            assertThatThrownBy(() -> ValidationUtil.validatePassword(null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Password is required");
        }

        @Test
        @DisplayName("should throw for empty password")
        void shouldThrowForEmpty() {
            assertThatThrownBy(() -> ValidationUtil.validatePassword(""))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Password is required");
        }

        @Test
        @DisplayName("should throw for whitespace-only password")
        void shouldThrowForWhitespace() {
            assertThatThrownBy(() -> ValidationUtil.validatePassword("   "))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Password is required");
        }

        @Test
        @DisplayName("should throw for password shorter than 8 characters")
        void shouldThrowForShortPassword() {
            assertThatThrownBy(() -> ValidationUtil.validatePassword("Short1!"))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Password must be at least 8 characters long");
        }

        @Test
        @DisplayName("should throw for password longer than 128 characters")
        void shouldThrowForLongPassword() {
            String longPassword = "A1!" + "a".repeat(126);
            assertThatThrownBy(() -> ValidationUtil.validatePassword(longPassword))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Password must not exceed 128 characters");
        }

        @Test
        @DisplayName("should throw for password without uppercase letter")
        void shouldThrowForNoUppercase() {
            assertThatThrownBy(() -> ValidationUtil.validatePassword("lowercase123!"))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Password must contain at least one uppercase letter");
        }

        @Test
        @DisplayName("should throw for password without lowercase letter")
        void shouldThrowForNoLowercase() {
            assertThatThrownBy(() -> ValidationUtil.validatePassword("UPPERCASE123!"))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Password must contain at least one lowercase letter");
        }

        @Test
        @DisplayName("should throw for password without digit")
        void shouldThrowForNoDigit() {
            assertThatThrownBy(() -> ValidationUtil.validatePassword("NoDigitsHere!"))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Password must contain at least one number");
        }

        @Test
        @DisplayName("should throw for password without special character")
        void shouldThrowForNoSpecialChar() {
            assertThatThrownBy(() -> ValidationUtil.validatePassword("NoSpecial123"))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Password must contain at least one special character");
        }

        @Test
        @DisplayName("should throw for password containing spaces")
        void shouldThrowForSpaces() {
            assertThatThrownBy(() -> ValidationUtil.validatePassword("Has Space123!"))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Password must not contain spaces");
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
            assertThatCode(() -> ValidationUtil.validatePassword(password)).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("should accept password at minimum length (8 chars)")
        void shouldAcceptMinLength() {
            assertThatCode(() -> ValidationUtil.validatePassword("Aa1!aaaa")).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("should accept password at maximum length (128 chars)")
        void shouldAcceptMaxLength() {
            String maxPassword = "Aa1!" + "a".repeat(124);
            assertThatCode(() -> ValidationUtil.validatePassword(maxPassword)).doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("validateName")
    class ValidateNameTests {

        @Test
        @DisplayName("should accept valid name")
        void shouldAcceptValidName() {
            assertThatCode(() -> ValidationUtil.validateName("John", "First name")).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("should throw for null name")
        void shouldThrowForNull() {
            assertThatThrownBy(() -> ValidationUtil.validateName(null, "First name"))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("First name is required");
        }

        @Test
        @DisplayName("should throw for empty name")
        void shouldThrowForEmpty() {
            assertThatThrownBy(() -> ValidationUtil.validateName("", "Last name"))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Last name is required");
        }

        @Test
        @DisplayName("should throw for name shorter than 2 characters")
        void shouldThrowForShortName() {
            assertThatThrownBy(() -> ValidationUtil.validateName("A", "First name"))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("First name must be at least 2 characters");
        }

        @Test
        @DisplayName("should throw for name longer than 50 characters")
        void shouldThrowForLongName() {
            String longName = "A".repeat(51);
            assertThatThrownBy(() -> ValidationUtil.validateName(longName, "First name"))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("First name must not exceed 50 characters");
        }

        @Test
        @DisplayName("should accept name at minimum length (2 chars)")
        void shouldAcceptMinLength() {
            assertThatCode(() -> ValidationUtil.validateName("Jo", "First name")).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("should accept name at maximum length (50 chars)")
        void shouldAcceptMaxLength() {
            String maxName = "A".repeat(50);
            assertThatCode(() -> ValidationUtil.validateName(maxName, "First name")).doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("Security Edge Cases")
    class SecurityEdgeCaseTests {

        @Test
        @DisplayName("should handle unicode in email validation")
        void shouldHandleUnicodeEmail() {
            assertThat(ValidationUtil.isValidEmail("test@example.com")).isTrue();

            // IDN domains are not supported by the simple regex
            assertThat(ValidationUtil.isValidEmail("test@日本語.jp")).isFalse();
        }

        @Test
        @DisplayName("should reject email with SQL injection attempt")
        void shouldRejectSqlInjectionEmail() {
            assertThat(ValidationUtil.isValidEmail("'; DROP TABLE users;--@example.com")).isFalse();
            assertThat(ValidationUtil.isValidEmail("test@example.com; DROP TABLE")).isFalse();
        }

        @Test
        @DisplayName("should reject email with XSS attempt")
        void shouldRejectXssEmail() {
            assertThat(ValidationUtil.isValidEmail("<script>alert('xss')</script>@example.com")).isFalse();
            assertThat(ValidationUtil.isValidEmail("test@<script>alert('xss')</script>.com")).isFalse();
        }

        @Test
        @DisplayName("should handle password with unicode characters")
        void shouldHandleUnicodePassword() {
            // Unicode characters should work as special characters
            assertThatCode(() -> ValidationUtil.validatePassword("Password1日本語!")).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("should handle very long input without hanging")
        void shouldHandleLongInputEfficiently() {
            String veryLongString = "a".repeat(10000);

            long startTime = System.currentTimeMillis();
            assertThat(ValidationUtil.isValidEmail(veryLongString + "@example.com")).isFalse();
            long duration = System.currentTimeMillis() - startTime;

            assertThat(duration).as("Email validation took too long: " + duration + "ms").isLessThan(1000);
        }
    }
}
