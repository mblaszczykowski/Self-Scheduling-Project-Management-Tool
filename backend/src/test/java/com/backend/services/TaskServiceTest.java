package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.dtos.TaskDTO;
import com.backend.entities.*;
import com.backend.events.NotificationEvent;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import com.backend.repositories.UserRepository;
import com.backend.requests.TaskRequest;
import com.backend.util.AccessGuard;
import com.backend.util.EntityMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

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
    private TaskActivityService taskActivityService;

    @Mock
    private EntityMapper entityMapper;

    @Mock
    private AccessGuard accessGuard;

    @Mock
    private ApplicationEventPublisher applicationEventPublisher;

    private TaskService taskService;

    private User owner;
    private User assignee;
    private Project project;

    @BeforeEach
    void setUp() {
        taskService = new TaskService(taskRepository, projectRepository,
                fileStorageService, userRepository, taskActivityService,
                entityMapper, accessGuard, applicationEventPublisher);

        owner = TestEntityFactory.createUser(1, "owner@example.com");
        assignee = TestEntityFactory.createUser(2, "assignee@example.com");
        project = TestEntityFactory.createProject(10, "PROJ", owner);
        project.replaceMembers(java.util.Set.of(owner, assignee));
    }

    private TaskDTO createTaskDTOFromTask(Task t) {
        return new TaskDTO(t.getId(), t.getTaskNumber(), t.getTaskKey(),
                t.getProject().getProjectKey(), t.getSummary(), t.getDescription(),
                t.getStatus(), t.getStartDate(), t.getDueDate(),
                t.getAssignee() != null ? t.getAssignee().getEmail() : null,
                t.getLabels() != null && !t.getLabels().isEmpty()
                        ? java.util.Arrays.asList(t.getLabels().split(",")) : null,
                null, null, null, t.getCreated(), t.getUpdated(),
                t.getProgress(), t.getPriority());
    }

    @Nested
    @DisplayName("createTask")
    class CreateTaskTests {

        @Test
        @DisplayName("should create task with valid data and allocate task number")
        void shouldCreateTaskWithValidData() {
            var request = new TaskRequest("New Task", "desc",
                    TaskStatus.TODO, TaskPriority.HIGH, 0,
                    LocalDate.now(), LocalDate.now().plusDays(7),
                    null, null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> {
                Task t = inv.getArgument(0);
                t.setId(100);
                return t;
            });
            when(projectRepository.save(any(Project.class))).thenReturn(project);
            when(entityMapper.toTaskDTO(any(Task.class))).thenAnswer(inv -> {
                Task t = inv.getArgument(0);
                return createTaskDTOFromTask(t);
            });

            var result = taskService.createTask("PROJ", request, 1, null);

            assertNotNull(result);
            assertEquals("New Task", result.summary());
            assertEquals(1, result.taskNumber());
            verify(projectRepository).save(project);
        }

        @Test
        @DisplayName("should allocate incrementing task numbers")
        void shouldAllocateIncrementingTaskNumbers() {
            project.setNextTaskNumber(5);

            var request = new TaskRequest("Task Five", "desc",
                    null, null, null,
                    null, null, null, null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
            when(projectRepository.save(any(Project.class))).thenReturn(project);
            when(entityMapper.toTaskDTO(any(Task.class))).thenAnswer(inv -> {
                Task t = inv.getArgument(0);
                return createTaskDTOFromTask(t);
            });

            var result = taskService.createTask("PROJ", request, 1, null);

            assertEquals(5, result.taskNumber());
            assertEquals(6, project.getNextTaskNumber());
        }

        @Test
        @DisplayName("should throw when project not found")
        void shouldThrowWhenProjectNotFound() {
            var request = new TaskRequest("Task", "desc",
                    null, null, null,
                    null, null, null, null, null, null);

            when(projectRepository.findByProjectKeyWithLock("NOPE")).thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class, () ->
                    taskService.createTask("NOPE", request, 1, null));
        }

        @Test
        @DisplayName("should throw when user has no access to project")
        void shouldThrowWhenUserHasNoAccess() {
            var request = new TaskRequest("Task", "desc",
                    null, null, null,
                    null, null, null, null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            doThrow(new ResourceNotFoundException("Project not found"))
                    .when(accessGuard).requireAccess(project, 99);

            assertThrows(ResourceNotFoundException.class, () ->
                    taskService.createTask("PROJ", request, 99, null));
        }

        @Test
        @DisplayName("should notify assignee when different from creator")
        void shouldNotifyAssigneeWhenDifferentFromCreator() {
            var request = new TaskRequest("Assigned Task", "desc",
                    null, null, null,
                    null, null, "assignee@example.com", null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(userRepository.findByEmail("assignee@example.com")).thenReturn(Optional.of(assignee));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> {
                Task t = inv.getArgument(0);
                t.setId(100);
                return t;
            });
            when(projectRepository.save(any(Project.class))).thenReturn(project);
            when(entityMapper.toTaskDTO(any(Task.class))).thenAnswer(inv -> {
                Task t = inv.getArgument(0);
                return createTaskDTOFromTask(t);
            });

            taskService.createTask("PROJ", request, 1, null);

            var captor = ArgumentCaptor.forClass(NotificationEvent.class);
            verify(applicationEventPublisher).publishEvent(captor.capture());
            assertEquals(assignee, captor.getValue().recipient());
            assertTrue(captor.getValue().message().contains("assigned"));
            assertEquals(NotificationType.TASK_ASSIGNED, captor.getValue().type());
        }

        @Test
        @DisplayName("should not notify when assignee is the creator")
        void shouldNotNotifyWhenAssigneeIsCreator() {
            var request = new TaskRequest("Self Task", "desc",
                    null, null, null,
                    null, null, "owner@example.com", null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
            when(projectRepository.save(any(Project.class))).thenReturn(project);
            when(entityMapper.toTaskDTO(any(Task.class))).thenAnswer(inv -> {
                Task t = inv.getArgument(0);
                return createTaskDTOFromTask(t);
            });

            taskService.createTask("PROJ", request, 1, null);

            verify(applicationEventPublisher, never()).publishEvent(any(NotificationEvent.class));
        }

        @Test
        @DisplayName("should throw when assignee not found")
        void shouldThrowWhenAssigneeNotFound() {
            var request = new TaskRequest("Task", "desc",
                    null, null, null,
                    null, null, "nobody@example.com", null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

            assertThrows(ValidationException.class, () ->
                    taskService.createTask("PROJ", request, 1, null));
        }

        @Test
        @DisplayName("should default status to BACKLOG when not specified")
        void shouldDefaultStatusToBacklog() {
            var request = new TaskRequest("Task", "desc",
                    null, null, null,
                    null, null, null, null, null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
            when(projectRepository.save(any(Project.class))).thenReturn(project);
            when(entityMapper.toTaskDTO(any(Task.class))).thenAnswer(inv -> {
                Task t = inv.getArgument(0);
                return createTaskDTOFromTask(t);
            });

            var result = taskService.createTask("PROJ", request, 1, null);

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
            var request = new TaskRequest("Updated Task", "new desc",
                    TaskStatus.IN_PROGRESS, TaskPriority.HIGH, 50,
                    null, null, null, null, null, null);

            when(accessGuard.getAccessibleProject("PROJ", 1)).thenReturn(project);
            when(taskRepository.findByTaskKey("PROJ-1")).thenReturn(Optional.of(existingTask));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
            when(entityMapper.toTaskDTO(any(Task.class))).thenAnswer(inv -> {
                Task t = inv.getArgument(0);
                return createTaskDTOFromTask(t);
            });

            var result = taskService.updateTask("PROJ", "PROJ-1", request, 1, null);

            assertEquals("Updated Task", result.summary());
            assertEquals(TaskStatus.IN_PROGRESS, result.status());
            assertEquals(50, result.progress());
        }

        @Test
        @DisplayName("should throw when task does not belong to project")
        void shouldThrowWhenTaskNotInProject() {
            var otherProject = TestEntityFactory.createProject(99, "OTHER", owner);
            var otherTask = TestEntityFactory.createTask(200, 1, otherProject);

            var request = new TaskRequest("Task", "desc",
                    null, null, null,
                    null, null, null, null, null, null);

            when(accessGuard.getAccessibleProject("PROJ", 1)).thenReturn(project);
            when(taskRepository.findByTaskKey("OTHER-1")).thenReturn(Optional.of(otherTask));
            doThrow(new ValidationException("Task does not belong to the specified project"))
                    .when(accessGuard).verifyTaskInProject(otherTask, project);

            assertThrows(ValidationException.class, () ->
                    taskService.updateTask("PROJ", "OTHER-1", request, 1, null));
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
            when(accessGuard.getOwnedProject("PROJ", 1)).thenReturn(project);
            when(taskRepository.findByTaskKey("PROJ-1")).thenReturn(Optional.of(existingTask));

            taskService.deleteTask("PROJ", "PROJ-1", 1);

            verify(taskRepository).delete(existingTask);
            verify(fileStorageService).deleteFilesSilently(existingTask.getAttachments());
        }

        @Test
        @DisplayName("should throw when non-owner tries to delete task")
        void shouldThrowWhenNonOwnerDeletesTask() {
            when(accessGuard.getOwnedProject("PROJ", 2))
                    .thenThrow(new AuthorizationException("Only project owner can perform this action"));

            assertThrows(AuthorizationException.class, () ->
                    taskService.deleteTask("PROJ", "PROJ-1", 2));
            verify(taskRepository, never()).delete(any());
        }

        @Test
        @DisplayName("should throw when task not found")
        void shouldThrowWhenTaskNotFound() {
            when(accessGuard.getOwnedProject("PROJ", 1)).thenReturn(project);
            when(taskRepository.findByTaskKey("PROJ-999")).thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class, () ->
                    taskService.deleteTask("PROJ", "PROJ-999", 1));
        }

        @Test
        @DisplayName("should throw when task does not belong to project on delete")
        void shouldThrowWhenTaskNotInProjectOnDelete() {
            var otherProject = TestEntityFactory.createProject(99, "OTHER", owner);
            var otherTask = TestEntityFactory.createTask(200, 1, otherProject);

            when(accessGuard.getOwnedProject("PROJ", 1)).thenReturn(project);
            when(taskRepository.findByTaskKey("OTHER-1")).thenReturn(Optional.of(otherTask));
            doThrow(new ValidationException("Task does not belong to the specified project"))
                    .when(accessGuard).verifyTaskInProject(otherTask, project);

            assertThrows(ValidationException.class, () ->
                    taskService.deleteTask("PROJ", "OTHER-1", 1));
        }
    }

    @Nested
    @DisplayName("convertToDTO")
    class ConvertToDTOTests {

        @Test
        @DisplayName("should delegate to entityMapper")
        void shouldDelegateToEntityMapper() {
            var task = TestEntityFactory.createTask(100, 3, project);
            task.setAssignee(assignee);
            task.setLabels("bug,frontend");
            task.setStatus(TaskStatus.IN_PROGRESS);
            task.setPriority(TaskPriority.HIGH);
            task.setProgress(75);

            var expectedDTO = new TaskDTO(100, 3, "PROJ-3", "PROJ", task.getSummary(),
                    task.getDescription(), TaskStatus.IN_PROGRESS, null, null,
                    "assignee@example.com", List.of("bug", "frontend"), null, null, null,
                    task.getCreated(), task.getUpdated(), 75, TaskPriority.HIGH);
            when(entityMapper.toTaskDTO(task)).thenReturn(expectedDTO);

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
            verify(entityMapper).toTaskDTO(task);
        }

        @Test
        @DisplayName("should handle null assignee via entityMapper")
        void shouldHandleNullAssignee() {
            var task = TestEntityFactory.createTask(100, 1, project);
            task.setAssignee(null);

            var expectedDTO = new TaskDTO(100, 1, "PROJ-1", "PROJ", task.getSummary(),
                    task.getDescription(), task.getStatus(), null, null,
                    null, null, null, null, null, task.getCreated(), task.getUpdated(),
                    task.getProgress(), task.getPriority());
            when(entityMapper.toTaskDTO(task)).thenReturn(expectedDTO);

            var result = taskService.convertToDTO(task);

            assertNull(result.assignee());
        }

        @Test
        @DisplayName("should handle null labels via entityMapper")
        void shouldHandleNullLabels() {
            var task = TestEntityFactory.createTask(100, 1, project);
            task.setLabels(null);

            var expectedDTO = new TaskDTO(100, 1, "PROJ-1", "PROJ", task.getSummary(),
                    task.getDescription(), task.getStatus(), null, null,
                    null, null, null, null, null, task.getCreated(), task.getUpdated(),
                    task.getProgress(), task.getPriority());
            when(entityMapper.toTaskDTO(task)).thenReturn(expectedDTO);

            var result = taskService.convertToDTO(task);

            assertNull(result.labels());
        }
    }

    @Nested
    @DisplayName("label validation")
    class LabelValidationTests {

        @Test
        @DisplayName("should throw when label contains comma")
        void shouldThrowWhenLabelContainsComma() {
            var request = new TaskRequest("Task", "desc",
                    null, null, null,
                    null, null, null, List.of("label,with,commas"), null, null);

            // Label validation runs first, before any repository access.
            assertThrows(ValidationException.class, () ->
                    taskService.createTask("PROJ", request, 1, null));
        }

        @Test
        @DisplayName("should accept valid labels")
        void shouldAcceptValidLabels() {
            var request = new TaskRequest("Valid Task", "desc",
                    null, null, 50,
                    null, null, null, List.of("bug", "frontend"), null, null);

            when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
            when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
            when(projectRepository.save(any(Project.class))).thenReturn(project);
            when(entityMapper.toTaskDTO(any(Task.class))).thenAnswer(inv -> {
                Task t = inv.getArgument(0);
                return createTaskDTOFromTask(t);
            });

            assertDoesNotThrow(() ->
                    taskService.createTask("PROJ", request, 1, null));
        }
    }
}
