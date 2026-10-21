package com.fuelfit;

import com.fuelfit.dto.CommerceInput.*;
import com.fuelfit.service.CommerceService;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:commerce_tests;MODE=MySQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc @ActiveProfiles("test") @TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CommerceIntegrationTests {
    @Autowired JdbcTemplate db;
    @Autowired CommerceService commerce;
    @Autowired MockMvc mvc;
    final tools.jackson.databind.ObjectMapper json=new tools.jackson.databind.ObjectMapper();
    static final String ALICE="alice@example.test", BOB="bob@example.test";
    static final Address ADDRESS=new Address("Test Athlete","9876543210","1 Test Road","","Pune","Maharashtra","411001","IN");
    @BeforeAll void schema() {
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V2__create_catalog.sql"),new ClassPathResource("db/migration/V3__seed_existing_catalog.sql"),new ClassPathResource("db/migration/V4__commerce.sql"))
            .execute(Objects.requireNonNull(db.getDataSource()));
        for(String email:List.of(ALICE,BOB)) db.update("INSERT INTO users(name,email,password_hash,role) VALUES ('Test',?,'test-only-not-a-login-hash','CUSTOMER')",email);
    }
    @BeforeEach void reset() {
        for(String table:List.of("order_items","orders","cart_merges","cart_items","carts","addresses","wishlist_items","newsletter_subscribers"))db.update("DELETE FROM "+table);
        db.update("UPDATE products SET active=TRUE,price=2999 WHERE id='a1'");
        db.update("UPDATE inventory SET quantity=10,version=0");
    }
    Item item(int qty) {return new Item("a1","M","Black",qty);}
    long v(String email) {return ((Number)commerce.cart(email).get("version")).longValue();}
    void cart(String email,int qty) {commerce.replaceCart(email,new Cart(v(email),List.of(item(qty))));}
    Place request(String email) {
        long version=v(email);var quote=commerce.quote(email,new Quote(version,ADDRESS));
        return new Place(version,ADDRESS,(String)quote.get("quoteToken"),UUID.randomUUID().toString());
    }
    Map<String,Object> order(String email,int qty) {cart(email,qty);return commerce.place(email,request(email));}
    @Test void cartIsAccountOwnedAndServerPricesShippingAreAuthoritative() {
        cart(ALICE,2);var cart=commerce.cart(ALICE);
        assertThat(cart.get("subtotal").toString()).isEqualTo("5998.00");
        assertThat(cart.get("shipping").toString()).isEqualTo("299.00");
        assertThat((List<?>)commerce.cart(BOB).get("items")).isEmpty();
        cart(ALICE,3);assertThat(commerce.cart(ALICE).get("shipping").toString()).isEqualTo("0.00");
    }
    @Test void invalidOptionsStockAndDuplicatesRollbackCart() {
        cart(ALICE,1);
        for(var list:List.of(List.of(new Item("a1","invalid","Black",1)),List.of(item(11)),List.of(item(1),item(1)))) {
            assertThatThrownBy(()->commerce.replaceCart(ALICE,new Cart(v(ALICE),list))).isInstanceOf(RuntimeException.class);
            assertThat((List<?>)commerce.cart(ALICE).get("items")).hasSize(1);
        }
    }
    @Test void staleCartVersionCannotOverwriteNewerCart() {
        long before=v(ALICE);cart(ALICE,1);
        assertThatThrownBy(()->commerce.replaceCart(ALICE,new Cart(before,List.of()))).hasMessageContaining("409");
    }
    @Test void unavailableLinesCanBeRemovedOneAtATimeWithoutAcceptingNewUnavailableItems() {
        var second=new Item("a1","L","Black",1);
        commerce.replaceCart(ALICE,new Cart(v(ALICE),List.of(item(1),second)));
        db.update("UPDATE products SET active=FALSE WHERE id='a1'");
        commerce.replaceCart(ALICE,new Cart(v(ALICE),List.of(second)));
        assertThat((List<?>)commerce.cart(ALICE).get("items")).hasSize(1);
        assertThat(commerce.cart(ALICE).get("available")).isEqualTo(false);
        assertThatThrownBy(()->commerce.replaceCart(ALICE,new Cart(v(ALICE),List.of(second,item(1))))).hasMessageContaining("409");
        commerce.replaceCart(ALICE,new Cart(v(ALICE),List.of()));
        assertThat((List<?>)commerce.cart(ALICE).get("items")).isEmpty();
    }
    @Test void guestMergeIsExactlyOnceAndInvalidImportKeepsExistingCart() {
        cart(ALICE,1);var merge=new Merge(UUID.randomUUID().toString(),List.of(item(2)));
        commerce.merge(ALICE,merge);commerce.merge(ALICE,merge);
        assertThat(commerce.cart(ALICE).get("subtotal").toString()).isEqualTo("8997.00");
        assertThatThrownBy(()->commerce.merge(ALICE,new Merge(UUID.randomUUID().toString(),List.of(item(20))))).hasMessageContaining("409");
        assertThat(commerce.cart(ALICE).get("subtotal").toString()).isEqualTo("8997.00");
    }
    @Test void orderSnapshotsPricesAddressAndConsumesCartExactlyOnce() {
        cart(ALICE,2);Place input=request(ALICE);
        var first=commerce.place(ALICE,input);var retry=commerce.place(ALICE,input);
        assertThat(retry.get("id")).isEqualTo(first.get("id"));
        assertThat(db.queryForObject("SELECT COUNT(*) FROM orders",Integer.class)).isOne();
        assertThat(db.queryForObject("SELECT quantity FROM inventory WHERE product_id='a1'",Integer.class)).isEqualTo(8);
        assertThat((List<?>)commerce.cart(ALICE).get("items")).isEmpty();
        db.update("UPDATE products SET name='Changed name',price=5000 WHERE id='a1'");
        var snapshot=commerce.order(ALICE,(String)first.get("id"),false);
        assertThat(snapshot.get("total").toString()).isEqualTo("6297.00");
        assertThat(((Map<?,?>)((List<?>)snapshot.get("items")).getFirst()).get("name")).isEqualTo("Pro Performance Tee");
        db.update("UPDATE products SET name='Pro Performance Tee' WHERE id='a1'");
    }
    @Test void priceChangeRequiresNewQuoteAndDoesNotDeductStock() {
        cart(ALICE,1);Place input=request(ALICE);db.update("UPDATE products SET price=1 WHERE id='a1'");
        assertThatThrownBy(()->commerce.place(ALICE,input)).hasMessageContaining("409");
        assertThat(db.queryForObject("SELECT COUNT(*) FROM orders",Integer.class)).isZero();
        assertThat(db.queryForObject("SELECT quantity FROM inventory WHERE product_id='a1'",Integer.class)).isEqualTo(10);
    }
    @Test void quoteRejectsEmptyCartAndStockChangesAtPlacement() {
        assertThatThrownBy(()->commerce.quote(ALICE,new Quote(v(ALICE),ADDRESS))).hasMessageContaining("409");
        cart(ALICE,2);Place input=request(ALICE);db.update("UPDATE inventory SET quantity=1 WHERE product_id='a1'");
        assertThatThrownBy(()->commerce.place(ALICE,input)).hasMessageContaining("409");
        assertThat(db.queryForObject("SELECT COUNT(*) FROM orders",Integer.class)).isZero();
    }
    @Test void retryKeyCannotBeReusedWithDifferentAddress() {
        cart(ALICE,1);Place input=request(ALICE);commerce.place(ALICE,input);
        var other=new Address("Other","9876543210","2 Other Road","","Pune","Maharashtra","411001","IN");
        assertThatThrownBy(()->commerce.place(ALICE,new Place(input.cartVersion(),other,input.quoteToken(),input.idempotencyKey()))).hasMessageContaining("409");
    }
    @Test void orderOwnershipAndSafeCancellationRestocksOnlyOnce() {
        String id=(String)order(ALICE,2).get("id");
        assertThatThrownBy(()->commerce.order(BOB,id,false)).hasMessageContaining("404");
        assertThatThrownBy(()->commerce.status(BOB,id,"CANCELLED",false)).hasMessageContaining("404");
        commerce.status(ALICE,id,"CANCELLED",false);commerce.status(ALICE,id,"CANCELLED",false);
        assertThat(db.queryForObject("SELECT quantity FROM inventory WHERE product_id='a1'",Integer.class)).isEqualTo(10);
    }
    @Test void adminStatusMachineAndCodCollection() {
        String id=(String)order(ALICE,1).get("id");
        assertThatThrownBy(()->commerce.status("admin",id,"DELIVERED",true)).hasMessageContaining("409");
        commerce.status("admin",id,"CONFIRMED",true);commerce.status("admin",id,"SHIPPED",true);
        assertThatThrownBy(()->commerce.status(ALICE,id,"CANCELLED",false)).hasMessageContaining("409");
        assertThat(commerce.status("admin",id,"DELIVERED",true).get("paymentStatus")).isEqualTo("COLLECTED");
    }
    @Test void simultaneousBuyersCannotOversellLastUnit() throws Exception {
        db.update("UPDATE inventory SET quantity=1 WHERE product_id='a1'");cart(ALICE,1);cart(BOB,1);
        Place a=request(ALICE),b=request(BOB);var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var jobs=List.of(pool.submit(()->{start.await();try{commerce.place(ALICE,a);return true;}catch(RuntimeException ex){return false;}}),
                pool.submit(()->{start.await();try{commerce.place(BOB,b);return true;}catch(RuntimeException ex){return false;}}));start.countDown();
            assertThat(jobs.stream().map(f->{try{return f.get(15,TimeUnit.SECONDS);}catch(Exception ex){throw new RuntimeException(ex);}}).filter(Boolean::booleanValue).count()).isEqualTo(1);
        }
        assertThat(db.queryForObject("SELECT quantity FROM inventory WHERE product_id='a1'",Integer.class)).isZero();
        assertThat(db.queryForObject("SELECT COUNT(*) FROM orders",Integer.class)).isOne();
    }
    @Test void addressesAndWishlistAreOwnedAndWishlistPutIsIdempotent() {
        String id=commerce.saveAddress(ALICE,null,ADDRESS).get("id");
        assertThat(commerce.addresses(BOB)).isEmpty();
        assertThatThrownBy(()->commerce.deleteAddress(BOB,id)).hasMessageContaining("404");
        assertThatThrownBy(()->commerce.saveAddress(BOB,id,ADDRESS)).hasMessageContaining("404");
        commerce.wishlist(ALICE,"a1",true);commerce.wishlist(ALICE,"a1",true);
        assertThat(commerce.wishlist(ALICE)).hasSize(1);assertThat(commerce.wishlist(BOB)).isEmpty();
        commerce.deleteAddress(ALICE,id);assertThat(commerce.addresses(ALICE)).isEmpty();
    }
    @Test void newsletterNormalizesDeduplicatesAndSupportsOptOut() {
        commerce.newsletter(new Newsletter("Athlete@Example.test",true));commerce.newsletter(new Newsletter("athlete@example.test",true));
        assertThat(db.queryForObject("SELECT COUNT(*) FROM newsletter_subscribers",Integer.class)).isOne();
        commerce.unsubscribe("athlete@example.test");assertThat(db.queryForObject("SELECT subscribed FROM newsletter_subscribers",Boolean.class)).isFalse();
    }
    @Test void securityCsrfValidationAndOwnershipAtHttpBoundary() throws Exception {
        for(String route:List.of("/api/cart","/api/orders","/api/addresses","/api/wishlist")) mvc.perform(get(route)).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/cart").with(user(ALICE)).contentType("application/json").content("{\"version\":0,\"items\":[]}")).andExpect(status().isForbidden());
        mvc.perform(put("/api/cart").with(user(ALICE)).with(csrf()).contentType("application/json").content("{\"version\":0,\"items\":[{\"productId\":\"a1\",\"size\":\"M\",\"color\":\"Black\",\"quantity\":0}]}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/admin/orders").with(user(ALICE).roles("CUSTOMER"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/newsletter/subscriptions").with(csrf()).contentType("application/json").content("{\"email\":\"test@example.test\",\"consent\":false}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/newsletter/subscriptions").with(csrf()).contentType("application/json").content("{\"email\":\"test@example.test\",\"consent\":true}"))
            .andExpect(status().isOk());
        mvc.perform(post("/api/orders").with(user(ALICE)).with(csrf()).contentType("application/json").content("{\"total\":1}"))
            .andExpect(status().isBadRequest());
    }
    @Test void fullHttpCheckoutAndOrderEndpoints() throws Exception {
        cart(ALICE,1);Place input=request(ALICE);
        String result=mvc.perform(post("/api/orders").with(user(ALICE)).with(csrf()).contentType("application/json").content(json.writeValueAsString(input)))
            .andExpect(status().isCreated()).andExpect(jsonPath("paymentMethod").value("COD")).andReturn().getResponse().getContentAsString();
        String id=json.readTree(result).get("id").asText();
        mvc.perform(get("/api/orders/"+id).with(user(BOB))).andExpect(status().isNotFound());
        mvc.perform(get("/api/orders").with(user(ALICE))).andExpect(status().isOk()).andExpect(jsonPath("total").value(1));
        mvc.perform(get("/api/health")).andExpect(status().isOk());
    }
}
