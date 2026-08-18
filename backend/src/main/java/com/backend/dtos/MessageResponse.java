package com.backend.dtos;

/** A typed acknowledgement, so no endpoint has to fall back to an untyped map. */
public record MessageResponse(String message) {}
