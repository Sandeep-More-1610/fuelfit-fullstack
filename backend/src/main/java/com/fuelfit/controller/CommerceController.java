package com.fuelfit.controller;

import com.fuelfit.dto.CommerceInput.*;
import com.fuelfit.service.CommerceService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController @Profile("!dev") @RequestMapping("/api")
public class CommerceController {
    private final CommerceService service;
    public CommerceController(CommerceService service) {this.service=service;}
    @GetMapping("/cart") public Map<String,Object> cart(Principal p) {return service.cart(p.getName());}
    @PutMapping("/cart") public Map<String,Object> cart(Principal p,@Valid @RequestBody Cart input) {return service.replaceCart(p.getName(),input);}
    @PostMapping("/cart/merge") public Map<String,Object> merge(Principal p,@Valid @RequestBody Merge input) {return service.merge(p.getName(),input);}
    @PostMapping("/checkout/quote") public Map<String,Object> quote(Principal p,@Valid @RequestBody Quote input) {return service.quote(p.getName(),input);}
    @PostMapping("/orders") public ResponseEntity<Map<String,Object>> place(Principal p,@Valid @RequestBody Place input) {return ResponseEntity.status(201).body(service.place(p.getName(),input));}
    @GetMapping("/orders") public Map<String,Object> orders(Principal p,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="12") int size) {return service.orders(p.getName(),false,page,size);}
    @GetMapping("/orders/{id}") public Map<String,Object> order(Principal p,@PathVariable String id) {return service.order(p.getName(),id,false);}
    @PostMapping("/orders/{id}/cancel") public Map<String,Object> cancel(Principal p,@PathVariable String id) {return service.status(p.getName(),id,"CANCELLED",false);}
    @GetMapping("/addresses") public List<Map<String,Object>> addresses(Principal p) {return service.addresses(p.getName());}
    @PostMapping("/addresses") public ResponseEntity<Map<String,String>> address(Principal p,@Valid @RequestBody Address input) {return ResponseEntity.status(201).body(service.saveAddress(p.getName(),null,input));}
    @PutMapping("/addresses/{id}") public Map<String,String> address(Principal p,@PathVariable String id,@Valid @RequestBody Address input) {return service.saveAddress(p.getName(),id,input);}
    @DeleteMapping("/addresses/{id}") public ResponseEntity<Void> deleteAddress(Principal p,@PathVariable String id) {service.deleteAddress(p.getName(),id);return ResponseEntity.noContent().build();}
    @GetMapping("/wishlist") public List<Map<String,Object>> wishlist(Principal p) {return service.wishlist(p.getName());}
    @PutMapping("/wishlist/{id}") public ResponseEntity<Void> wish(Principal p,@PathVariable String id) {service.wishlist(p.getName(),id,true);return ResponseEntity.noContent().build();}
    @DeleteMapping("/wishlist/{id}") public ResponseEntity<Void> unwish(Principal p,@PathVariable String id) {service.wishlist(p.getName(),id,false);return ResponseEntity.noContent().build();}
    @PostMapping("/newsletter/subscriptions") public Map<String,String> subscribe(@Valid @RequestBody Newsletter input) {service.newsletter(input);return Map.of("message","Subscription saved. Email delivery is not configured.");}
    @DeleteMapping("/newsletter/subscriptions/me") public ResponseEntity<Void> unsubscribe(Principal p) {service.unsubscribe(p.getName());return ResponseEntity.noContent().build();}
    @GetMapping("/admin/orders") public Map<String,Object> adminOrders(Principal p,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="12") int size) {return service.orders(p.getName(),true,page,size);}
    @GetMapping("/admin/orders/{id}") public Map<String,Object> adminOrder(Principal p,@PathVariable String id) {return service.order(p.getName(),id,true);}
    @PutMapping("/admin/orders/{id}/status") public Map<String,Object> adminStatus(Principal p,@PathVariable String id,@Valid @RequestBody Status input) {return service.status(p.getName(),id,input.status(),true);}
    @PostMapping("/admin/categories") public ResponseEntity<Void> category(@Valid @RequestBody Category input) {service.category(input,true);return ResponseEntity.status(201).build();}
    @PutMapping("/admin/categories/{id}") public ResponseEntity<Void> category(@PathVariable String id,@Valid @RequestBody Category input) {if(!id.equals(input.id()))throw new IllegalArgumentException();service.category(input,false);return ResponseEntity.noContent().build();}
}
