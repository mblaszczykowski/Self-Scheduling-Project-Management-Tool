package com.backend.filter;

import com.backend.config.AppProperties;
import com.backend.config.CookieProperties;
import com.backend.config.JwtProperties;
import com.backend.config.WebConfig;
import com.backend.services.RateLimitService;
import com.backend.services.TokenService;
import com.backend.web.CookieFactory;
import com.backend.web.CurrentUserIdArgumentResolver;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServlet;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class SecurityFilterChainTest {
    private final AppProperties app = new AppProperties();
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    private MockFilterChain chain() {
        var jwt = new JwtProperties("unit-test-secret-at-least-32-characters", Duration.ofMinutes(15),
                Duration.ofDays(7), Duration.ofSeconds(30), "issuer", "audience");
        var config = new WebConfig(app, new CurrentUserIdArgumentResolver());
        return new MockFilterChain(new HttpServlet() {}, new SecurityHeadersFilter(),
                config.corsFilterRegistration().getFilter(),
                new RateLimitFilter(mapper, new RateLimitService(app)),
                new CsrfProtectionFilter(mapper, new CookieFactory(new CookieProperties()), jwt),
                new JwtAuthenticationFilter(mock(TokenService.class), mapper));
    }

    @Test
    void unauthenticatedSafeRequestsStillBootstrapCsrfAndExposeThe401ThroughCors() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/users/me");
        request.addHeader("Origin", "http://localhost:3000");
        var response = new MockHttpServletResponse();
        chain().doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getHeader("Access-Control-Allow-Origin")).isEqualTo("http://localhost:3000");
        assertThat(response.getHeaders("Set-Cookie")).anyMatch(value -> value.startsWith("XSRF-TOKEN="));
    }

    @Test
    void csrfErrorsAreVisibleToAllowedOriginsAndForeignOriginsAreRejectedBeforeAuthentication() throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/projects");
        request.addHeader("Origin", "http://localhost:3000");
        var response = new MockHttpServletResponse();
        chain().doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getHeader("Access-Control-Allow-Origin")).isEqualTo("http://localhost:3000");
        assertThat(response.getContentAsString()).contains("CSRF_ERROR");

        var foreign = new MockHttpServletRequest("GET", "/api/users/me");
        foreign.addHeader("Origin", "https://attacker.example");
        var rejected = new MockHttpServletResponse();
        chain().doFilter(foreign, rejected);
        assertThat(rejected.getStatus()).isEqualTo(403);
        assertThat(rejected.getHeader("Access-Control-Allow-Origin")).isNull();
    }

    @Test
    void allowsBearerAndCsrfHeadersInCorsPreflight() throws Exception {
        var request = new MockHttpServletRequest("OPTIONS", "/api/projects");
        request.addHeader("Origin", "http://localhost:3000");
        request.addHeader("Access-Control-Request-Method", "POST");
        request.addHeader("Access-Control-Request-Headers", "Authorization,X-CSRF-Token");
        var response = new MockHttpServletResponse();
        chain().doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getHeader("Access-Control-Allow-Headers")).contains("Authorization", "X-CSRF-Token");
    }
}
