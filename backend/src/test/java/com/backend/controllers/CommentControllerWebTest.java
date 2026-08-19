package com.backend.controllers;

import com.backend.config.WebConfig;
import com.backend.dtos.CommentDTO;
import com.backend.entities.ReactionType;
import com.backend.services.CommentService;
import com.backend.services.TokenService;
import com.backend.web.CurrentUserIdArgumentResolver;
import com.backend.web.PageRequests;
import com.backend.config.AppProperties;
import jakarta.servlet.Filter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = CommentController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = Filter.class))
@Import({CommentControllerWebTest.SliceConfig.class, WebConfig.class, CurrentUserIdArgumentResolver.class})
@DisplayName("CommentController over HTTP")
class CommentControllerWebTest {
    private static final int TASK_ID = 100;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CommentService commentService;

    @BeforeEach
    void resetServiceMock() {
        reset(commentService);
    }

    private static CommentDTO sampleComment() {
        return new CommentDTO(1, TASK_ID, 7, "Ada Lovelace", null, "Looks good",
                Instant.parse("2026-01-01T10:00:00Z"), null, List.of(), 0, 0, false, false, List.of());
    }

    private static MockMultipartFile contentPart(String content) {
        return new MockMultipartFile("content", "content", MediaType.TEXT_PLAIN_VALUE,
                content.getBytes(StandardCharsets.UTF_8));
    }

    @Nested
    @DisplayName("POST /api/tasks/{taskId}/comments")
    class AddComment {
        @Test
        @DisplayName("answers 201 Created and passes the content and the caller's id through")
        void answers201Created() throws Exception {
            when(commentService.addComment(eq(TASK_ID), eq(7), eq("Looks good"), any(), any()))
                    .thenReturn(sampleComment());

            mockMvc.perform(multipart("/api/tasks/{taskId}/comments", TASK_ID)
                            .file(contentPart("Looks good"))
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, 7))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.content").value("Looks good"));

            verify(commentService).addComment(eq(TASK_ID), eq(7), eq("Looks good"), any(), any());
        }

        @ParameterizedTest
        @ValueSource(strings = {"", "   ", "\n\t"})
        @DisplayName("answers 400 for blank content without entering the service")
        void rejectsBlankContent(String content) throws Exception {
            mockMvc.perform(multipart("/api/tasks/{taskId}/comments", TASK_ID)
                            .file(contentPart(content))
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, 7))
                    .andExpect(status().isBadRequest());

            verifyNoInteractions(commentService);
        }

        @Test
        @DisplayName("answers 400 for content past the maximum without entering the service")
        void rejectsOverlongContent() throws Exception {
            mockMvc.perform(multipart("/api/tasks/{taskId}/comments", TASK_ID)
                            .file(contentPart("x".repeat(10_001)))
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, 7))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").exists())
                    .andExpect(jsonPath("$.status").value(400));

            verifyNoInteractions(commentService);
        }

        @Test
        @DisplayName("accepts content exactly at the maximum")
        void acceptsContentAtTheMaximum() throws Exception {
            when(commentService.addComment(anyInt(), anyInt(), anyString(), any(), any()))
                    .thenReturn(sampleComment());

            mockMvc.perform(multipart("/api/tasks/{taskId}/comments", TASK_ID)
                            .file(contentPart("x".repeat(10_000)))
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, 7))
                    .andExpect(status().isCreated());
        }
    }

    @Nested
    @DisplayName("PUT /api/tasks/{taskId}/comments/{commentId}")
    class UpdateComment {
        @Test
        @DisplayName("answers 400 for blank content without entering the service")
        void rejectsBlankContent() throws Exception {
            mockMvc.perform(multipart("/api/tasks/{taskId}/comments/{commentId}", TASK_ID, 1)
                            .file(contentPart("  "))
                            .with(request -> {
                                request.setMethod("PUT");
                                return request;
                            })
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, 7))
                    .andExpect(status().isBadRequest());

            verifyNoInteractions(commentService);
        }
    }

    @Nested
    @DisplayName("POST /api/tasks/{taskId}/comments/{commentId}/reactions")
    class ReactToComment {
        @Test
        @DisplayName("answers 400 for a reaction type outside the enum")
        void rejectsAnUnknownReactionType() throws Exception {
            mockMvc.perform(post("/api/tasks/{taskId}/comments/{commentId}/reactions", TASK_ID, 1)
                            .param("type", "SHRUG")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, 7))
                    .andExpect(status().isBadRequest());

            verifyNoInteractions(commentService);
        }

        @Test
        @DisplayName("answers 200 with the updated comment for a known type")
        void acceptsAKnownReactionType() throws Exception {
            when(commentService.reactToComment(TASK_ID, 1, 7, ReactionType.LIKE))
                    .thenReturn(sampleComment());

            mockMvc.perform(post("/api/tasks/{taskId}/comments/{commentId}/reactions", TASK_ID, 1)
                            .param("type", "LIKE")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, 7))
                    .andExpect(status().isOk());
        }
    }

    @TestConfiguration
    static class SliceConfig {
        @Bean
        AppProperties appProperties() {
            return new AppProperties();
        }

        @Bean
        PageRequests pageRequests(AppProperties appProperties) {
            return new PageRequests(appProperties);
        }
    }
}
