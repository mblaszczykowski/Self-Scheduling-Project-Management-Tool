package com.backend.controllers;

import com.backend.config.AppProperties;
import com.backend.config.WebConfig;
import com.backend.dtos.ProjectDTO;
import com.backend.dtos.UserDTO;
import com.backend.exception.ResourceNotFoundException;
import com.backend.requests.ProjectRequest;
import com.backend.services.ProjectService;
import com.backend.services.TokenService;
import com.backend.web.CurrentUserIdArgumentResolver;
import com.backend.web.PageRequests;
import com.backend.web.RequestValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.Filter;
import jakarta.validation.Validation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The HTTP contract of {@link ProjectController}: status codes, the {@code ApiError} shape and the
 * {@code PagedResponse} envelope. The service is mocked, but everything between the socket and it
 * is real — the production {@code WebConfig}/{@code CurrentUserIdArgumentResolver} pair that
 * resolves {@code @CurrentUserId}, the real {@code RequestValidator}, the real {@code PageRequests}
 * clamping and the real {@code GlobalExceptionHandler}.
 */
// The servlet filters are deliberately out of the slice. JwtAuthenticationFilter would reject
// every request here (these tests carry no token, they carry the attribute the filter would have
// written), and the rest pull in configuration that has nothing to do with the HTTP contract.
@WebMvcTest(controllers = ProjectController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = Filter.class))
@Import({ProjectControllerWebTest.SliceConfig.class, WebConfig.class, CurrentUserIdArgumentResolver.class})
@DisplayName("ProjectController over HTTP")
class ProjectControllerWebTest {

    private static final int USER_ID = 7;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProjectService projectService;

    /**
     * Spring's automatic reset of a {@code @MockitoBean} keys off annotations found on the class
     * being run, and does not look at the enclosing class of a {@code @Nested} one — so without
     * this the recorded invocations would leak from one nested case into the next.
     */
    @BeforeEach
    void resetServiceMock() {
        reset(projectService);
    }

    private static ProjectDTO sampleProject(String projectKey) {
        return new ProjectDTO(10, projectKey, "Sample summary", "Sample description",
                List.of(), List.of(new UserDTO(1, "Ada", "Lovelace", "owner@example.com", null)),
                List.of(), new UserDTO(1, "Ada", "Lovelace", "owner@example.com", null),
                List.of(), Instant.parse("2026-01-01T10:00:00Z"), Instant.parse("2026-01-02T10:00:00Z"));
    }

    private static MockMultipartFile projectPart(String json) {
        return new MockMultipartFile("projectDTO", "projectDTO", MediaType.APPLICATION_JSON_VALUE,
                json.getBytes(StandardCharsets.UTF_8));
    }

    @Nested
    @DisplayName("POST /api/projects")
    class CreateProject {

        @Test
        @DisplayName("answers 201 Created and hands the service the parsed request and the caller's id")
        void answers201CreatedWithTheParsedRequest() throws Exception {
            when(projectService.createProject(any(ProjectRequest.class), eq(USER_ID), any()))
                    .thenReturn(sampleProject("NEW"));

            mockMvc.perform(multipart("/api/projects")
                            .file(projectPart("""
                                    {"projectKey":"NEW","summary":"Sample summary",
                                     "description":"Sample description",
                                     "memberEmails":["member@example.com"]}"""))
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isCreated())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.projectKey").value("NEW"))
                    .andExpect(jsonPath("$.id").value(10))
                    .andExpect(jsonPath("$.owner.email").value("owner@example.com"))
                    .andExpect(jsonPath("$.tasks").isArray());

            var request = ArgumentCaptor.forClass(ProjectRequest.class);
            verify(projectService).createProject(request.capture(), eq(USER_ID), any());
            assertThat(request.getValue().projectKey()).isEqualTo("NEW");
            assertThat(request.getValue().summary()).isEqualTo("Sample summary");
            assertThat(request.getValue().memberEmails()).containsExactly("member@example.com");
        }

        @Test
        @DisplayName("answers 400 in the ApiError shape when the submitted project fails validation")
        void answers400InTheApiErrorShapeOnValidationFailure() throws Exception {
            mockMvc.perform(multipart("/api/projects")
                            .file(projectPart("""
                                    {"projectKey":"","summary":"Sample summary"}"""))
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.error").value("Validation Error"))
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("Project key is required")))
                    .andExpect(jsonPath("$.timestamp").exists())
                    .andExpect(jsonPath("$.fieldErrors").doesNotExist());

            verify(projectService, never()).createProject(any(), anyInt(), any());
        }

