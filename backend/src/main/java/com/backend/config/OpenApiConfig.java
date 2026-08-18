package com.backend.config;

import com.backend.web.CurrentUserId;
import org.springdoc.core.customizers.ParameterCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public ParameterCustomizer hideCurrentUserIdParameter() {
        return (parameterModel, methodParameter) ->
                methodParameter.hasParameterAnnotation(CurrentUserId.class) ? null : parameterModel;
    }
}
