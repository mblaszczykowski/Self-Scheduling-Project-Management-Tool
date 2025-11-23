package com.backend.requests;

public record UserRegistrationRequest(
        String firstname,
        String lastname,
        String email,
        String password
) {
}
