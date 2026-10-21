package com.fuelfit.dto;

/** The JSON fields returned by the health endpoint. */
public record HealthResponse(String status, String message) {
}
