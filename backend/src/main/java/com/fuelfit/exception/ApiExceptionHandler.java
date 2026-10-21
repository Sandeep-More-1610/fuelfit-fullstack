package com.fuelfit.exception;

import com.fuelfit.dto.ApiError;
import java.util.LinkedHashMap;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validation(MethodArgumentNotValidException ex) {
        var fields = new LinkedHashMap<String, String>();
        ex.getBindingResult().getFieldErrors().forEach(e -> fields.putIfAbsent(e.getField(), e.getDefaultMessage()));
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", "Check the submitted fields", fields));
    }
    @ExceptionHandler(DuplicateEmailException.class)
    ResponseEntity<ApiError> duplicate() {
        return ResponseEntity.status(409).body(new ApiError("EMAIL_UNAVAILABLE", "An account with this email already exists"));
    }
    @ExceptionHandler({BadCredentialsException.class, UsernameNotFoundException.class})
    ResponseEntity<ApiError> credentials() {
        return ResponseEntity.status(401).body(new ApiError("INVALID_CREDENTIALS", "Invalid email or password"));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, IllegalArgumentException.class})
    ResponseEntity<ApiError> malformed() {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "Invalid request body or parameter"));
    }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ApiError> database() {
        return ResponseEntity.status(503).body(new ApiError("SERVICE_UNAVAILABLE", "Please try again later"));
    }
    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> missing() {
        return ResponseEntity.status(404).body(new ApiError("NOT_FOUND", "Resource not found"));
    }
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiError> method() {
        return ResponseEntity.status(405).body(new ApiError("METHOD_NOT_ALLOWED", "HTTP method not supported"));
    }
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    ResponseEntity<ApiError> status(org.springframework.web.server.ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(new ApiError("CATALOG_ERROR", ex.getReason()));
    }
    @ExceptionHandler({org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
            org.springframework.web.bind.MissingServletRequestParameterException.class})
    ResponseEntity<ApiError> parameters(Exception ex) { return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "Invalid query parameter")); }
    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected() {
        return ResponseEntity.internalServerError().body(new ApiError("INTERNAL_ERROR", "Unable to process the request"));
    }
}
