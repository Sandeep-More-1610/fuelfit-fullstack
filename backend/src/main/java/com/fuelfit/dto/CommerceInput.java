package com.fuelfit.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

/** Only client-editable fields are accepted; prices and account IDs come from the server. */
public final class CommerceInput {
    private CommerceInput() { }
    public record Item(@NotBlank @Size(max=40) String productId,
            @NotNull @Size(max=100) String size, @NotNull @Size(max=100) String color,
            @NotNull @Min(1) @Max(99) Integer quantity) { }
    public record Cart(@NotNull @Min(0) Long version,
            @NotNull @Size(max=50) List<@NotNull @Valid Item> items) { }
    public record Merge(@NotBlank @Pattern(regexp="[a-fA-F0-9-]{36}") String mergeKey,
            @NotNull @Size(max=50) List<@NotNull @Valid Item> items) { }
    public record Address(@NotBlank @Size(max=100) String name,
            @NotBlank @Pattern(regexp="[+0-9 ()-]{7,20}") String phone,
            @NotBlank @Size(max=200) String line1, @NotNull @Size(max=200) String line2,
            @NotBlank @Size(max=100) String city, @NotBlank @Size(max=100) String state,
            @NotBlank @Pattern(regexp="[1-9][0-9]{5}") String postalCode,
            @NotNull @Pattern(regexp="IN") String country) { }
    public record Quote(@NotNull @Min(0) Long cartVersion, @NotNull @Valid Address address) { }
    public record Place(@NotNull @Min(0) Long cartVersion, @NotNull @Valid Address address,
            @NotBlank @Pattern(regexp="[a-f0-9]{64}") String quoteToken,
            @NotBlank @Pattern(regexp="[a-fA-F0-9-]{36}") String idempotencyKey) { }
    public record Status(@NotBlank @Pattern(regexp="CONFIRMED|SHIPPED|DELIVERED|CANCELLED") String status) { }
    public record Newsletter(@NotBlank @Email @Size(max=254) String email,
            @NotNull @AssertTrue(message="Consent is required") Boolean consent) { }
    public record Category(@NotBlank @Pattern(regexp="[a-z0-9-]{1,40}") String id,
            @NotBlank @Size(max=100) String name, @NotBlank @Size(max=500) String description) { }
}
