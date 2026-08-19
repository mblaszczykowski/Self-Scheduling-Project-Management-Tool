package com.backend.config;

import com.backend.web.CurrentUserIdArgumentResolver;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
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

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(appProperties.getCors().getAllowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders(
                        "Content-Type",
                        "Accept",
                        "X-Requested-With",
                        "Cache-Control",
                        "X-CSRF-Token",
                        "Last-Event-ID"
                )
                .exposedHeaders("Cache-Control", "Content-Type")
                .allowCredentials(true)
                .maxAge(600);
    }
}
