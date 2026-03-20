package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.dtos.TaskDTO;
import com.backend.entities.*;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import com.backend.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    private TaskService taskService;

    private User owner;
    private User assignee;
    private Project project;

    @BeforeEach
    void setUp() {
        taskService = new TaskService(taskRepository, projectRepository,
                fileStorageService, userRepository, notificationService);

        owner = TestEntityFactory.createUser(1, "owner@example.com");
        assignee = TestEntityFactory.createUser(2, "assignee@example.com");
        project = TestEntityFactory.createProject(10, "PROJ", owner);
        project.replaceMembers(java.util.Set.of(owner, assignee));
    }

    @Nested
    @DisplayName("createTask")
    class CreateTaskTests {

        @Test
        @DisplayName("should create task with valid data and allocate task number")
        void shouldCreateTaskWithValidData() {
            var dto = new TaskDTO(null, null, null, "PROJ", "New Task", "desc",
                    TaskStatus.TODO, LocalDate.now(), LocalDate.now().plusDays(7),
                    null, null, null, null, null, null, null, 0, TaskPriority.HIGH);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> {
                Task t = inv.getArgument(0);
                t.setId(100);
                return t;
            });
            when(projectRepository.save(any(Project.class))).thenReturn(project);

            var result = taskService.createTask("PROJ", dto, 1, null);

            assertNotNull(result);
            assertEquals("New Task", result.summary());
            assertEquals(1, result.taskNumber());
            verify(projectRepository).save(project);
        }

        @Test
        @DisplayName("should allocate incrementing task numbers")
        void shouldAllocateIncrementingTaskNumbers() {
            project.setNextTaskNumber(5);

            var dto = new TaskDTO(null, null, null, "PROJ", "Task Five", "desc",
                    null, null, null, null, null, null, null, null, null, null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
            when(projectRepository.save(any(Project.class))).thenReturn(project);

            var result = taskService.createTask("PROJ", dto, 1, null);

            assertEquals(5, result.taskNumber());
            assertEquals(6, project.getNextTaskNumber());
        }

        @Test
        @DisplayName("should throw when project not found")
        void shouldThrowWhenProjectNotFound() {
            var dto = new TaskDTO(null, null, null, "NOPE", "Task", "desc",
                    null, null, null, null, null, null, null, null, null, null, null, null);

            when(projectRepository.findByProjectKeyWithLock("NOPE")).thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class, () ->
                    taskService.createTask("NOPE", dto, 1, null));
        }

        @Test
        @DisplayName("should throw when user has no access to project")
        void shouldThrowWhenUserHasNoAccess() {
            var dto = new TaskDTO(null, null, null, "PROJ", "Task", "desc",
                    null, null, null, null, null, null, null, null, null, null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));

            assertThrows(ResourceNotFoundException.class, () ->
                    taskService.createTask("PROJ", dto, 99, null));
        }

        @Test
        @DisplayName("should notify assignee when different from creator")
        void shouldNotifyAssigneeWhenDifferentFromCreator() {
            var dto = new TaskDTO(null, null, null, "PROJ", "Assigned Task", "desc",
                    null, null, null, "assignee@example.com", null, null, null, null, null, null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(userRepository.findByEmail("assignee@example.com")).thenReturn(Optional.of(assignee));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> {
                Task t = inv.getArgument(0);
                t.setId(100);
                return t;
            });
            when(projectRepository.save(any(Project.class))).thenReturn(project);

            taskService.createTask("PROJ", dto, 1, null);

            verify(notificationService).createNotification(
                    eq(assignee), contains("assigned"), eq(NotificationType.TASK_ASSIGNED), anyString());
        }

        @Test
        @DisplayName("should not notify when assignee is the creator")
        void shouldNotNotifyWhenAssigneeIsCreator() {
            var dto = new TaskDTO(null, null, null, "PROJ", "Self Task", "desc",
                    null, null, null, "owner@example.com", null, null, null, null, null, null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
            when(projectRepository.save(any(Project.class))).thenReturn(project);

            taskService.createTask("PROJ", dto, 1, null);

            verify(notificationService, never()).createNotification(any(), anyString(), any(), anyString());
        }

        @Test
        @DisplayName("should throw when assignee not found")
        void shouldThrowWhenAssigneeNotFound() {
            var dto = new TaskDTO(null, null, null, "PROJ", "Task", "desc",
                    null, null, null, "nobody@example.com", null, null, null, null, null, null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());
            when(projectRepository.save(any(Project.class))).thenReturn(project);

            assertThrows(ValidationException.class, () ->
                    taskService.createTask("PROJ", dto, 1, null));
        }

        @Test
        @DisplayName("should default status to BACKLOG when not specified")
        void shouldDefaultStatusToBacklog() {
            var dto = new TaskDTO(null, null, null, "PROJ", "Task", "desc",
                    null, null, null, null, null, null, null, null, null, null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
            when(projectRepository.save(any(Project.class))).thenReturn(project);

            var result = taskService.createTask("PROJ", dto, 1, null);

            assertEquals(TaskStatus.BACKLOG, result.status());
        }
    }

    @Nested
    @DisplayName("updateTask")
    class UpdateTaskTests {

        private Task existingTask;

        @BeforeEach
        void setUpTask() {
            existingTask = TestEntityFactory.createTask(100, 1, project);
        }

        @Test
        @DisplayName("should update task for authorized user")
        void shouldUpdateTaskForAuthorizedUser() {
            var dto = new TaskDTO(null, null, null, "PROJ", "Updated Task", "new desc",
                    TaskStatus.IN_PROGRESS, null, null, null, null, null, null, null, null, null, 50, TaskPriority.HIGH);

            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            when(taskRepository.findByTaskKey("PROJ-1")).thenReturn(Optional.of(existingTask));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

            var result = taskService.updateTask("PROJ", "PROJ-1", dto, 1, null);

            assertEquals("Updated Task", result.summary());
            assertEquals(TaskStatus.IN_PROGRESS, result.status());
            assertEquals(50, result.progress());
        }

        @Test
        @DisplayName("should throw when task does not belong to project")
        void shouldThrowWhenTaskNotInProject() {
            var otherProject = TestEntityFactory.createProject(99, "OTHER", owner);
            var otherTask = TestEntityFactory.createTask(200, 1, otherProject);

            var dto = new TaskDTO(null, null, null, "PROJ", "Task", "desc",
                    null, null, null, null, null, null, null, null, null, null, null, null);

            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            when(taskRepository.findByTaskKey("OTHER-1")).thenReturn(Optional.of(otherTask));

            assertThrows(ValidationException.class, () ->
                    taskService.updateTask("PROJ", "OTHER-1", dto, 1, null));
        }
    }

    @Nested
    @DisplayName("deleteTask")
    class DeleteTaskTests {

        private Task existingTask;

        @BeforeEach
        void setUpTask() {
            existingTask = TestEntityFactory.createTask(100, 1, project);
        }

        @Test
        @DisplayName("should delete task for project owner")
        void shouldDeleteTaskForProjectOwner() {
            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            when(taskRepository.findByTaskKey("PROJ-1")).thenReturn(Optional.of(existingTask));

            taskService.deleteTask("PROJ", "PROJ-1", 1);

            verify(taskRepository).delete(existingTask);
            verify(fileStorageService).deleteFilesSilently(existingTask.getAttachments());
        }

        @Test
        @DisplayName("should throw when non-owner tries to delete task")
        void shouldThrowWhenNonOwnerDeletesTask() {
            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));

            assertThrows(AuthorizationException.class, () ->
                    taskService.deleteTask("PROJ", "PROJ-1", 2));
            verify(taskRepository, never()).delete(any());
        }

        @Test
        @DisplayName("should throw when task not found")
        void shouldThrowWhenTaskNotFound() {
            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            when(taskRepository.findByTaskKey("PROJ-999")).thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class, () ->
                    taskService.deleteTask("PROJ", "PROJ-999", 1));
        }

        @Test
        @DisplayName("should throw when task does not belong to project on delete")
        void shouldThrowWhenTaskNotInProjectOnDelete() {
            var otherProject = TestEntityFactory.createProject(99, "OTHER", owner);
            var otherTask = TestEntityFactory.createTask(200, 1, otherProject);

            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            when(taskRepository.findByTaskKey("OTHER-1")).thenReturn(Optional.of(otherTask));

            assertThrows(ValidationException.class, () ->
                    taskService.deleteTask("PROJ", "OTHER-1", 1));
        }
    }

    @Nested
    @DisplayName("convertToDTO")
    class ConvertToDTOTests {

        @Test
        @DisplayName("should convert task with all fields")
        void shouldConvertTaskWithAllFields() {
            var task = TestEntityFactory.createTask(100, 3, project);
            task.setAssignee(assignee);
            task.setLabels("bug,frontend");
            task.setStatus(TaskStatus.IN_PROGRESS);
            task.setPriority(TaskPriority.HIGH);
            task.setProgress(75);

            var result = taskService.convertToDTO(task);

            assertEquals(100, result.id());
            assertEquals(3, result.taskNumber());
            assertEquals("PROJ-3", result.taskKey());
            assertEquals("PROJ", result.projectKey());
            assertEquals("assignee@example.com", result.assignee());
            assertEquals(List.of("bug", "frontend"), result.labels());
            assertEquals(TaskStatus.IN_PROGRESS, result.status());
            assertEquals(TaskPriority.HIGH, result.priority());
            assertEquals(75, result.progress());
        }

        @Test
        @DisplayName("should convert task with null assignee")
        void shouldConvertTaskWithNullAssignee() {
            var task = TestEntityFactory.createTask(100, 1, project);
            task.setAssignee(null);

            var result = taskService.convertToDTO(task);

            assertNull(result.assignee());
        }

        @Test
        @DisplayName("should return null labels when labels string is null")
        void shouldReturnNullLabelsWhenEmpty() {
            var task = TestEntityFactory.createTask(100, 1, project);
            task.setLabels(null);

            var result = taskService.convertToDTO(task);

            assertNull(result.labels());
        }
    }

    @Nested
    @DisplayName("validateTaskDTO")
    class ValidateTaskDTOTests {

        @Test
        @DisplayName("should throw when progress is negative")
        void shouldThrowWhenProgressNegative() {
            var dto = new TaskDTO(null, null, null, null, "Task", "desc",
                    null, null, null, null, null, null, null, null, null, null, -1, null);

            assertThrows(ValidationException.class, () -> taskService.validateTaskDTO(dto));
        }

        @Test
        @DisplayName("should throw when progress exceeds 100")
        void shouldThrowWhenProgressExceeds100() {
            var dto = new TaskDTO(null, null, null, null, "Task", "desc",
                    null, null, null, null, null, null, null, null, null, null, 101, null);

            assertThrows(ValidationException.class, () -> taskService.validateTaskDTO(dto));
        }

        @Test
        @DisplayName("should throw when label contains comma")
        void shouldThrowWhenLabelContainsComma() {
            var dto = new TaskDTO(null, null, null, null, "Task", "desc",
                    null, null, null, null, List.of("label,with,commas"), null, null, null, null, null, null, null);

            assertThrows(ValidationException.class, () -> taskService.validateTaskDTO(dto));
        }

        @Test
        @DisplayName("should pass validation for valid DTO")
        void shouldPassForValidDTO() {
            var dto = new TaskDTO(null, null, null, null, "Valid Task", "desc",
                    null, null, null, null, List.of("bug", "frontend"), null, null, null, null, null, 50, null);

            assertDoesNotThrow(() -> taskService.validateTaskDTO(dto));
        }
    }
}
