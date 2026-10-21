package com.fuelfit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "app.frontend-origin=http://127.0.0.1:8859")
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class FuelFitBackendApplicationTests {

    @Autowired
    MockMvc mvc;

    @Autowired
    ApplicationContext context;

    @Test
    void healthIsPublicAndReturnsExpectedJson() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {"status":"UP","message":"FuelFit Backend Running"}
                        """));
    }

    @Test
    void otherPathsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/private"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void frontendOriginIsAllowed() throws Exception {
        mvc.perform(get("/api/health").header("Origin", "http://127.0.0.1:8859"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:8859"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void frontendPreflightIsAllowed() throws Exception {
        mvc.perform(options("/api/health")
                        .header("Origin", "http://127.0.0.1:8859")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:8859"));
    }

    @Test
    void otherOriginsAreRejected() throws Exception {
        mvc.perform(get("/api/health").header("Origin", "http://localhost:9999"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void devProfileDoesNotCreateADatabaseConnection() {
        assertThat(context.getBeansOfType(DataSource.class)).isEmpty();
    }
}
