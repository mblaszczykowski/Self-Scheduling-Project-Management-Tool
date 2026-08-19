package com.backend.filter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityHeadersFilterTest {
    private final SecurityHeadersFilter filter = new SecurityHeadersFilter();
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;
    private MockFilterChain chain;

    @BeforeEach
    void setUp() {
        request = new MockHttpServletRequest();
        request.setRequestURI("/api/projects");
        response = new MockHttpServletResponse();
        chain = new MockFilterChain();
    }

    private void invokeFilter() throws Exception {
        filter.doFilterInternal(request, response, chain);
    }

    @Nested
    @DisplayName("Standard headers")
    class StandardHeaders {
        @Test
        @DisplayName("are present on a normal response")
        void standardHeadersArePresent() throws Exception {
            invokeFilter();

            assertThat(response.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
            assertThat(response.getHeader("X-Frame-Options")).isEqualTo("DENY");
            assertThat(response.getHeader("X-XSS-Protection")).isEqualTo("0");
            assertThat(response.getHeader("Referrer-Policy"))
                    .isEqualTo("strict-origin-when-cross-origin");
            assertThat(response.getHeader("Permissions-Policy"))
                    .isEqualTo("geolocation=(), microphone=(), camera=(), payment=()");
        }

        @Test
        @DisplayName("the request is always passed down the chain")
        void chainIsAlwaysInvoked() throws Exception {
            invokeFilter();

            assertThat(chain.getRequest()).isSameAs(request);
            assertThat(chain.getResponse()).isSameAs(response);
        }
    }

    @Nested
    @DisplayName("Content-Security-Policy")
    class ContentSecurityPolicy {
        @Test
        @DisplayName("is present and restricts default sources to self")
        void cspIsPresentAndRestrictive() throws Exception {
            invokeFilter();

            var csp = response.getHeader("Content-Security-Policy");
            assertThat(csp).isNotBlank();
            assertThat(csp).contains("default-src 'self'");
            assertThat(csp).contains("object-src 'none'");
            assertThat(csp).contains("frame-ancestors 'none'");
        }
    }

    @Nested
    @DisplayName("Strict-Transport-Security")
    class StrictTransportSecurity {
        @Test
        @DisplayName("is emitted when the request arrived over a secure channel")
        void isEmittedWhenSecure() throws Exception {
            request.setSecure(true);

            invokeFilter();

            assertThat(response.getHeader("Strict-Transport-Security"))
                    .isEqualTo("max-age=31536000; includeSubDomains");
        }

        @Test
        @DisplayName("is absent when the request did not arrive over HTTPS")
        void isAbsentWhenNotSecure() throws Exception {
            request.setSecure(false);

            invokeFilter();

            assertThat(response.getHeader("Strict-Transport-Security")).isNull();
        }
    }

    @Nested
    @DisplayName("Cache-Control")
    class CacheControl {
        @Test
        @DisplayName("API responses are marked non-cacheable")
        void apiResponsesAreNotCached() throws Exception {
            request.setRequestURI("/api/projects");

            invokeFilter();

            assertThat(response.getHeader("Cache-Control"))
                    .isEqualTo("no-store, no-cache, must-revalidate, private");
            assertThat(response.getHeader("Pragma")).isEqualTo("no-cache");
        }

        @Test
        @DisplayName("non-API responses carry no cache directive from this filter")
        void nonApiResponsesAreLeftAlone() throws Exception {
            request.setRequestURI("/uploads/image.png");

            invokeFilter();

            assertThat(response.getHeader("Cache-Control")).isNull();
            assertThat(response.getHeader("Pragma")).isNull();
        }
    }
}
