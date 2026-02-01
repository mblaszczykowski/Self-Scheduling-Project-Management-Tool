package com.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origin:http://localhost:3000}")
    private String allowedOrigin;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(allowedOrigin)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                // Restrict to specific headers instead of wildcard for security
                .allowedHeaders(
                        "Content-Type",
                        "Accept",
                        "X-Requested-With",
                        "Cache-Control",
                        "X-CSRF-Token"
                )
                .exposedHeaders("Set-Cookie", "X-CSRF-Token")
                .allowCredentials(true)
                .maxAge(600); // Reduced to 10 minutes
    }
}
