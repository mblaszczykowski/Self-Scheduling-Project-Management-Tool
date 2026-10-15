package com.backend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class OpenApiContractTest extends PostgresIntegrationTest {
    private static final Path SPEC = Path.of("..", "docs", "openapi.json");

    @Autowired
    private MockMvc mockMvc;

    @Test
    void authenticationAndCsrfRequirementsMatchTheFilters() throws Exception {
        var body = mockMvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        var spec = new ObjectMapper().readTree(body);
        assertThat(spec.path("servers").get(0).path("url").asText()).isEqualTo("/");
        var paths = spec.path("paths");
        assertThat(paths.path("/api/auth/login").path("post").path("security").isEmpty()).isTrue();
        assertThat(paths.path("/api/users").path("post").path("security").isEmpty()).isTrue();
        assertThat(paths.path("/api/auth/refresh").path("post").path("security").get(0).has("csrfToken")).isTrue();
        var read = paths.path("/api/users/me").path("get").path("security");
        assertThat(read.size()).isEqualTo(2);
        assertThat(read.get(0).has("cookieAuth")).isTrue();
        assertThat(read.get(1).has("bearerAuth")).isTrue();
        assertThat(read.get(0).has("csrfToken")).isFalse();
        var write = paths.path("/api/projects").path("post").path("security");
        assertThat(write.get(0).has("csrfToken")).isTrue();
        assertThat(write.get(1).has("csrfToken")).isTrue();
    }

    @Test
    @DisplayName("the committed OpenAPI spec matches the live controllers")
    void specIsCurrent() throws Exception {
        var body = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        var mapper = new ObjectMapper()
                .enable(SerializationFeature.INDENT_OUTPUT)
                .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
        var rendered = mapper.writeValueAsString(mapper.readTree(body)) + System.lineSeparator();

        if (Boolean.getBoolean("openapi.write")) {
            Files.createDirectories(SPEC.getParent());
            Files.writeString(SPEC, rendered);
            return;
        }

        assertThat(SPEC)
                .as("docs/openapi.json is missing; generate it with -Dopenapi.write=true")
                .exists();
        assertThat(Files.readString(SPEC))
                .as("docs/openapi.json is stale. Regenerate: "
                        + "mvn test -Dtest=OpenApiContractTest -Dopenapi.write=true")
                .isEqualTo(rendered);
    }
}
