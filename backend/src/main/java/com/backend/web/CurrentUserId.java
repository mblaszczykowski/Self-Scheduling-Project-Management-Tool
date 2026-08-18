package com.backend.web;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Injects the authenticated user's id into a controller method.
 *
 * <p>Replaces the {@code tokenService.getUserIdFromRequest(request)} preamble that every
 * controller method used to open with, and with it the {@code HttpServletRequest} parameter
 * that existed only to be passed to it. The request attribute is written by
 * {@code JwtAuthenticationFilter}, which rejects unauthenticated requests before any handler
 * runs — so a resolved value is always present and always trustworthy.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface CurrentUserId {
}
