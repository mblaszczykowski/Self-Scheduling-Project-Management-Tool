package com.backend.controllers;

import com.backend.config.AppProperties;
import com.backend.config.WebConfig;
import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.exception.AuthorizationException;
import com.backend.requests.TaskRequest;
import com.backend.requests.TaskScheduleRequest;
import com.backend.services.TaskService;
import com.backend.services.TokenService;
import com.backend.web.CurrentUserIdArgumentResolver;
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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The HTTP contract of {@link TaskController}, including the {@code PATCH .../schedule} endpoint and
 * the {@code ApiError} body — {@code fieldErrors} included — that a rejected request comes back as.
 * Only the service is mocked; the argument resolution, the bean validation and the exception
 * handling are the production ones.
 */
// The servlet filters are deliberately out of the slice: JwtAuthenticationFilter would reject every
// request here, since these tests carry the attribute the filter would have written, not a token.
@WebMvcTest(controllers = TaskController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = Filter.class))
@Import({TaskControllerWebTest.SliceConfig.class, WebConfig.class, CurrentUserIdArgumentResolver.class})
@DisplayName("TaskController over HTTP")
class TaskControllerWebTest {

    private static final int USER_ID = 7;
    private static final String TASKS_URL = "/api/projects/{projectKey}/tasks";
    private static final String SCHEDULE_URL = "/api/projects/{projectKey}/tasks/{taskKey}/schedule";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TaskService taskService;

    /**
     * Spring's automatic reset of a {@code @MockitoBean} keys off annotations found on the class
     * being run, and does not look at the enclosing class of a {@code @Nested} one — so without
     * this the recorded invocations would leak from one nested case into the next.
     */
    @BeforeEach
    void resetServiceMock() {
        reset(taskService);
    }

    private static TaskDTO sampleTask(LocalDate startDate, LocalDate dueDate) {
        return new TaskDTO(100, 1, "PROJ-1", "PROJ", "Sample summary", "Sample description",
                TaskStatus.IN_PROGRESS, startDate, dueDate, "member@example.com",
                List.of("bug"), List.of(), Boolean.TRUE, List.of(),
                Instant.parse("2026-01-01T10:00:00Z"), Instant.parse("2026-01-02T10:00:00Z"),
                40, TaskPriority.HIGH);
    }

    private static MockMultipartFile taskPart(String json) {
        return new MockMultipartFile("taskDTO", "taskDTO", MediaType.APPLICATION_JSON_VALUE,
                json.getBytes(StandardCharsets.UTF_8));
    }

    @Nested
    @DisplayName("POST /api/projects/{projectKey}/tasks")
    class CreateTask {

        @Test
        @DisplayName("answers 201 Created and hands the service the parsed request, project key and caller id")
        void answers201CreatedWithTheParsedRequest() throws Exception {
            when(taskService.createTask(eq("PROJ"), any(TaskRequest.class), eq(USER_ID), any()))
                    .thenReturn(sampleTask(LocalDate.of(2026, 1, 5), LocalDate.of(2026, 1, 9)));

            mockMvc.perform(multipart(TASKS_URL, "PROJ")
                            .file(taskPart("""
                                    {"summary":"Sample summary","description":"Sample description",
                                     "status":"IN_PROGRESS","priority":"HIGH","progress":40,
                                     "startDate":"2026-01-05","dueDate":"2026-01-09",
                                     "labels":["bug"]}"""))
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isCreated())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.taskKey").value("PROJ-1"))
                    .andExpect(jsonPath("$.projectKey").value("PROJ"))
                    .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                    .andExpect(jsonPath("$.startDate").value("2026-01-05"))
                    .andExpect(jsonPath("$.labels[0]").value("bug"));

            var request = ArgumentCaptor.forClass(TaskRequest.class);
            verify(taskService).createTask(eq("PROJ"), request.capture(), eq(USER_ID), any());
            assertThat(request.getValue().summary()).isEqualTo("Sample summary");
            assertThat(request.getValue().status()).isEqualTo(TaskStatus.IN_PROGRESS);
            assertThat(request.getValue().priority()).isEqualTo(TaskPriority.HIGH);
            assertThat(request.getValue().progress()).isEqualTo(40);
            assertThat(request.getValue().startDate()).isEqualTo(LocalDate.of(2026, 1, 5));
            assertThat(request.getValue().labels()).containsExactly("bug");
        }

