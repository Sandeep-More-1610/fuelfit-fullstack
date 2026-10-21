package com.fuelfit.controller;
import com.fuelfit.dto.ProductInput;
import com.fuelfit.service.CatalogService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestController @Profile("!dev") @RequestMapping("/api/admin/products")
public class AdminCatalogController {
 private final CatalogService catalog;
 public AdminCatalogController(CatalogService catalog){this.catalog=catalog;}
 @GetMapping public Map<String,Object> list(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="24") int size){return catalog.list("","",null,null,null,"name",page,size,true);}
 @GetMapping("/{id}") public Map<String,Object> detail(@PathVariable String id){return catalog.detail(id,true);}
 @PostMapping public ResponseEntity<Map<String,Object>> create(@Valid @RequestBody ProductInput p){return ResponseEntity.status(201).body(catalog.create(p));}
 @PutMapping("/{id}") public Map<String,Object> update(@PathVariable String id,@Valid @RequestBody ProductInput p){return catalog.update(id,p);}
 @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable String id,@RequestParam long version){if(version<0)throw new IllegalArgumentException();catalog.archive(id,version);return ResponseEntity.noContent().build();}
 public record StockInput(@NotNull @Min(0) @Max(1000000000) Integer quantity,@NotNull @Min(0) Long version){}
 @PutMapping("/{id}/inventory") public Map<String,Object> stock(@PathVariable String id,@Valid @RequestBody StockInput p){return catalog.stock(id,p.quantity(),p.version());}
}
