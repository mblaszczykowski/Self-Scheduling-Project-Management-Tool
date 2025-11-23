package com.backend.responses;

public class ApiResponse<T> {

    private boolean success;
    private T data;
    private String error;

    public ApiResponse(boolean success, T data) {
        this.success = success;
        this.data = data;
    }

    public ApiResponse(boolean success, String error) {
        this.success = success;
        this.error = error;
    }

    // Getters and Setters
}