        @Test
        @DisplayName("answers 400 in the ApiError shape when the submitted task fails validation")
        void answers400InTheApiErrorShapeOnValidationFailure() throws Exception {
            mockMvc.perform(multipart(TASKS_URL, "PROJ")
                            .file(taskPart("""
                                    {"summary":"   ","description":"Sample description"}"""))
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.error").value("Validation Error"))
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("Summary is required")))
                    .andExpect(jsonPath("$.timestamp").exists());

            verifyNoInteractions(taskService);
        }

        @Test
        @DisplayName("answers 400 when the submitted due date precedes the start date")
        void answers400WhenTheDueDatePrecedesTheStartDate() throws Exception {
            mockMvc.perform(multipart(TASKS_URL, "PROJ")
                            .file(taskPart("""
                                    {"summary":"Sample summary","startDate":"2026-01-09",
                                     "dueDate":"2026-01-05"}"""))
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(
                            org.hamcrest.Matchers.containsString("Due date must not be before the start date")));

            verifyNoInteractions(taskService);
        }

        @Test
        @DisplayName("answers 403 rather than resolving a null caller when the request carries no user id")
        void answers403WhenTheRequestCarriesNoUserId() throws Exception {
            mockMvc.perform(multipart(TASKS_URL, "PROJ")
                            .file(taskPart("""
                                    {"summary":"Sample summary"}""")))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.error").value("Forbidden"))
                    .andExpect(jsonPath("$.message").value("User not authenticated"));

            verifyNoInteractions(taskService);
        }
    }

    @Nested
    @DisplayName("PATCH /api/projects/{projectKey}/tasks/{taskKey}/schedule")
    class UpdateSchedule {

        @Test
        @DisplayName("answers 200 with the moved task and passes both dates to the service")
        void answers200WithTheMovedTask() throws Exception {
            when(taskService.updateSchedule(eq("PROJ"), eq("PROJ-1"), any(TaskScheduleRequest.class), eq(USER_ID)))
                    .thenReturn(sampleTask(LocalDate.of(2026, 2, 2), LocalDate.of(2026, 2, 6)));

            mockMvc.perform(patch(SCHEDULE_URL, "PROJ", "PROJ-1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"startDate":"2026-02-02","dueDate":"2026-02-06"}""")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.taskKey").value("PROJ-1"))
                    .andExpect(jsonPath("$.startDate").value("2026-02-02"))
                    .andExpect(jsonPath("$.dueDate").value("2026-02-06"));

            var request = ArgumentCaptor.forClass(TaskScheduleRequest.class);
            verify(taskService).updateSchedule(eq("PROJ"), eq("PROJ-1"), request.capture(), eq(USER_ID));
            assertThat(request.getValue().startDate()).isEqualTo(LocalDate.of(2026, 2, 2));
            assertThat(request.getValue().dueDate()).isEqualTo(LocalDate.of(2026, 2, 6));
        }

        @Test
        @DisplayName("answers 400 with a fieldErrors entry when the due date precedes the start date")
        void answers400WithFieldErrorsWhenTheDueDatePrecedesTheStartDate() throws Exception {
            mockMvc.perform(patch(SCHEDULE_URL, "PROJ", "PROJ-1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"startDate":"2026-02-06","dueDate":"2026-02-02"}""")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.error").value("Validation Failed"))
                    .andExpect(jsonPath("$.message").value("Invalid request data"))
                    .andExpect(jsonPath("$.timestamp").exists())
                    .andExpect(jsonPath("$.fieldErrors").isArray())
                    .andExpect(jsonPath("$.fieldErrors.length()").value(1))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("dateRangeOrdered"))
                    .andExpect(jsonPath("$.fieldErrors[0].message")
                            .value("Due date must not be before the start date"));

            verifyNoInteractions(taskService);
        }

        @Test
        @DisplayName("answers 400 naming the missing date field when one of the two dates is absent")
        void answers400NamingTheMissingDateField() throws Exception {
            mockMvc.perform(patch(SCHEDULE_URL, "PROJ", "PROJ-1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"startDate":"2026-02-06"}""")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Validation Failed"))
                    .andExpect(jsonPath("$.fieldErrors.length()").value(1))
                    .andExpect(jsonPath("$.fieldErrors[0].field").value("dueDate"))
                    .andExpect(jsonPath("$.fieldErrors[0].message").value("Due date is required"));

            verifyNoInteractions(taskService);
        }

        @Test
        @DisplayName("answers 400, not 500, for a body that is not readable as JSON dates")
        void answers400ForAnUnreadableBody() throws Exception {
            mockMvc.perform(patch(SCHEDULE_URL, "PROJ", "PROJ-1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"startDate":"not-a-date","dueDate":"2026-02-06"}""")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400));

            verifyNoInteractions(taskService);
        }

        @Test
        @DisplayName("answers 403 when the request carries no user id")
        void answers403WhenTheRequestCarriesNoUserId() throws Exception {
            mockMvc.perform(patch(SCHEDULE_URL, "PROJ", "PROJ-1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"startDate":"2026-02-02","dueDate":"2026-02-06"}"""))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value("User not authenticated"));

            verifyNoInteractions(taskService);
        }
    }

    @Nested
    @DisplayName("DELETE /api/projects/{projectKey}/tasks/{taskKey}")
    class DeleteTask {

        @Test
        @DisplayName("answers 204 No Content with an empty body")
        void answers204NoContent() throws Exception {
            mockMvc.perform(delete("/api/projects/{projectKey}/tasks/{taskKey}", "PROJ", "PROJ-1")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isNoContent())
                    .andExpect(content().string(""));

            verify(taskService).deleteTask("PROJ", "PROJ-1", USER_ID);
        }

        @Test
        @DisplayName("answers 403 in the ApiError shape when the service refuses the caller")
        void answers403WhenTheServiceRefusesTheCaller() throws Exception {
            doThrow(new AuthorizationException("Only project owner can perform this action"))
                    .when(taskService).deleteTask("PROJ", "PROJ-1", USER_ID);

            mockMvc.perform(delete("/api/projects/{projectKey}/tasks/{taskKey}", "PROJ", "PROJ-1")
                            .requestAttr(TokenService.USER_ID_ATTRIBUTE, USER_ID))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.status").value(403))
                    .andExpect(jsonPath("$.error").value("Forbidden"))
                    .andExpect(jsonPath("$.message").value("Only project owner can perform this action"));
        }

        @Test
        @DisplayName("answers 403 when the request carries no user id")
        void answers403WhenTheRequestCarriesNoUserId() throws Exception {
            mockMvc.perform(delete("/api/projects/{projectKey}/tasks/{taskKey}", "PROJ", "PROJ-1"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value("User not authenticated"));

            verify(taskService, never()).deleteTask(anyString(), anyString(), anyInt());
        }
    }

    /**
     * The collaborators the controller needs that a {@code @WebMvcTest} slice does not
     * component-scan. They are the real implementations, not mocks: the validation and the argument
     * resolution are part of what is being asserted.
     */
    @TestConfiguration
    static class SliceConfig {

        @Bean
        AppProperties appProperties() {
            return new AppProperties();
        }

        @Bean
        RequestValidator requestValidator(ObjectMapper objectMapper) {
            return new RequestValidator(objectMapper,
                    Validation.buildDefaultValidatorFactory().getValidator());
        }
    }
}