        @Test
        @DisplayName("answers 400 when the JSON part is not parseable at all")
        void answers400OnMalformedJson() throws Exception {
            mockMvc.perform(multipart("/api/projects")
                            .file(projectPart("{not json"))
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.error").value("Invalid JSON"));

            verify(projectService, never()).createProject(any(), anyInt(), any());
        }

        @Test
        @DisplayName("answers 403 rather than resolving a null caller when the request carries no user id")
        void answers403WhenTheRequestCarriesNoUserId() throws Exception {
            mockMvc.perform(multipart("/api/projects")
                            .file(projectPart("""
                                    {"projectKey":"NEW","summary":"Sample summary"}""")))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.error").value("Forbidden"))
                    .andExpect(jsonPath("$.message").value("User not authenticated"));

            verifyNoInteractions(projectService);
        }
    }

    @Nested
    @DisplayName("DELETE /api/projects/{projectKey}")
    class DeleteProject {

        @Test
        @DisplayName("answers 204 No Content with an empty body")
        void answers204NoContent() throws Exception {
            mockMvc.perform(delete("/api/projects/{projectKey}", "PROJ")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isNoContent())
                    .andExpect(content().string(""));

            verify(projectService).deleteProject("PROJ", USER_ID);
        }

        @Test
        @DisplayName("answers 404 in the ApiError shape when the project is not visible to the caller")
        void answers404WhenTheProjectIsNotVisible() throws Exception {
            org.mockito.Mockito.doThrow(new ResourceNotFoundException("Project not found"))
                    .when(projectService).deleteProject("GHOST", USER_ID);

            mockMvc.perform(delete("/api/projects/{projectKey}", "GHOST")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.error").value("Not Found"))
                    .andExpect(jsonPath("$.message").value("Project not found"));
        }

        @Test
        @DisplayName("answers 403 when the request carries no user id")
        void answers403WhenTheRequestCarriesNoUserId() throws Exception {
            mockMvc.perform(delete("/api/projects/{projectKey}", "PROJ"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value("User not authenticated"));

            verify(projectService, never()).deleteProject(anyString(), anyInt());
        }
    }

    @Nested
    @DisplayName("GET /api/projects")
    class ListProjects {

        @Test
        @DisplayName("wraps the page in the PagedResponse envelope with a content array")
        void wrapsThePageInThePagedResponseEnvelope() throws Exception {
            when(projectService.getProjects(eq(USER_ID), any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of(sampleProject("PROJ")), PageRequest.of(0, 25), 30));

            mockMvc.perform(get("/api/projects")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isArray())
                    .andExpect(jsonPath("$.content.length()").value(1))
                    .andExpect(jsonPath("$.content[0].projectKey").value("PROJ"))
                    .andExpect(jsonPath("$.page").value(0))
                    .andExpect(jsonPath("$.size").value(25))
                    .andExpect(jsonPath("$.totalElements").value(30))
                    .andExpect(jsonPath("$.totalPages").value(2))
                    .andExpect(jsonPath("$.hasNext").value(true));
        }

        @Test
        @DisplayName("clamps a nonsensical page and size instead of answering 500")
        void clampsANonsensicalPageAndSize() throws Exception {
            when(projectService.getProjects(eq(USER_ID), any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 1), 0));

            mockMvc.perform(get("/api/projects")
                            .param("page", "-3")
                            .param("size", "0")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isArray());

            var pageable = ArgumentCaptor.forClass(Pageable.class);
            verify(projectService).getProjects(eq(USER_ID), pageable.capture());
            assertThat(pageable.getValue().getPageNumber()).isZero();
            assertThat(pageable.getValue().getPageSize()).isEqualTo(1);
        }

        @Test
        @DisplayName("caps an oversized page size at the configured maximum")
        void capsAnOversizedPageSize() throws Exception {
            when(projectService.getProjects(eq(USER_ID), any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 100), 0));

            mockMvc.perform(get("/api/projects")
                            .param("size", "100000")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isOk());

            var pageable = ArgumentCaptor.forClass(Pageable.class);
            verify(projectService).getProjects(eq(USER_ID), pageable.capture());
            assertThat(pageable.getValue().getPageSize())
                    .isEqualTo(new AppProperties().getPagination().getMaxSize());
        }

        @Test
        @DisplayName("answers 400 in the ApiError shape for a non-numeric page parameter")
        void answers400ForANonNumericPageParameter() throws Exception {
            mockMvc.perform(get("/api/projects")
                            .param("page", "first")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.error").value("Invalid Parameter"))
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("page")));

            verifyNoInteractions(projectService);
        }

        @Test
        @DisplayName("answers 403 when the request carries no user id")
        void answers403WhenTheRequestCarriesNoUserId() throws Exception {
            mockMvc.perform(get("/api/projects"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value("User not authenticated"));

            verifyNoInteractions(projectService);
        }
    }

    /**
     * The collaborators the controller needs that a {@code @WebMvcTest} slice does not
     * component-scan. They are the real implementations, not mocks: the validation, the pagination
     * clamping and the argument resolution are part of what is being asserted.
     */
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

        @Bean
        RequestValidator requestValidator(ObjectMapper objectMapper) {
            return new RequestValidator(objectMapper,
                    Validation.buildDefaultValidatorFactory().getValidator());
        }
    }
}
