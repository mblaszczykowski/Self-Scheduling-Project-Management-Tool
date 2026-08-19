package com.backend.config;

import com.backend.web.CurrentUserId;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springdoc.core.customizers.ParameterCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.MethodParameter;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.web.method.HandlerMethod;

import java.util.Arrays;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Configuration
public class OpenApiConfig {
    private static final ParameterNameDiscoverer PARAMETER_NAMES = new DefaultParameterNameDiscoverer();

    @Bean
    public ParameterCustomizer hideCurrentUserIdParameter() {
        return (parameterModel, methodParameter) ->
                methodParameter.hasParameterAnnotation(CurrentUserId.class) ? null : parameterModel;
    }

    @Bean
    public OperationCustomizer hideCurrentUserIdFromRequestBody() {
        return (operation, handlerMethod) -> {
            var names = currentUserIdParameterNames(handlerMethod);
            if (names.isEmpty() || operation.getRequestBody() == null
                    || operation.getRequestBody().getContent() == null) {
                return operation;
            }
            operation.getRequestBody().getContent().values().forEach(mediaType -> {
                var schema = mediaType.getSchema();
                if (schema == null || schema.getProperties() == null) {
                    return;
                }
                names.forEach(schema.getProperties()::remove);
                if (schema.getRequired() != null) {
                    schema.getRequired().removeAll(names);
                }
            });
            return operation;
        };
    }

    private static Set<String> currentUserIdParameterNames(HandlerMethod handlerMethod) {
        return Arrays.stream(handlerMethod.getMethodParameters())
                .filter(parameter -> parameter.hasParameterAnnotation(CurrentUserId.class))
                .map(parameter -> {
                    parameter.initParameterNameDiscovery(PARAMETER_NAMES);
                    return parameter.getParameterName();
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }
}
