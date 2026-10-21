package com.fuelfit.dto;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
public record ProductInput(
 @NotBlank @Size(max=150) String name,
 @NotBlank @Pattern(regexp="[a-z0-9-]{1,40}") String category,
 @NotBlank @Size(max=4000) String description,
 @NotNull @DecimalMin("0.00") @DecimalMax("9999999999.99") @Digits(integer=10,fraction=2) BigDecimal price,
 @NotBlank @Size(max=1500) @Pattern(regexp="https://[^\\s<>\"']+") String image,
 @NotNull @Size(max=30) List<@NotNull @NotBlank @Size(max=60) String> sizes,
 @NotNull @Size(max=30) List<@NotNull @NotBlank @Size(max=60) String> colors,
 boolean featured, boolean active, @NotNull @Min(0) Long version) {
 @AssertTrue(message="Image must be an HTTPS URL with a valid host and no embedded credentials")
 public boolean isImageUrlValid() {
  if(image==null || image.isBlank()) return true; // NotBlank reports this separately.
  try {
   var uri=java.net.URI.create(image);
   return "https".equals(uri.getScheme()) && uri.getHost()!=null
     && uri.getRawUserInfo()==null && uri.getPort()>=-1 && uri.getPort()<=65535;
  } catch(IllegalArgumentException ex) { return false; }
 }
}
