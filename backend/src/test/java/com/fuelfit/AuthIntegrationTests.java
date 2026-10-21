package com.fuelfit;

import com.fuelfit.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    // Test data only. Never used as a real account or seeded into MySQL.
    final String registration = """
            {"name":"Test Athlete","email":"athlete@example.test","password":"TestOnly!234"}
            """;
    final String login = """
            {"email":"athlete@example.test","password":"TestOnly!234"}
            """;
    @BeforeEach void clearTestDatabase() { users.deleteAll(); }
    void register() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json").content(registration))
                .andExpect(status().isCreated()).andExpect(jsonPath("role").value("CUSTOMER"))
                .andExpect(jsonPath("password").doesNotExist()).andExpect(jsonPath("passwordHash").doesNotExist());
    }
    @Test void registrationHashesPassword() throws Exception {
        register();
        var stored = users.findByEmail("athlete@example.test").orElseThrow();
        assertThat(stored.getPasswordHash()).startsWith("$2a$12$").isNotEqualTo("TestOnly!234");
        assertThat(encoder.matches("TestOnly!234", stored.getPasswordHash())).isTrue();
    }
    @Test void duplicateEmailIsNormalizedAndRejected() throws Exception {
        register();
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json")
                        .content(registration.replace("athlete@example.test", "ATHLETE@EXAMPLE.TEST")))
                .andExpect(status().isConflict()).andExpect(jsonPath("code").value("EMAIL_UNAVAILABLE"));
        assertThat(users.count()).isEqualTo(1);
    }
    @Test void invalidRegistrationIsRejected() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json")
                        .content("{\"name\":\"\",\"email\":\"bad\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("fields.email").exists());
        assertThat(users.count()).isZero();
    }
    @Test void loginPersistsSessionAndRotatesSessionId() throws Exception {
        register();
        var session = new MockHttpSession();
        String oldId = session.getId();
        mvc.perform(post("/api/auth/login").session(session).with(csrf()).contentType("application/json").content(login))
                .andExpect(status().isOk()).andExpect(jsonPath("email").value("athlete@example.test"));
        assertThat(session.getId()).isNotEqualTo(oldId);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("name").value("Test Athlete"));
        mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }
    @Test void wrongPasswordAndUnknownEmailHaveSameGenericError() throws Exception {
        register();
        for (var body : new String[]{login.replace("TestOnly!234", "WrongOnly!234"),
                login.replace("athlete@example.test", "unknown@example.test")}) {
            mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content(body))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("code").value("INVALID_CREDENTIALS"))
                    .andExpect(jsonPath("message").value("Invalid email or password"));
        }
    }
    @Test void csrfIsRequiredEvenForPublicRegistration() throws Exception {
        mvc.perform(post("/api/auth/register").contentType("application/json").content(registration))
                .andExpect(status().isForbidden()).andExpect(jsonPath("code").value("FORBIDDEN"));
        assertThat(users.count()).isZero();
    }
    @Test void realCsrfTokenRoundTripWorksAndOldTokenExpiresAfterLogin() throws Exception {
        register();
        var result = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        var json = new tools.jackson.databind.ObjectMapper().readTree(result.getResponse().getContentAsString());
        var session = (MockHttpSession) result.getRequest().getSession(false);
        var token = json.get("token").asText();
        mvc.perform(post("/api/auth/login").session(session).header("X-CSRF-TOKEN", token)
                        .contentType("application/json").content(login)).andExpect(status().isOk());
        mvc.perform(post("/api/auth/logout").session(session).header("X-CSRF-TOKEN", token))
                .andExpect(status().isForbidden());
    }
    @Test void roleInjectionAndMalformedJsonAreRejected() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json")
                        .content(registration.replace("TestOnly!234\"", "TestOnly!234\",\"role\":\"ADMIN\"")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content("{"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_REQUEST"));
    }
    @Test void bcryptByteLimitIsValidated() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json")
                        .content(registration.replace("TestOnly!234", "é".repeat(40))))
                .andExpect(status().isBadRequest());
        assertThat(users.count()).isZero();
    }
    @Test void healthStillWorksWithDatabaseProfile() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("status").value("UP"));
    }
}
