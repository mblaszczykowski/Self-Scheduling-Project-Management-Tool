package com.backend.web;

import com.backend.exception.AuthorizationException;
import com.backend.services.TokenService;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

@Component
public class CurrentUserIdArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentUserId.class)
                && Integer.class.isAssignableFrom(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter,
                                  ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest,
                                  WebDataBinderFactory binderFactory) {
        var userId = webRequest.getAttribute(TokenService.USER_ID_ATTRIBUTE,
                RequestAttributes.SCOPE_REQUEST);
        if (userId == null) {
            // Only reachable if an endpoint is added to the JWT exemption list but still asks
            // for the current user — a wiring mistake, not a client error.
            throw new AuthorizationException("User not authenticated");
        }
        return userId;
    }
}
