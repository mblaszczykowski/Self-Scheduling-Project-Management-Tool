package com.backend.config;

import com.backend.web.CurrentUserIdArgumentResolver;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.core.Ordered;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final AppProperties appProperties;
    private final CurrentUserIdArgumentResolver currentUserIdArgumentResolver;

    public WebConfig(AppProperties appProperties,
                     CurrentUserIdArgumentResolver currentUserIdArgumentResolver) {
        this.appProperties = appProperties;
        this.currentUserIdArgumentResolver = currentUserIdArgumentResolver;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentUserIdArgumentResolver);
    }

    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilterRegistration() {
        var cors = new CorsConfiguration();
        cors.setAllowedOrigins(appProperties.getCors().getAllowedOrigins());
        cors.setAllowedMethods(List.of("GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        cors.setAllowedHeaders(List.of("Content-Type", "Accept", "Authorization", "X-Requested-With",
                "Cache-Control", "X-CSRF-Token", "Last-Event-ID"));
        cors.setExposedHeaders(List.of("Cache-Control", "Content-Type", "Retry-After", "Content-Disposition"));
        cors.setAllowCredentials(true);
        cors.setMaxAge(600L);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        var registration = new FilterRegistrationBean<>(new CorsFilter(source));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
        return registration;
    }
}
