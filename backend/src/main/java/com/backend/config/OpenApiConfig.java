package com.backend.config;

import com.backend.web.CurrentUserId;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springdoc.core.customizers.ParameterCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.MethodParameter;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.web.method.HandlerMethod;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Configuration
public class OpenApiConfig {
    private static final ParameterNameDiscoverer PARAMETER_NAMES = new DefaultParameterNameDiscoverer();

    @Bean
    public OpenAPI apiMetadata() {
        return new OpenAPI().servers(List.of(new Server().url("/").description("API on the current origin")))
                .info(new Info().title("FlowLink API").description(
                "Protected operations require the accessToken cookie or a Bearer access token. "
                + "Unsafe operations also require the XSRF-TOKEN cookie echoed in X-CSRF-Token. "
                + "A safe GET /api/users/me issues the CSRF cookie even when it returns 401."))
                .components(new Components()
                        .addSecuritySchemes("cookieAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.COOKIE).name("accessToken"))
                        .addSecuritySchemes("bearerAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT"))
                        .addSecuritySchemes("csrfToken", new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.HEADER).name("X-CSRF-Token")));
    }

    @Bean
    public OpenApiCustomizer documentSecurityRequirements() {
        return api -> api.getPaths().forEach((path, item) -> item.readOperationsMap().forEach((method, operation) -> {
            String verb = method.name();
            boolean authenticated = !PublicEndpoints.isPublicForJwt(path, verb);
            boolean csrf = !Set.of("GET", "HEAD", "OPTIONS", "TRACE").contains(verb)
                    && !PublicEndpoints.isCsrfExempt(path, verb);
            if (authenticated) {
                var cookie = new SecurityRequirement().addList("cookieAuth");
                var bearer = new SecurityRequirement().addList("bearerAuth");
                if (csrf) {
                    cookie.addList("csrfToken");
                    bearer.addList("csrfToken");
                }
                operation.setSecurity(List.of(cookie, bearer));
            } else {
                operation.setSecurity(csrf ? List.of(new SecurityRequirement().addList("csrfToken")) : List.of());
            }
        }));
    }

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
