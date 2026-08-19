package com.backend.exception;

/**
 * The caller is not authenticated: no credentials, or credentials that are no longer valid.
 *
 * <p>Distinct from {@link AuthorizationException}, which means the caller is authenticated but may
 * not perform the action. Maps to 401, matching what {@code JwtAuthenticationFilter} writes for the
 * equivalent case; a refresh token that is missing, expired or replayed belongs here.
 */
public class UnauthenticatedException extends RuntimeException {
    public UnauthenticatedException(String message) {
        super(message);
    }
}
