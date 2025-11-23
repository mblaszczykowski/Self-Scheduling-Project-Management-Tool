package com.backend.exception;

public class ApiError {
    private String type;
    private String field;
    private String message;

    public ApiError(String type, String field, String message) {
        this.type = type;
        this.field = field;
        this.message = message;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getField() {
        return field;
    }

    public void setField(String field) {
        this.field = field;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
