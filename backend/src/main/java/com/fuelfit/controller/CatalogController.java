package com.fuelfit.controller;
import com.fuelfit.service.CatalogService;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
@RestController @Profile("!dev") @RequestMapping("/api")
public class CatalogController {
 private final CatalogService catalog;
 public CatalogController(CatalogService catalog){this.catalog=catalog;}
 @GetMapping("/categories") public List<Map<String,Object>> categories(){return catalog.categories();}
 @GetMapping("/products/{id}") public Map<String,Object> detail(@PathVariable String id){return catalog.detail(id,false);}
 @GetMapping("/products") public Map<String,Object> products(
 @RequestParam(defaultValue="") String q,@RequestParam(defaultValue="") String category,
 @RequestParam(required=false) BigDecimal minPrice,@RequestParam(required=false) BigDecimal maxPrice,
 @RequestParam(required=false) Boolean inStock,@RequestParam(defaultValue="featured") String sort,
 @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="24") int size) {
 return catalog.list(q,category,minPrice,maxPrice,inStock,sort,page,size,false);
 }
}
