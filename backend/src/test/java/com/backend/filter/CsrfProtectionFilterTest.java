package com.backend.filter;

import com.backend.config.CookieProperties;
import com.backend.config.JwtProperties;
import com.backend.web.CookieFactory;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Duration;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class CsrfProtectionFilterTest {

    private static final String CSRF_COOKIE_NAME = "XSRF-TOKEN";
    private static final String CSRF_HEADER_NAME = "X-CSRF-Token";
    private static final String VALID_TOKEN = "validCsrfToken123456789012345678901234567890";

    private static final Duration ACCESS_TOKEN_TTL = Duration.ofMinutes(15);
    private static final Duration REFRESH_TOKEN_TTL = Duration.ofDays(7);

    /** Configured like the application's own mapper, so the error body is the real one. */
    private final ObjectMapper objectMapper = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();

    private CookieProperties cookieProperties;
    private CookieFactory cookieFactory;
    private CsrfProtectionFilter filter;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;
    private RecordingFilterChain chain;

    /** Records whether — and with what — the request was let through. */
    private static final class RecordingFilterChain implements FilterChain {
        private ServletRequest passedRequest;
        private ServletResponse passedResponse;
        private int invocations;

        @Override
        public void doFilter(ServletRequest request, ServletResponse response) {
            this.passedRequest = request;
            this.passedResponse = response;
            this.invocations++;
        }

        boolean wasCalled() {
            return invocations > 0;
        }
    }

    @BeforeEach
    void setUp() {
        cookieProperties = new CookieProperties();
        cookieProperties.setSecure(false);
        cookieProperties.setSameSite("Lax");
        cookieFactory = new CookieFactory(cookieProperties);
        filter = filterWithRefreshTokenLifetime(REFRESH_TOKEN_TTL);
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        chain = new RecordingFilterChain();
    }

    private CsrfProtectionFilter filterWithRefreshTokenLifetime(Duration refreshTokenExpiration) {
        var jwtProperties = new JwtProperties("a-test-secret-of-at-least-32-characters",
                ACCESS_TOKEN_TTL, refreshTokenExpiration, Duration.ofSeconds(30),
                "flowlink", "flowlink-web");
        return new CsrfProtectionFilter(objectMapper, cookieFactory, jwtProperties);
    }

    private void requestOf(String method, String path) {
        request.setMethod(method);
        request.setRequestURI(path);
    }

    private void withCsrfCookie(String value) {
        request.setCookies(new Cookie(CSRF_COOKIE_NAME, value));
    }

    private void invokeFilter() throws Exception {
        filter.doFilterInternal(request, response, chain);
    }

    private String setCookieHeader() {
        return response.getHeader(HttpHeaders.SET_COOKIE);
    }

    private String issuedCsrfToken() {
        var header = setCookieHeader();
        assertThat(header).startsWith(CSRF_COOKIE_NAME + "=");
        return header.substring((CSRF_COOKIE_NAME + "=").length(), header.indexOf(';'));
    }

    private void assertRejectedAsCsrfFailure() throws Exception {
        assertThat(chain.wasCalled())
                .as("request must not reach the application")
                .isFalse();
        assertThat(response.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
        assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_JSON_VALUE);
        assertThat(response.getCharacterEncoding()).isEqualToIgnoringCase("UTF-8");

        var body = objectMapper.readTree(response.getContentAsString());
        assertThat(body.path("status").asInt()).isEqualTo(403);
        assertThat(body.path("error").asText()).isEqualTo("Forbidden");
        assertThat(body.path("code").asText()).isEqualTo("CSRF_ERROR");
        assertThat(body.path("message").asText()).contains("CSRF token validation failed");
        assertThat(body.path("timestamp").asText()).isNotBlank();
    }

    private void assertPassedThrough() throws Exception {
        assertThat(chain.wasCalled()).as("request should have been let through").isTrue();
        assertThat(chain.passedRequest).isSameAs(request);
        assertThat(chain.passedResponse).isSameAs(response);
        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
        assertThat(response.getContentAsString()).isEmpty();
    }

    @Nested
    @DisplayName("safe methods")
    class SafeMethodTests {

        @ParameterizedTest
        @ValueSource(strings = {"GET", "HEAD", "OPTIONS", "get"})
        @DisplayName("pass through without any CSRF header")
        void shouldPassThroughWithoutAHeader(String method) throws Exception {
            requestOf(method, "/api/projects");
            withCsrfCookie(VALID_TOKEN);

            invokeFilter();

            assertPassedThrough();
            assertThat(setCookieHeader()).as("existing cookie must be left alone").isNull();
        }

        @Test
        @DisplayName("hand out a fresh script-readable token cookie when the caller has none")
        void shouldIssueAFreshTokenCookie() throws Exception {
            requestOf("GET", "/api/projects");

            invokeFilter();

            assertPassedThrough();
            var header = setCookieHeader();
            assertThat(header).contains("Path=/", "SameSite=Lax");
            assertThat(header).as("the SPA has to read this cookie to echo it back")
                    .doesNotContain("HttpOnly");
            assertThat(header).doesNotContain("Secure");

            var token = issuedCsrfToken();
            assertThat(Base64.getUrlDecoder().decode(token))
                    .as("32 random bytes, url-encoded without padding").hasSize(32);
        }

        @Test
        @DisplayName("give the token cookie the refresh token's lifetime, not the access token's")
        void shouldGiveTheCookieTheRefreshTokenLifetime() throws Exception {
            requestOf("GET", "/api/projects");

            invokeFilter();

            assertThat(setCookieHeader()).contains("Max-Age=" + REFRESH_TOKEN_TTL.toSeconds());
            assertThat(setCookieHeader()).doesNotContain("Max-Age=" + ACCESS_TOKEN_TTL.toSeconds());
        }

        @Test
        @DisplayName("follow the configured refresh token lifetime rather than a fixed value")
        void shouldFollowTheConfiguredRefreshTokenLifetime() throws Exception {
            filter = filterWithRefreshTokenLifetime(Duration.ofDays(3));
            requestOf("GET", "/api/projects");

            invokeFilter();

            assertThat(setCookieHeader()).contains("Max-Age=259200");
        }

        @Test
        @DisplayName("mark the cookie Secure and SameSite=None when the deployment says so")
        void shouldHonourTheCookieConfiguration() throws Exception {
            cookieProperties.setSecure(true);
            cookieProperties.setSameSite("None");
            filter = filterWithRefreshTokenLifetime(REFRESH_TOKEN_TTL);
            requestOf("GET", "/api/projects");

            invokeFilter();

            assertThat(setCookieHeader()).contains("Secure", "SameSite=None");
        }

        @Test
        @DisplayName("keep the token the caller already has instead of rotating it")
        void shouldKeepAnExistingToken() throws Exception {
            requestOf("GET", "/api/projects");
            withCsrfCookie(VALID_TOKEN);

            invokeFilter();

            assertThat(setCookieHeader()).isNull();
            assertThat(response.getCookies()).isEmpty();
        }
    }

    @Nested
    @DisplayName("state-changing methods")
    class StateChangingMethodTests {

        @ParameterizedTest
        @ValueSource(strings = {"POST", "PUT", "DELETE", "PATCH"})
        @DisplayName("pass through when the header echoes the cookie exactly")
        void shouldPassThroughWhenTheHeaderMatches(String method) throws Exception {
            requestOf(method, "/api/projects/PROJ");
            withCsrfCookie(VALID_TOKEN);
            request.addHeader(CSRF_HEADER_NAME, VALID_TOKEN);

            invokeFilter();

            assertPassedThrough();
        }

        @ParameterizedTest
        @ValueSource(strings = {"POST", "PUT", "DELETE", "PATCH"})
        @DisplayName("are rejected when the header does not match the cookie")
        void shouldRejectAMismatchedHeader(String method) throws Exception {
            requestOf(method, "/api/projects/PROJ");
            withCsrfCookie(VALID_TOKEN);
            request.addHeader(CSRF_HEADER_NAME, "some-other-token");

            invokeFilter();

            assertRejectedAsCsrfFailure();
        }

        @Test
        @DisplayName("are rejected when the header is missing altogether")
        void shouldRejectAMissingHeader() throws Exception {
            requestOf("POST", "/api/projects");
            withCsrfCookie(VALID_TOKEN);

            invokeFilter();

            assertRejectedAsCsrfFailure();
        }

        @Test
        @DisplayName("are rejected when there is no CSRF cookie to compare against")
        void shouldRejectAMissingCookie() throws Exception {
            requestOf("POST", "/api/projects");
            request.addHeader(CSRF_HEADER_NAME, VALID_TOKEN);

            invokeFilter();

            assertRejectedAsCsrfFailure();
            assertThat(setCookieHeader()).as("no token is handed out on the rejection").isNull();
        }

        @Test
        @DisplayName("are rejected when the request carries an empty cookie array")
        void shouldRejectAnEmptyCookieArray() throws Exception {
            requestOf("POST", "/api/projects");
            request.setCookies(new Cookie[0]);
            request.addHeader(CSRF_HEADER_NAME, VALID_TOKEN);

            invokeFilter();

            assertRejectedAsCsrfFailure();
        }

        @ParameterizedTest
        @CsvSource(value = {
                "empty header|",
                "trailing space|" + VALID_TOKEN + " ",
                "leading space| " + VALID_TOKEN,
                "prefix of the real token|validCsrfToken",
                "token plus a suffix|" + VALID_TOKEN + "extra"
        }, delimiter = '|', ignoreLeadingAndTrailingWhitespace = false)
        @DisplayName("are rejected for anything short of an exact, equal-length match")
        void shouldRequireAnExactMatch(String description, String headerValue) throws Exception {
            requestOf("POST", "/api/projects");
            withCsrfCookie(VALID_TOKEN);
            request.addHeader(CSRF_HEADER_NAME, headerValue == null ? "" : headerValue);

            invokeFilter();

            assertRejectedAsCsrfFailure();
        }

        @Test
        @DisplayName("find the CSRF cookie among the auth cookies")
        void shouldFindTheCsrfCookieAmongOthers() throws Exception {
            requestOf("POST", "/api/projects");
            request.setCookies(
                    new Cookie("accessToken", "an-access-token"),
                    new Cookie(CSRF_COOKIE_NAME, VALID_TOKEN),
                    new Cookie("refreshToken", "a-refresh-token"));
            request.addHeader(CSRF_HEADER_NAME, VALID_TOKEN);

            invokeFilter();

            assertPassedThrough();
        }
    }

    @Nested
    @DisplayName("exempt endpoints")
    class ExemptEndpointTests {

        @ParameterizedTest
        @CsvSource({
                "/api/auth/login, POST",
                "/api/users, POST",
                "/error, POST",
                "/actuator/health, POST"
        })
        @DisplayName("are the requests that cannot have a token yet, and they still pass without one")
        void shouldExemptTheRequestsThatCannotHaveATokenYet(String path, String method) throws Exception {
            requestOf(method, path);

            invokeFilter();

            assertPassedThrough();
        }

        @Test
        @DisplayName("no longer include POST /api/auth/refresh, which is rejected without a header")
        void shouldNoLongerExemptTheRefreshEndpoint() throws Exception {
            requestOf("POST", "/api/auth/refresh");
            withCsrfCookie(VALID_TOKEN);

            invokeFilter();

            assertRejectedAsCsrfFailure();
        }

        @Test
        @DisplayName("let POST /api/auth/refresh through once it echoes the token like any other write")
        void shouldAllowTheRefreshEndpointWithAMatchingToken() throws Exception {
            requestOf("POST", "/api/auth/refresh");
            withCsrfCookie(VALID_TOKEN);
            request.addHeader(CSRF_HEADER_NAME, VALID_TOKEN);

            invokeFilter();

            assertPassedThrough();
        }

        @ParameterizedTest
        @CsvSource({
                "/api/users, PUT",
                "/api/users, DELETE",
                "/api/users/exists, POST",
                "/api/users/me, POST",
                "/api/auth/logout, POST"
        })
        @DisplayName("cover registration only, so every other write on those paths is checked")
        void shouldNotExemptNeighbouringPathsAndMethods(String path, String method) throws Exception {
            requestOf(method, path);

            invokeFilter();

            assertRejectedAsCsrfFailure();
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "/api/auth/login/",
                "/api/auth/login;jsessionid=1",
                "/api/auth/LOGIN",
                "/api/auth/login/../login",
                "/uploads/image.png",
                "/static/script.js"
        })
        @DisplayName("are matched exactly, so a decorated path is checked rather than waved through")
        void shouldMatchExemptionsExactly(String path) throws Exception {
            requestOf("POST", path);

            invokeFilter();

            assertRejectedAsCsrfFailure();
        }
    }
}
