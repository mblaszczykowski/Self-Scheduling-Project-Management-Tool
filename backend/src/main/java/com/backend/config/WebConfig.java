package com.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AppProperties appProperties;

    public WebConfig(AppProperties appProperties) {
        this.appProperties = appProperties;
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
                // Set-Cookie is applied by the browser automatically and is not script-readable,
                // so it does not belong in exposedHeaders.
                .exposedHeaders("X-CSRF-Token", "Cache-Control", "Content-Type")
                .allowCredentials(true)
                .maxAge(600);
    }
}
