package com.backend.controllers;

import com.backend.config.AppProperties;
import com.backend.config.WebConfig;
import com.backend.entities.StoredFile;
import com.backend.exception.ResourceNotFoundException;
import com.backend.security.AccessGuard;
import com.backend.services.FileStorageService;
import com.backend.services.TokenService;
import com.backend.web.CurrentUserIdArgumentResolver;
import jakarta.servlet.Filter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = FileController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = Filter.class))
@Import({FileControllerWebTest.SliceConfig.class, WebConfig.class, CurrentUserIdArgumentResolver.class})
@DisplayName("FileController over HTTP")
class FileControllerWebTest {
    private static final int USER_ID = 7;
    private static final int PROJECT_ID = 5;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FileStorageService fileStorageService;

    @MockitoBean
    private AccessGuard accessGuard;

    @TempDir
    private Path tempDir;

    @BeforeEach
    void resetMocks() {
        reset(fileStorageService, accessGuard);
    }

    private Path writeFile(String name, String content) throws IOException {
        var path = tempDir.resolve(name);
        Files.writeString(path, content);
        return path;
    }

    @Nested
    @DisplayName("GET /files/{fileName}")
    class ServeFile {
        @Test
        @DisplayName("answers the mapped error status and never streams the bytes when access is refused")
        void answersTheMappedErrorStatusWhenAccessIsRefused() throws Exception {
            when(fileStorageService.findOwnership("secret.pdf"))
                    .thenReturn(Optional.of(new StoredFile("secret.pdf", PROJECT_ID, 1)));
            doThrow(new ResourceNotFoundException("Project not found"))
                    .when(accessGuard).requireProjectAccessById(PROJECT_ID, USER_ID);

            mockMvc.perform(get("/files/{fileName}", "secret.pdf")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.error").value("Not Found"))
                    .andExpect(jsonPath("$.message").value("Project not found"));

            verify(fileStorageService, never()).getFilePath(anyString());
        }

        @Test
        @DisplayName("serves a project-scoped file the caller may see, as a download")
        void servesAProjectScopedFileTheCallerMaySee() throws Exception {
            var filePath = writeFile("generated-name.pdf", "pdf content");
            when(fileStorageService.findOwnership("generated-name.pdf"))
                    .thenReturn(Optional.of(new StoredFile("generated-name.pdf", PROJECT_ID, 1)));
            when(fileStorageService.getFilePath("generated-name.pdf")).thenReturn(filePath);

            mockMvc.perform(get("/files/{fileName}", "generated-name.pdf")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("attachment")))
                    .andExpect(header().string("X-Content-Type-Options", "nosniff"));

            verify(accessGuard).requireProjectAccessById(PROJECT_ID, USER_ID);
        }

        @Test
        @DisplayName("serves an unscoped file (a profile picture) without a project check")
        void servesAnUnscopedFileWithoutAProjectCheck() throws Exception {
            var filePath = writeFile("avatar.png", "not really png bytes");
            when(fileStorageService.findOwnership("avatar.png"))
                    .thenReturn(Optional.of(new StoredFile("avatar.png", null, 1)));
            when(fileStorageService.getFilePath("avatar.png")).thenReturn(filePath);

            mockMvc.perform(get("/files/{fileName}", "avatar.png")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isOk());

            verifyNoInteractions(accessGuard);
        }

        @Test
        @DisplayName("answers 404 for a file with no ownership row at all")
        void answers404ForAFileWithNoOwnershipRow() throws Exception {
            when(fileStorageService.findOwnership("unknown.pdf")).thenReturn(Optional.empty());

            mockMvc.perform(get("/files/{fileName}", "unknown.pdf")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.message").value("File not found"));

            verify(fileStorageService, never()).getFilePath(anyString());
            verifyNoInteractions(accessGuard);
        }
    }

    @TestConfiguration
    static class SliceConfig {
        @Bean
        AppProperties appProperties() {
            return new AppProperties();
        }
    }
}
