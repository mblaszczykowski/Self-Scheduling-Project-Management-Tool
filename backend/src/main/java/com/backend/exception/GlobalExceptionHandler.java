package com.backend.exception;

import com.backend.dtos.ApiError;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiError> handleValidation(ValidationException ex) {
        return build(HttpStatus.BAD_REQUEST, "Validation Error", ex.getMessage());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, "Not Found", ex.getMessage());
    }

    @ExceptionHandler(UnauthenticatedException.class)
    public ResponseEntity<ApiError> handleUnauthenticated(UnauthenticatedException ex) {
        return build(HttpStatus.UNAUTHORIZED, "Unauthorized", ex.getMessage());
    }

    @ExceptionHandler(AuthorizationException.class)
    public ResponseEntity<ApiError> handleForbidden(AuthorizationException ex) {
        return build(HttpStatus.FORBIDDEN, "Forbidden", ex.getMessage());
    }

    @ExceptionHandler(TooManyAttemptsException.class)
    public ResponseEntity<ApiError> handleTooManyAttempts(TooManyAttemptsException ex) {
        return build(HttpStatus.TOO_MANY_REQUESTS, "Too Many Requests", ex.getMessage());
    }

    @ExceptionHandler(FileStorageException.class)
    public ResponseEntity<ApiError> handleFileStorage(FileStorageException ex) {
        log.error("File storage failure", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "File Error",
                "Could not process the file. Please try again.");
    }

    @ExceptionHandler(JsonProcessingException.class)
    public ResponseEntity<ApiError> handleJsonError(JsonProcessingException ex) {
        log.debug("Malformed JSON in request body: {}", ex.getOriginalMessage());
        return build(HttpStatus.BAD_REQUEST, "Invalid JSON", "Invalid request format");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return build(HttpStatus.BAD_REQUEST, "Invalid Parameter",
                "Invalid value for parameter: " + ex.getName());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException ex) {
        var fieldErrors = ex.getConstraintViolations().stream()
                .map(v -> new ApiError.FieldError(lastPathNode(v.getPropertyPath().toString()),
                        v.getMessage()))
                .toList();
        return ResponseEntity.badRequest().body(ApiError.withFieldErrors(
                HttpStatus.BAD_REQUEST.value(), "Validation Failed", "Invalid request data", fieldErrors));
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiError> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        return build(HttpStatus.CONFLICT, "Conflict",
                "This item was modified by someone else. Please reload and try again.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        log.warn("Constraint violation on write: {}", ex.getMostSpecificCause().getMessage());
        return build(HttpStatus.CONFLICT, "Conflict",
                "That change conflicts with existing data. Please reload and try again.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex) {
        log.error("Unexpected error", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Error",
                "An unexpected error occurred");
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
                                                                  HttpHeaders headers,
                                                                  HttpStatusCode status,
                                                                  WebRequest request) {
        var fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new ApiError.FieldError(fe.getField(), fe.getDefaultMessage()))
                .toList();
        return ResponseEntity.badRequest().body(ApiError.withFieldErrors(
                HttpStatus.BAD_REQUEST.value(), "Validation Failed", "Invalid request data", fieldErrors));
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex,
                                                            Object body,
                                                            HttpHeaders headers,
                                                            HttpStatusCode statusCode,
                                                            WebRequest request) {
        var status = HttpStatus.valueOf(statusCode.value());
        String message;
        if (status.is5xxServerError()) {
            log.error("Framework error handling {}", request.getDescription(false), ex);
            message = "An unexpected error occurred";
        } else {
            log.debug("Request rejected ({}): {}", status, ex.getMessage());
            message = body instanceof ProblemDetail detail && detail.getDetail() != null
                    ? detail.getDetail()
                    : status.getReasonPhrase();
        }
        return ResponseEntity.status(status).headers(headers)
                .body(ApiError.of(status.value(), status.getReasonPhrase(), message));
    }

    private static ResponseEntity<ApiError> build(HttpStatus status, String error, String message) {
        return ResponseEntity.status(status).body(ApiError.of(status.value(), error, message));
    }

    private static String lastPathNode(String propertyPath) {
        var idx = propertyPath.lastIndexOf('.');
        return idx >= 0 ? propertyPath.substring(idx + 1) : propertyPath;
    }
}
