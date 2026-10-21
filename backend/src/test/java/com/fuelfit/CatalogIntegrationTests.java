package com.fuelfit;

import com.fuelfit.service.CatalogService;
import com.fuelfit.config.AdminProvisioning;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CatalogIntegrationTests {
 @Autowired MockMvc mvc; @Autowired JdbcTemplate db; @Autowired CatalogService catalog; @Autowired TransactionTemplate tx;
 final tools.jackson.databind.ObjectMapper json=new tools.jackson.databind.ObjectMapper();
 @BeforeAll void schema() {
  new ResourceDatabasePopulator(new ClassPathResource("db/migration/V2__create_catalog.sql")).execute(Objects.requireNonNull(db.getDataSource()));
 }
 @BeforeEach void seed() {
  db.update("DELETE FROM inventory"); db.update("DELETE FROM products");db.update("DELETE FROM categories");
  new ResourceDatabasePopulator(new ClassPathResource("db/migration/V3__seed_existing_catalog.sql")).execute(Objects.requireNonNull(db.getDataSource()));
 }
 String input(long version) {return """
 {"name":"Test <Product>","category":"apparel","description":"Test description","price":123.45,
 "image":"https://images.pexels.com/test.jpg","sizes":["M"],"colors":["Black"],"featured":false,"active":true,"version":%d}
 """.formatted(version);}
 @Test void publicCatalogPreservesFifteenProductsAndCategories() throws Exception {
  mvc.perform(get("/api/products")).andExpect(status().isOk()).andExpect(jsonPath("total").value(15));
  mvc.perform(get("/api/categories")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3));
  mvc.perform(get("/api/products/a1")).andExpect(status().isOk()).andExpect(jsonPath("name").value("Pro Performance Tee"))
   .andExpect(jsonPath("price").value(2999)).andExpect(jsonPath("stock").value(0)).andExpect(jsonPath("sizes[0]").value("XS"));
 }
 @Test void searchCategoryPricesSortAndPagination() throws Exception {
  mvc.perform(get("/api/products").param("q","protein")).andExpect(status().isOk()).andExpect(jsonPath("total").value(3));
  mvc.perform(get("/api/products").param("category","apparel").param("minPrice","3000").param("maxPrice","5500").param("sort","price-low").param("size","2"))
   .andExpect(status().isOk()).andExpect(jsonPath("total").value(3)).andExpect(jsonPath("items[0].id").value("a5")).andExpect(jsonPath("items.length()").value(2));
  mvc.perform(get("/api/products").param("page","1").param("size","12")).andExpect(status().isOk()).andExpect(jsonPath("items.length()").value(3));
  mvc.perform(get("/api/products").param("q","%_")).andExpect(status().isOk()).andExpect(jsonPath("total").value(0));
 }
 @Test void stockFiltersReflectInventory() throws Exception {
  catalog.stock("a1",5,0);
  mvc.perform(get("/api/products").param("inStock","true")).andExpect(status().isOk()).andExpect(jsonPath("total").value(1)).andExpect(jsonPath("items[0].inStock").value(true));
  mvc.perform(get("/api/products").param("inStock","false")).andExpect(status().isOk()).andExpect(jsonPath("total").value(14));
 }
 @Test void searchIncludesProductCategory() throws Exception {
  mvc.perform(get("/api/products").param("q","apparel"))
   .andExpect(status().isOk()).andExpect(jsonPath("total").value(5));
 }
 @Test @WithMockUser(roles="ADMIN") void malformedHttpsImageUrlsAreRejected() throws Exception {
  for(String image:List.of("https://?", "https://example.test:99999/image.jpg", "https://user@example.test/image.jpg")) {
   mvc.perform(post("/api/admin/products").with(csrf()).contentType("application/json")
    .content(input(0).replace("https://images.pexels.com/test.jpg",image)))
    .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("VALIDATION_ERROR"));
  }
  assertThat(db.queryForObject("SELECT COUNT(*) FROM products",Integer.class)).isEqualTo(15);
 }
 @Test void missingProductsAndInvalidQueryInputs() throws Exception {
  mvc.perform(get("/api/products/missing")).andExpect(status().isNotFound());
  for(var params:List.of(Map.of("size","101"),Map.of("page","-1"),Map.of("sort","price;DROP"),Map.of("minPrice","abc"),Map.of("minPrice","30","maxPrice","20"),Map.of("inStock","nonsense"))) {
   var req=get("/api/products");params.forEach(req::param);mvc.perform(req).andExpect(status().isBadRequest());
  }
 }
 @Test void anonymousCannotUseAnyAdminOperation() throws Exception {
  mvc.perform(get("/api/admin/products")).andExpect(status().isUnauthorized());
  mvc.perform(post("/api/admin/products").with(csrf()).contentType("application/json").content(input(0))).andExpect(status().isUnauthorized());
  mvc.perform(put("/api/admin/products/a1").with(csrf()).contentType("application/json").content(input(0))).andExpect(status().isUnauthorized());
  mvc.perform(delete("/api/admin/products/a1").param("version","0").with(csrf())).andExpect(status().isUnauthorized());
 }
 @Test @WithMockUser(roles="CUSTOMER") void customerDeniedEveryAdminRoute() throws Exception {
  mvc.perform(get("/api/admin/products")).andExpect(status().isForbidden());
  mvc.perform(get("/api/admin/products/a1")).andExpect(status().isForbidden());
  mvc.perform(post("/api/admin/products").with(csrf()).contentType("application/json").content(input(0))).andExpect(status().isForbidden());
  mvc.perform(put("/api/admin/products/a1").with(csrf()).contentType("application/json").content(input(0))).andExpect(status().isForbidden());
  mvc.perform(put("/api/admin/products/a1/inventory").with(csrf()).contentType("application/json").content("{\"quantity\":100,\"version\":0}")).andExpect(status().isForbidden());
  mvc.perform(delete("/api/admin/products/a1").param("version","0").with(csrf())).andExpect(status().isForbidden());
  assertThat(catalog.detail("a1",true).get("stock")).isEqualTo(0);
 }
 @Test @WithMockUser(roles="ADMIN") void adminCrudArchivesRatherThanDeleting() throws Exception {
  var result=mvc.perform(post("/api/admin/products").with(csrf()).contentType("application/json").content(input(0)))
   .andExpect(status().isCreated()).andExpect(jsonPath("stock").value(0)).andReturn();
  String id=json.readTree(result.getResponse().getContentAsString()).get("id").asText();
  mvc.perform(put("/api/admin/products/"+id).with(csrf()).contentType("application/json").content(input(0).replace("123.45","250.50")))
   .andExpect(status().isOk()).andExpect(jsonPath("price").value(250.50)).andExpect(jsonPath("version").value(1));
  mvc.perform(put("/api/admin/products/"+id+"/inventory").with(csrf()).contentType("application/json").content("{\"quantity\":7,\"version\":0}"))
   .andExpect(status().isOk()).andExpect(jsonPath("stock").value(7));
  mvc.perform(delete("/api/admin/products/"+id).param("version","1").with(csrf())).andExpect(status().isNoContent());
  mvc.perform(get("/api/products/"+id)).andExpect(status().isNotFound());
  mvc.perform(get("/api/admin/products/"+id)).andExpect(status().isOk()).andExpect(jsonPath("active").value(false)).andExpect(jsonPath("stock").value(7));
  assertThat(db.queryForObject("SELECT COUNT(*) FROM products WHERE id=?",Integer.class,id)).isEqualTo(1);
 }
 @Test @WithMockUser(roles="ADMIN") void staleEditsAndStockUpdatesConflict() throws Exception {
  for(int i=0;i<2;i++) mvc.perform(put("/api/admin/products/a1/inventory").with(csrf()).contentType("application/json").content("{\"quantity\":9,\"version\":0}"))
   .andExpect(i==0?status().isOk():status().isConflict());
  for(int i=0;i<2;i++) mvc.perform(put("/api/admin/products/a1").with(csrf()).contentType("application/json").content(input(0)))
   .andExpect(i==0?status().isOk():status().isConflict());
  mvc.perform(delete("/api/admin/products/a1").param("version","0").with(csrf())).andExpect(status().isConflict());
 }
 @Test @WithMockUser(roles="ADMIN") void adminWritesRequireCsrf() throws Exception {
  mvc.perform(post("/api/admin/products").contentType("application/json").content(input(0))).andExpect(status().isForbidden());
  mvc.perform(put("/api/admin/products/a1/inventory").contentType("application/json").content("{\"quantity\":1,\"version\":0}")).andExpect(status().isForbidden());
  mvc.perform(delete("/api/admin/products/a1").param("version","0")).andExpect(status().isForbidden());
 }
 @Test @WithMockUser(roles="ADMIN") void invalidProductsAndInventoryRejected() throws Exception {
  for(String body:List.of(input(0).replace("123.45","-1"),input(0).replace("https://images.pexels.com/test.jpg","javascript:alert(1)"),input(0).replace("https://images.pexels.com/test.jpg","https://example.com/has space"),input(0).replace("apparel","unknown"),input(0).replace("Test <Product>"," "),input(0).replace("123.45","1.001"),input(0).replace("\"M\"","null"))) {
   mvc.perform(post("/api/admin/products").with(csrf()).contentType("application/json").content(body)).andExpect(status().isBadRequest());
  }
  for(String body:List.of("{\"quantity\":-1,\"version\":0}","{\"quantity\":1.5,\"version\":0}","{\"quantity\":4}")) mvc.perform(put("/api/admin/products/a1/inventory").with(csrf()).contentType("application/json").content(body)).andExpect(status().isBadRequest());
 }
 @Test void seedIsIdempotentAndPreservesEditsAndStock() {
  db.update("UPDATE products SET name='Edited' WHERE id='a1'");catalog.stock("a1",17,0);
  new ResourceDatabasePopulator(new ClassPathResource("db/migration/V3__seed_existing_catalog.sql")).execute(Objects.requireNonNull(db.getDataSource()));
  assertThat(catalog.detail("a1",true)).containsEntry("name","Edited").containsEntry("stock",17);
  assertThat(db.queryForObject("SELECT COUNT(*) FROM products",Integer.class)).isEqualTo(15);
 }
 @Test void provisioningRequiresExistingAccountAndLeavesPasswordsUntouched() {
  String email="operator@example.test";
  db.update("INSERT INTO users(name,email,password_hash,role) VALUES ('Operator',?,'unchanged-hash','CUSTOMER')",email);
  var env=new MockEnvironment().withProperty("ADMIN_EMAIL",email);
  new AdminProvisioning(db,env,tx).run(null);
  assertThat(db.queryForMap("SELECT role,password_hash FROM users WHERE email=?",email)).containsEntry("ROLE","ADMIN").containsEntry("PASSWORD_HASH","unchanged-hash");
  assertThatThrownBy(()->new AdminProvisioning(db,new MockEnvironment().withProperty("ADMIN_EMAIL","missing@example.test"),tx).run(null)).isInstanceOf(IllegalArgumentException.class);
  db.update("DELETE FROM users WHERE email=?",email);
 }
 @Test void newMigrationsExecuteThroughFlywayAndSecondRunIsNoOp() throws Exception {
  var ds=new org.springframework.jdbc.datasource.DriverManagerDataSource("jdbc:h2:mem:migration_catalog;MODE=MySQL;DB_CLOSE_DELAY=-1","sa","");
  var jdbc=new JdbcTemplate(ds);jdbc.execute("CREATE TABLE users(id BIGINT PRIMARY KEY, name VARCHAR(100))");jdbc.update("INSERT INTO users VALUES (42,'Preserved')");
  var flyway=org.flywaydb.core.Flyway.configure().dataSource(ds).locations("classpath:db/migration").baselineOnMigrate(true).baselineVersion("1").cleanDisabled(true).load();
  assertThat(flyway.migrate().migrationsExecuted).isEqualTo(3);
  assertThat(flyway.migrate().migrationsExecuted).isZero();
  assertThat(jdbc.queryForObject("SELECT name FROM users WHERE id=42",String.class)).isEqualTo("Preserved");
  assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM products",Integer.class)).isEqualTo(15);
 }
 @Test @WithMockUser(roles="ADMIN") void allowedAdminCorsPreflight() throws Exception {
  mvc.perform(options("/api/admin/products/a1").header("Origin","http://127.0.0.1:8859").header("Access-Control-Request-Method","PUT").header("Access-Control-Request-Headers","Content-Type,X-CSRF-TOKEN"))
   .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://127.0.0.1:8859"));
 }
}
