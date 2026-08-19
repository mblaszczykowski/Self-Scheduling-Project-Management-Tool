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

/**
 * Keeps {@code docs/openapi.json} in step with the controllers.
 *
 * <p>The committed spec is what the frontend generates its request and response types from, so a
 * field renamed or retyped in a DTO has to reach that file or the two sides drift silently. This
 * test fails when they disagree; regenerate with:
 *
 * <pre>{@code mvn test -Dtest=OpenApiContractTest -Dopenapi.write=true}</pre>
 *
 * <p>then {@code npm run generate:api-types} in {@code frontend/} to refresh the TypeScript.
 */
@AutoConfigureMockMvc
class OpenApiContractTest extends PostgresIntegrationTest {

    private static final Path SPEC = Path.of("..", "docs", "openapi.json");

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("the committed OpenAPI spec matches the live controllers")
    void specIsCurrent() throws Exception {
        var body = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // Keys sorted so the rendered spec depends on the API, not on map iteration order.
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
