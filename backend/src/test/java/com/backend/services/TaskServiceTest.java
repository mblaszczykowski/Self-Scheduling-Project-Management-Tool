package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.dtos.TaskDTO;
import com.backend.entities.NotificationType;
import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import com.backend.requests.TaskRequest;
import com.backend.requests.TaskScheduleRequest;
import com.backend.scheduling.SchedulingService;
import com.backend.security.AccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Behavioural tests for {@link TaskService}.
 *
 * <p>{@link EntityMapper} is deliberately a real instance rather than a mock: a mapping assertion
 * against a stubbed mapper only restates the stub, whereas here the DTO the caller receives is
 * really built from the entity the service wrote.
 */
@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    private static final LocalDate MONDAY = LocalDate.of(2025, 3, 3);
    private static final LocalDate FRIDAY = LocalDate.of(2025, 3, 7);
    private static final String NOT_A_MEMBER = "Assignee must be a member of this project";

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private UserService userService;

    @Mock
    private TaskActivityService taskActivityService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private AccessGuard accessGuard;

    @Mock
    private SchedulingService schedulingService;

    private final EntityMapper entityMapper = new EntityMapper();

    private TaskService taskService;

    private User owner;
    private User member;
    private User outsider;
    private Project project;

    @BeforeEach
    void setUp() {
        taskService = new TaskService(taskRepository, projectRepository, fileStorageService,
                userService, taskActivityService, notificationService, entityMapper, accessGuard,
                schedulingService);

        owner = TestEntityFactory.createUser(1, "owner@example.com");
        member = TestEntityFactory.createUser(2, "member@example.com");
        outsider = TestEntityFactory.createUser(3, "outsider@example.com");
        project = TestEntityFactory.createProjectWithMembers(10, "PROJ", owner, member);
    }

    // ======================== Fixtures ========================

    /** A task request in which a test names only the fields it is about. */
    private static final class Req {
        private String summary = "Task summary";
        private String description = "Task description";
        private TaskStatus status;
        private TaskPriority priority;
        private Integer progress;
        private LocalDate startDate;
        private LocalDate dueDate;
        private String assignee;
        private List<String> labels;
        private List<String> dependencyKeys;
        private List<String> attachments;

        Req summary(String value) { this.summary = value; return this; }
        Req description(String value) { this.description = value; return this; }
        Req status(TaskStatus value) { this.status = value; return this; }
        Req priority(TaskPriority value) { this.priority = value; return this; }
        Req progress(Integer value) { this.progress = value; return this; }
        Req dates(LocalDate start, LocalDate due) { this.startDate = start; this.dueDate = due; return this; }
        Req assignee(String value) { this.assignee = value; return this; }
        Req labels(List<String> value) { this.labels = value; return this; }
        Req dependencies(List<String> value) { this.dependencyKeys = value; return this; }
        Req attachments(List<String> value) { this.attachments = value; return this; }

        TaskRequest build() {
            return new TaskRequest(summary, description, status, priority, progress,
                    startDate, dueDate, assignee, labels, dependencyKeys, attachments);
        }
    }

    private static Req request() {
        return new Req();
    }

    private void givenLockedProject() {
        when(projectRepository.findByProjectKeyWithLock("PROJ")).thenReturn(Optional.of(project));
    }

    private void givenAuthor(User user) {
        when(userService.getRequiredUserById(user.getId())).thenReturn(user);
    }

    private void givenTaskIsSavedAsIs() {
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private Task givenExistingTask() {
        var task = TestEntityFactory.createTask(100, 1, project);
        when(accessGuard.getAccessibleProject("PROJ", 1)).thenReturn(project);
        when(taskRepository.findByTaskKey("PROJ-1")).thenReturn(Optional.of(task));
        return task;
    }

    private Task savedTask() {
        var captor = ArgumentCaptor.forClass(Task.class);
        verify(taskRepository).save(captor.capture());
        return captor.getValue();
    }

    private List<NotificationService.Pending> notifiedBatch() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<NotificationService.Pending>> captor = ArgumentCaptor.forClass(List.class);
        verify(notificationService).notifyAll(captor.capture());
        return captor.getValue();
    }

    private TaskSnapshot[] loggedSnapshots(Task task) {
        var before = ArgumentCaptor.forClass(TaskSnapshot.class);
        var after = ArgumentCaptor.forClass(TaskSnapshot.class);
        verify(taskActivityService).logFieldChanges(eq(task), eq(owner), before.capture(), after.capture());
        return new TaskSnapshot[]{before.getValue(), after.getValue()};
    }

    // ======================== Tests ========================

    @Nested
    @DisplayName("createTask")
    class CreateTaskTests {

        @Test
        @DisplayName("stores the submitted representation and allocates the project's next task number")
        void shouldStoreSubmittedRepresentation() {
            project.setNextTaskNumber(7);
            givenLockedProject();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();

            var result = taskService.createTask("PROJ", request()
                    .summary("Write the report")
                    .description("Chapter five")
                    .status(TaskStatus.IN_PROGRESS)
                    .priority(TaskPriority.HIGH)
                    .progress(30)
                    .dates(MONDAY, FRIDAY)
                    .labels(List.of("thesis", " writing "))
                    .build(), 1, null);

            var stored = savedTask();
            assertThat(stored.getProject()).isSameAs(project);
            assertThat(stored.getTaskNumber()).isEqualTo(7);
            assertThat(stored.getLabels()).isEqualTo("thesis,writing");
            assertThat(project.getNextTaskNumber()).isEqualTo(8);

            assertThat(result.taskKey()).isEqualTo("PROJ-7");
            assertThat(result.projectKey()).isEqualTo("PROJ");
            assertThat(result.summary()).isEqualTo("Write the report");
            assertThat(result.description()).isEqualTo("Chapter five");
            assertThat(result.status()).isEqualTo(TaskStatus.IN_PROGRESS);
            assertThat(result.priority()).isEqualTo(TaskPriority.HIGH);
            assertThat(result.progress()).isEqualTo(30);
            assertThat(result.startDate()).isEqualTo(MONDAY);
            assertThat(result.dueDate()).isEqualTo(FRIDAY);
            assertThat(result.labels()).containsExactly("thesis", "writing");
        }

        @Test
        @DisplayName("checks access before storing any uploaded file, because storage is not transactional")
        void shouldCheckAccessBeforeStoringFiles() {
            var upload = mock(MultipartFile.class);
            givenLockedProject();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();

            taskService.createTask("PROJ", request().build(), 1, List.of(upload));

            var order = inOrder(accessGuard, fileStorageService, taskRepository);
            order.verify(accessGuard).requireAccess(project, 1);
            order.verify(fileStorageService).storeFiles(List.of(upload), 10, 1);
            order.verify(taskRepository).save(any(Task.class));
        }

        @Test
        @DisplayName("defaults status, priority and progress when the request omits them")
        void shouldApplyDefaults() {
            givenLockedProject();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();

            var result = taskService.createTask("PROJ", request().build(), 1, null);

            assertThat(result.status()).isEqualTo(TaskStatus.BACKLOG);
            assertThat(result.priority()).isEqualTo(TaskPriority.MEDIUM);
            assertThat(result.progress()).isZero();
            assertThat(result.labels()).isEmpty();
            assertThat(result.attachments()).isEmpty();
            assertThat(result.dependencyKeys()).isEmpty();
        }

        @Test
        @DisplayName("reports the project as missing when its key is unknown")
        void shouldThrowWhenProjectDoesNotExist() {
            when(projectRepository.findByProjectKeyWithLock("NOPE")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> taskService.createTask("NOPE", request().build(), 1, null))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Project not found");
            verify(taskRepository, never()).save(any());
        }

        @Test
        @DisplayName("rejects a label containing a comma, since labels are stored comma-joined")
        void shouldRejectLabelContainingComma() {
            givenLockedProject();
            givenAuthor(owner);

            assertThatThrownBy(() -> taskService.createTask("PROJ",
                    request().labels(List.of("bug,frontend")).build(), 1, null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Labels cannot contain commas");
            verify(taskRepository, never()).save(any());
        }

        @Test
        @DisplayName("validates the declared attachments against the project and appends the uploads")
        void shouldValidateDeclaredAttachmentsAndAppendUploads() {
            var upload = mock(MultipartFile.class);
            givenLockedProject();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();
            when(fileStorageService.storeFiles(List.of(upload), 10, 1))
                    .thenReturn(List.of("/files/fresh.png"));

            var result = taskService.createTask("PROJ",
                    request().attachments(List.of("/files/existing.pdf")).build(), 1, List.of(upload));

            verify(fileStorageService).requireAttachmentsBelongTo(10, List.of("/files/existing.pdf"));
            assertThat(savedTask().getAttachments())
                    .containsExactly("/files/existing.pdf", "/files/fresh.png");
            assertThat(result.attachments())
                    .containsExactly("/files/existing.pdf", "/files/fresh.png");
        }

        @Test
        @DisplayName("notifies the assignee when the author assigned the task to somebody else")
        void shouldNotifyAssignee() {
            givenLockedProject();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();
            when(userService.findUserByEmailOrNull("member@example.com")).thenReturn(member);

            taskService.createTask("PROJ",
                    request().summary("Review chapter").assignee("member@example.com").build(), 1, null);

            var message = ArgumentCaptor.forClass(String.class);
            verify(notificationService).createNotification(eq(member), message.capture(),
                    eq(NotificationType.TASK_ASSIGNED), eq("/projects?selectedIssue=PROJ-1"));
            assertThat(message.getValue()).isEqualTo("You have been assigned to task: Review chapter");
        }

        @Test
        @DisplayName("stays silent when the author assigned the task to themselves")
        void shouldNotNotifyWhenAuthorAssignsToThemselves() {
            givenLockedProject();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();
            when(userService.findUserByEmailOrNull("owner@example.com")).thenReturn(owner);

            taskService.createTask("PROJ", request().assignee("owner@example.com").build(), 1, null);

            assertThat(savedTask().getAssignee()).isEqualTo(owner);
            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("records a creation entry in the activity feed")
        void shouldLogCreation() {
            givenLockedProject();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();

            taskService.createTask("PROJ", request().build(), 1, null);

            var stored = savedTask();
            verify(taskActivityService).logCreated(stored, owner);
        }

        @Test
        @DisplayName("fills the critical-path flag of its own response instead of leaving it null")
        void shouldPopulateCriticalPathFlag() {
            var sibling = TestEntityFactory.createTask(101, 2, project);
            givenLockedProject();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();
            when(taskRepository.findByProjectIdWithDetails(10)).thenReturn(List.of(sibling));
            when(schedulingService.criticalTaskKeys(anyList(), any(LocalDate.class)))
                    .thenReturn(Set.of("PROJ-1"));

            var result = taskService.createTask("PROJ", request().build(), 1, null);

            assertThat(result.taskKey()).isEqualTo("PROJ-1");
            assertThat(result.isCritical()).isTrue();

            // The flags are computed over the whole project, not over the single written task.
            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<TaskDTO>> analysed = ArgumentCaptor.forClass(List.class);
            verify(schedulingService).criticalTaskKeys(analysed.capture(), any(LocalDate.class));
            assertThat(analysed.getValue()).extracting(TaskDTO::taskKey).containsExactly("PROJ-2");
        }

        @Test
        @DisplayName("reports a task off the critical path as not critical rather than unknown")
        void shouldReportNonCriticalTaskAsFalse() {
            givenLockedProject();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();

            var result = taskService.createTask("PROJ", request().build(), 1, null);

            assertThat(result.isCritical()).isFalse();
        }
    }

    @Nested
    @DisplayName("assignee resolution")
    class AssigneeResolutionTests {

        @Test
        @DisplayName("refuses an address that belongs to nobody")
        void shouldRefuseUnknownAddress() {
            givenLockedProject();
            givenAuthor(owner);
            when(userService.findUserByEmailOrNull("ghost@example.com")).thenReturn(null);

            assertThatThrownBy(() -> taskService.createTask("PROJ",
                    request().assignee("ghost@example.com").build(), 1, null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage(NOT_A_MEMBER);
            verify(taskRepository, never()).save(any());
        }

        @Test
        @DisplayName("refuses a registered user who is not part of the project")
        void shouldRefuseNonMember() {
            givenLockedProject();
            givenAuthor(owner);
            when(userService.findUserByEmailOrNull("outsider@example.com")).thenReturn(outsider);

            assertThatThrownBy(() -> taskService.createTask("PROJ",
                    request().assignee("outsider@example.com").build(), 1, null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage(NOT_A_MEMBER);
            verify(notificationService, never()).createNotification(any(), anyString(), any(), any());
        }

        @Test
        @DisplayName("gives the same answer for an unknown address and for a non-member, so it is no registration oracle")
        void shouldNotRevealWhetherAnAddressIsRegistered() {
            givenLockedProject();
            givenAuthor(owner);
            when(userService.findUserByEmailOrNull("ghost@example.com")).thenReturn(null);
            when(userService.findUserByEmailOrNull("outsider@example.com")).thenReturn(outsider);

            var unknownAddress = catchMessage(request().assignee("ghost@example.com").build());
            var nonMember = catchMessage(request().assignee("outsider@example.com").build());

            assertThat(unknownAddress).isEqualTo(nonMember).isEqualTo(NOT_A_MEMBER);
        }

        private String catchMessage(TaskRequest request) {
            try {
                taskService.createTask("PROJ", request, 1, null);
                throw new AssertionError("expected the assignee to be rejected");
            } catch (ValidationException e) {
                return e.getMessage();
            }
        }

        @Test
        @DisplayName("treats a blank assignee as unassigned without looking anybody up")
        void shouldTreatBlankAssigneeAsUnassigned() {
            givenLockedProject();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();

            var result = taskService.createTask("PROJ", request().assignee("   ").build(), 1, null);

            assertThat(savedTask().getAssignee()).isNull();
            assertThat(result.assignee()).isNull();
            verify(userService, never()).findUserByEmailOrNull(anyString());
            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("accepts a member of the project")
        void shouldAcceptMember() {
            givenLockedProject();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();
            when(userService.findUserByEmailOrNull("member@example.com")).thenReturn(member);

            var result = taskService.createTask("PROJ",
                    request().assignee("member@example.com").build(), 1, null);

            assertThat(savedTask().getAssignee()).isEqualTo(member);
            assertThat(result.assignee()).isEqualTo("member@example.com");
        }
    }

    @Nested
    @DisplayName("dependency resolution")
    class DependencyResolutionTests {

        @Test
        @DisplayName("rejects a key that is not a task key at all")
        void shouldRejectMalformedKey() {
            givenLockedProject();
            givenAuthor(owner);

            assertThatThrownBy(() -> taskService.createTask("PROJ",
                    request().dependencies(List.of("not a task key")).build(), 1, null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Invalid task key: not a task key");
            verify(taskRepository, never()).save(any());
        }

        @Test
        @DisplayName("rejects a well-formed key that resolves to nothing instead of dropping it silently")
        void shouldRejectUnresolvableKey() {
            givenLockedProject();
            givenAuthor(owner);
            when(taskRepository.findByProjectKeyAndTaskNumbers("PROJ", List.of(999)))
                    .thenReturn(List.of());

            assertThatThrownBy(() -> taskService.createTask("PROJ",
                    request().dependencies(List.of("PROJ-999")).build(), 1, null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("One or more dependency tasks do not exist");
            verify(taskRepository, never()).save(any());
        }

        @Test
        @DisplayName("refuses to point a dependency at a task in a project the caller cannot see")
        void shouldRefuseDependencyInInaccessibleProject() {
            var foreignProject = TestEntityFactory.createProject(20, "OTHER", outsider);
            var foreignTask = TestEntityFactory.createTask(200, 4, foreignProject);
            givenLockedProject();
            givenAuthor(owner);
            when(taskRepository.findByProjectKeyAndTaskNumbers("OTHER", List.of(4)))
                    .thenReturn(List.of(foreignTask));

            assertThatThrownBy(() -> taskService.createTask("PROJ",
                    request().dependencies(List.of("OTHER-4")).build(), 1, null))
                    .isInstanceOf(AuthorizationException.class)
                    .hasMessage("Cannot create dependency to task in inaccessible project: OTHER-4");
            verify(taskRepository, never()).save(any());
        }

        @Test
        @DisplayName("links every resolved predecessor, querying one project at a time")
        void shouldLinkResolvedDependencies() {
            var sibling = TestEntityFactory.createTask(101, 2, project);
            var another = TestEntityFactory.createTask(102, 3, project);
            var sharedProject = TestEntityFactory.createProjectWithMembers(20, "SHARED", outsider, owner);
            var sharedTask = TestEntityFactory.createTask(201, 5, sharedProject);
            givenLockedProject();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();
            when(taskRepository.findByProjectKeyAndTaskNumbers("PROJ", List.of(2, 3)))
                    .thenReturn(List.of(sibling, another));
            when(taskRepository.findByProjectKeyAndTaskNumbers("SHARED", List.of(5)))
                    .thenReturn(List.of(sharedTask));

            var result = taskService.createTask("PROJ", request()
                    .dependencies(List.of("PROJ-2", "SHARED-5", "PROJ-3", "PROJ-2"))
                    .build(), 1, null);

            assertThat(savedTask().getDependencies())
                    .containsExactlyInAnyOrder(sibling, another, sharedTask);
            assertThat(result.dependencyKeys())
                    .containsExactlyInAnyOrder("PROJ-2", "PROJ-3", "SHARED-5");
        }

        @Test
        @DisplayName("detects a cycle that would make a task depend on itself")
        void shouldDetectCycle() {
            var task = givenExistingTask();
            var predecessor = TestEntityFactory.createTask(101, 2, project);
            predecessor.replaceDependencies(List.of(task));
            givenAuthor(owner);
            when(taskRepository.findByProjectKeyAndTaskNumbers("PROJ", List.of(2)))
                    .thenReturn(List.of(predecessor));

            assertThatThrownBy(() -> taskService.updateTask("PROJ", "PROJ-1",
                    request().dependencies(List.of("PROJ-2")).build(), 1, null))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Circular dependency detected: a task cannot depend on itself");
            verify(taskRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("updateTask")
    class UpdateTaskTests {

        @Test
        @DisplayName("replaces every field the request carries")
        void shouldReplaceSubmittedFields() {
            var task = givenExistingTask();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();
            when(userService.findUserByEmailOrNull("member@example.com")).thenReturn(member);

            var result = taskService.updateTask("PROJ", "PROJ-1", request()
                    .summary("Reworked")
                    .description("New body")
                    .status(TaskStatus.IN_PROGRESS)
                    .priority(TaskPriority.HIGHEST)
                    .progress(80)
                    .dates(MONDAY, FRIDAY)
                    .assignee("member@example.com")
                    .labels(List.of("urgent"))
                    .build(), 1, null);

            assertThat(task.getSummary()).isEqualTo("Reworked");
            assertThat(task.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
            assertThat(task.getPriority()).isEqualTo(TaskPriority.HIGHEST);
            assertThat(task.getProgress()).isEqualTo(80);
            assertThat(task.getAssignee()).isEqualTo(member);
            assertThat(result.summary()).isEqualTo("Reworked");
            assertThat(result.progress()).isEqualTo(80);
            assertThat(result.dueDate()).isEqualTo(FRIDAY);
            assertThat(result.labels()).containsExactly("urgent");
        }

        @Test
        @DisplayName("clears what the full replacement leaves out, which is why the timeline uses updateSchedule instead")
        void shouldClearOmittedFields() {
            var task = givenExistingTask();
            task.setStatus(TaskStatus.IN_PROGRESS);
            task.setPriority(TaskPriority.HIGHEST);
            task.setProgress(90);
            task.setLabels("urgent");
            task.setAssignee(member);
            task.replaceAttachments(List.of("/files/spec.pdf"));
            givenAuthor(owner);
            givenTaskIsSavedAsIs();

            var result = taskService.updateTask("PROJ", "PROJ-1",
                    request().summary("Only a summary").build(), 1, null);

            assertThat(task.getStatus()).isEqualTo(TaskStatus.BACKLOG);
            assertThat(task.getPriority()).isEqualTo(TaskPriority.MEDIUM);
            assertThat(task.getProgress()).isZero();
            assertThat(task.getLabels()).isNull();
            assertThat(task.getAssignee()).isNull();
            assertThat(task.getAttachments()).isEmpty();
            assertThat(result.attachments()).isEmpty();
        }

        @Test
        @DisplayName("checks the task really belongs to the project it was addressed through")
        void shouldVerifyTaskBelongsToGuardedProject() {
            var task = givenExistingTask();
            givenAuthor(owner);
            givenTaskIsSavedAsIs();

            taskService.updateTask("PROJ", "PROJ-1", request().build(), 1, null);

            verify(accessGuard).verifyTaskInProject(task, project);
        }

        @Test
        @DisplayName("reports the task as missing when its key resolves to nothing")
        void shouldThrowWhenTaskMissing() {
            when(accessGuard.getAccessibleProject("PROJ", 1)).thenReturn(project);
            when(taskRepository.findByTaskKey("PROJ-404")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> taskService.updateTask("PROJ", "PROJ-404",
                    request().build(), 1, null))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Task not found: PROJ-404");
            verify(taskRepository, never()).save(any());
        }

        @Test
        @DisplayName("unlinks and then deletes the files the update dropped")
        void shouldDeleteDetachedAttachments() {
            var task = givenExistingTask();
            task.replaceAttachments(List.of("/files/keep.pdf", "/files/drop.pdf"));
            givenAuthor(owner);
            givenTaskIsSavedAsIs();

            taskService.updateTask("PROJ", "PROJ-1",
                    request().attachments(List.of("/files/keep.pdf")).build(), 1, null);

            assertThat(task.getAttachments()).containsExactly("/files/keep.pdf");
            // AfterCommit runs inline without a transaction, so the deletion is observable here;
            // in production it happens only once the row really lost the reference.
            verify(fileStorageService, times(1)).deleteFilesSilently(anyCollection());
            var order = inOrder(taskRepository, fileStorageService);
            order.verify(taskRepository).save(task);
            order.verify(fileStorageService).deleteFilesSilently(List.of("/files/drop.pdf"));
        }

        @Test
        @DisplayName("waits for the commit before unlinking a detached file, so a rollback cannot lose it")
        void shouldDeferFileDeletionUntilCommit() {
            var task = givenExistingTask();
            task.replaceAttachments(List.of("/files/keep.pdf", "/files/drop.pdf"));
            givenAuthor(owner);
            givenTaskIsSavedAsIs();

            TransactionSynchronizationManager.initSynchronization();
            try {
                taskService.updateTask("PROJ", "PROJ-1",
                        request().attachments(List.of("/files/keep.pdf")).build(), 1, null);

                verify(fileStorageService, never()).deleteFilesSilently(anyCollection());
                List.copyOf(TransactionSynchronizationManager.getSynchronizations())
                        .forEach(TransactionSynchronization::afterCommit);
            } finally {
                TransactionSynchronizationManager.clearSynchronization();
            }

            verify(fileStorageService).deleteFilesSilently(List.of("/files/drop.pdf"));
        }

        @Test
        @DisplayName("leaves the files alone when the update keeps referencing all of them")
        void shouldKeepReferencedFiles() {
            var task = givenExistingTask();
            task.replaceAttachments(List.of("/files/keep.pdf"));
            givenAuthor(owner);
            givenTaskIsSavedAsIs();

            taskService.updateTask("PROJ", "PROJ-1",
                    request().attachments(List.of("/files/keep.pdf")).build(), 1, null);

            verify(fileStorageService, never()).deleteFilesSilently(any());
        }

        @Test
        @DisplayName("refuses an attachment from another project before writing anything")
        void shouldRefuseForeignAttachmentBeforeWriting() {
            var task = givenExistingTask();
            task.replaceAttachments(List.of("/files/mine.pdf"));
            givenAuthor(owner);
            doThrow(new ValidationException("Attachment does not belong to this project"))
                    .when(fileStorageService).requireAttachmentsBelongTo(eq(10), anyList());

            assertThatThrownBy(() -> taskService.updateTask("PROJ", "PROJ-1",
                    request().attachments(List.of("/files/stolen.pdf")).build(), 1, null))
                    .isInstanceOf(ValidationException.class);

            // The point is the ordering: nothing is written and no file is unlinked.
            verify(taskRepository, never()).save(any());
            verify(fileStorageService, never()).deleteFilesSilently(any());
            assertThat(task.getAttachments()).containsExactly("/files/mine.pdf");
        }

        @Test
        @DisplayName("hands the activity log a before and an after picture of the task")
        void shouldLogBeforeAndAfterSnapshots() {
            var task = givenExistingTask();
            task.setProgress(10);
            task.setLabels("old");
            givenAuthor(owner);
            givenTaskIsSavedAsIs();

            taskService.updateTask("PROJ", "PROJ-1", request()
                    .summary("Renamed")
                    .status(TaskStatus.DONE)
                    .progress(100)
                    .labels(List.of("new"))
                    .build(), 1, null);

            var snapshots = loggedSnapshots(task);
            var before = snapshots[0];
            var after = snapshots[1];
            assertThat(before.summary()).isEqualTo("Task 1");
            assertThat(before.status()).isEqualTo(TaskStatus.BACKLOG);
            assertThat(before.progress()).isEqualTo(10);
            assertThat(before.labels()).containsExactly("old");
            assertThat(after.summary()).isEqualTo("Renamed");
            assertThat(after.status()).isEqualTo(TaskStatus.DONE);
            assertThat(after.progress()).isEqualTo(100);
            assertThat(after.labels()).containsExactly("new");
        }

        @Test
        @DisplayName("tells the assignee that their task changed")
        void shouldNotifyAssignee() {
            var task = givenExistingTask();
            task.setSummary("Shared task");
            task.setAssignee(member);
            givenAuthor(owner);
            givenTaskIsSavedAsIs();
            when(userService.findUserByEmailOrNull("member@example.com")).thenReturn(member);

            taskService.updateTask("PROJ", "PROJ-1", request()
                    .summary("Shared task")
                    .assignee("member@example.com")
                    .build(), 1, null);

            verify(notificationService).createNotification(member,
                    "Task 'Shared task' has been updated",
                    NotificationType.TASK_UPDATED, "/projects?selectedIssue=PROJ-1");
        }
    }

    @Nested
    @DisplayName("updateSchedule")
    class UpdateScheduleTests {

        private Task task;

        @BeforeEach
        void setUpTask() {
            task = givenExistingTask();
            task.setStatus(TaskStatus.IN_PROGRESS);
            task.setPriority(TaskPriority.HIGHEST);
            task.setProgress(65);
            task.setLabels("urgent,thesis");
            task.setAssignee(member);
            task.replaceAttachments(List.of("/files/spec.pdf"));
            task.setStartDate(MONDAY.minusWeeks(1));
            task.setDueDate(FRIDAY.minusWeeks(1));
            givenAuthor(owner);
            givenTaskIsSavedAsIs();
        }

        @Test
        @DisplayName("moves the task in time and touches nothing else")
        void shouldChangeOnlyTheDates() {
            var result = taskService.updateSchedule("PROJ", "PROJ-1",
                    new TaskScheduleRequest(MONDAY, FRIDAY), 1);

            assertThat(task.getStartDate()).isEqualTo(MONDAY);
            assertThat(task.getDueDate()).isEqualTo(FRIDAY);

            // The regression this endpoint exists to prevent: a drag that reused the full PUT reset
            // progress to 0, priority to MEDIUM and dropped every attachment.
            assertThat(task.getProgress()).isEqualTo(65);
            assertThat(task.getPriority()).isEqualTo(TaskPriority.HIGHEST);
            assertThat(task.getAttachments()).containsExactly("/files/spec.pdf");
            assertThat(task.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
            assertThat(task.getLabels()).isEqualTo("urgent,thesis");
            assertThat(task.getAssignee()).isEqualTo(member);
            assertThat(task.getSummary()).isEqualTo("Task 1");
            assertThat(task.getDescription()).isEqualTo("Description for task 1");

            assertThat(result.startDate()).isEqualTo(MONDAY);
            assertThat(result.dueDate()).isEqualTo(FRIDAY);
            assertThat(result.progress()).isEqualTo(65);
            assertThat(result.priority()).isEqualTo(TaskPriority.HIGHEST);
            assertThat(result.attachments()).containsExactly("/files/spec.pdf");
            assertThat(result.labels()).containsExactly("urgent", "thesis");
            assertThat(result.assignee()).isEqualTo("member@example.com");
        }

        @Test
        @DisplayName("cannot express an attachment change, so it never reaches file storage")
        void shouldNotTouchFileStorage() {
            taskService.updateSchedule("PROJ", "PROJ-1",
                    new TaskScheduleRequest(MONDAY, FRIDAY), 1);

            verifyNoInteractions(fileStorageService);
        }

        @Test
        @DisplayName("audits the move as a change of dates and of nothing else")
        void shouldAuditOnlyTheDates() {
            taskService.updateSchedule("PROJ", "PROJ-1",
                    new TaskScheduleRequest(MONDAY, FRIDAY), 1);

            var snapshots = loggedSnapshots(task);
            var before = snapshots[0];
            var after = snapshots[1];

            assertThat(before.startDate()).isEqualTo(MONDAY.minusWeeks(1));
            assertThat(before.dueDate()).isEqualTo(FRIDAY.minusWeeks(1));
            // Record equality makes this total: any other field that moved fails the comparison.
            assertThat(after).isEqualTo(new TaskSnapshot(before.status(), before.priority(),
                    before.assignee(), before.progress(), MONDAY, FRIDAY, before.summary(),
                    before.description(), before.labels(), before.dependencyKeys(),
                    before.attachments()));
        }

        @Test
        @DisplayName("tells the assignee that their dates moved")
        void shouldNotifyAssigneeAboutNewDates() {
            taskService.updateSchedule("PROJ", "PROJ-1",
                    new TaskScheduleRequest(MONDAY, FRIDAY), 1);

            verify(notificationService).createNotification(member,
                    "Dates changed for task: Task 1",
                    NotificationType.TASK_UPDATED, "/projects?selectedIssue=PROJ-1");
        }

        @Test
        @DisplayName("checks the task really belongs to the project it was addressed through")
        void shouldVerifyTaskBelongsToProject() {
            taskService.updateSchedule("PROJ", "PROJ-1",
                    new TaskScheduleRequest(MONDAY, FRIDAY), 1);

            verify(accessGuard).verifyTaskInProject(task, project);
        }
    }

    @Nested
    @DisplayName("applySchedule")
    class ApplyScheduleTests {

        private Task first;
        private Task second;

        @BeforeEach
        void setUpTasks() {
            first = TestEntityFactory.createTask(101, 1, project);
            second = TestEntityFactory.createTask(102, 2, project);
        }

        private void givenBatchLoads(Task... tasks) {
            var numbers = java.util.Arrays.stream(tasks).map(Task::getTaskNumber).toList();
            when(taskRepository.findByProjectKeyAndTaskNumbers("PROJ", numbers))
                    .thenReturn(List.of(tasks));
        }

        @Test
        @DisplayName("writes the optimizer's dates and reports how many tasks moved")
        void shouldWriteOptimizerDates() {
            givenAuthor(owner);
            givenBatchLoads(first, second);

            var applied = taskService.applySchedule(List.of(
                    new TaskService.ScheduleChange("PROJ-1", MONDAY, FRIDAY),
                    new TaskService.ScheduleChange("PROJ-2", FRIDAY, FRIDAY.plusDays(3))), 1);

            assertThat(applied).isEqualTo(2);
            assertThat(first.getStartDate()).isEqualTo(MONDAY);
            assertThat(first.getDueDate()).isEqualTo(FRIDAY);
            assertThat(second.getStartDate()).isEqualTo(FRIDAY);
            assertThat(second.getDueDate()).isEqualTo(FRIDAY.plusDays(3));
        }

        @Test
        @DisplayName("audits every task it moved, so bulk rescheduling leaves a trace")
        void shouldAuditEveryMovedTask() {
            givenAuthor(owner);
            givenBatchLoads(first, second);

            taskService.applySchedule(List.of(
                    new TaskService.ScheduleChange("PROJ-1", MONDAY, FRIDAY),
                    new TaskService.ScheduleChange("PROJ-2", MONDAY, FRIDAY)), 1);

            var before = ArgumentCaptor.forClass(TaskSnapshot.class);
            var after = ArgumentCaptor.forClass(TaskSnapshot.class);
            verify(taskActivityService, times(2))
                    .logFieldChanges(any(Task.class), eq(owner), before.capture(), after.capture());
            assertThat(before.getAllValues())
                    .allSatisfy(snapshot -> assertThat(snapshot.startDate()).isNull());
            assertThat(after.getAllValues()).extracting(TaskSnapshot::startDate, TaskSnapshot::dueDate)
                    .containsExactly(tuple(MONDAY, FRIDAY), tuple(MONDAY, FRIDAY));
        }

        @Test
        @DisplayName("leaves a task alone when it already sits on the requested dates")
        void shouldSkipUnchangedTask() {
            first.setStartDate(MONDAY);
            first.setDueDate(FRIDAY);
            givenAuthor(owner);
            givenBatchLoads(first, second);

            var applied = taskService.applySchedule(List.of(
                    new TaskService.ScheduleChange("PROJ-1", MONDAY, FRIDAY),
                    new TaskService.ScheduleChange("PROJ-2", MONDAY, FRIDAY)), 1);

            assertThat(applied).isEqualTo(1);
            verify(taskActivityService).logFieldChanges(eq(second), eq(owner), any(), any());
            verify(taskActivityService, never()).logFieldChanges(eq(first), any(), any(), any());
        }

        @Test
        @DisplayName("hands the assignee's notifications over as one batch instead of one per task")
        void shouldNotifyOncePerAssignee() {
            first.setAssignee(member);
            second.setAssignee(member);
            givenAuthor(owner);
            givenBatchLoads(first, second);

            taskService.applySchedule(List.of(
                    new TaskService.ScheduleChange("PROJ-1", MONDAY, FRIDAY),
                    new TaskService.ScheduleChange("PROJ-2", MONDAY, FRIDAY)), 1);

            // A single batched call is what lets NotificationService collapse the batch to one
            // notification per recipient; one createNotification per task would flood the assignee
            // of a portfolio-wide reschedule.
            verify(notificationService, never()).createNotification(any(), anyString(), any(), any());
            var batch = notifiedBatch();
            assertThat(batch).allSatisfy(pending -> {
                assertThat(pending.recipient()).isEqualTo(member);
                assertThat(pending.type()).isEqualTo(NotificationType.TASK_UPDATED);
                assertThat(pending.message()).isEqualTo("Your task dates were updated by schedule optimization");
            });
            assertThat(batch).extracting(NotificationService.Pending::recipient)
                    .containsOnly(member);
            assertThat(batch).extracting(NotificationService.Pending::link)
                    .containsExactlyInAnyOrder("/projects?selectedIssue=PROJ-1",
                            "/projects?selectedIssue=PROJ-2");
        }

        @Test
        @DisplayName("does not notify the caller about their own tasks")
        void shouldNotNotifyTheCaller() {
            first.setAssignee(owner);
            second.setAssignee(member);
            givenAuthor(owner);
            givenBatchLoads(first, second);

            taskService.applySchedule(List.of(
                    new TaskService.ScheduleChange("PROJ-1", MONDAY, FRIDAY),
                    new TaskService.ScheduleChange("PROJ-2", MONDAY, FRIDAY)), 1);

            assertThat(notifiedBatch()).extracting(NotificationService.Pending::recipient)
                    .containsExactly(member);
        }

        @Test
        @DisplayName("stops when a task key in the batch resolves to nothing")
        void shouldStopOnUnknownTaskKey() {
            givenAuthor(owner);
            when(taskRepository.findByProjectKeyAndTaskNumbers("PROJ", List.of(1, 9)))
                    .thenReturn(List.of(first));

            assertThatThrownBy(() -> taskService.applySchedule(List.of(
                    new TaskService.ScheduleChange("PROJ-1", MONDAY, FRIDAY),
                    new TaskService.ScheduleChange("PROJ-9", MONDAY, FRIDAY)), 1))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Task not found: PROJ-9");
        }

        @Test
        @DisplayName("stops when a key in the batch is malformed")
        void shouldStopOnMalformedKey() {
            givenAuthor(owner);

            assertThatThrownBy(() -> taskService.applySchedule(List.of(
                    new TaskService.ScheduleChange("PROJ", MONDAY, FRIDAY)), 1))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Invalid task key: PROJ");
            verifyNoInteractions(taskActivityService, notificationService);
        }

        @Test
        @DisplayName("refuses to move a task that lives in a project the caller cannot see")
        void shouldRefuseInaccessibleTask() {
            var foreignProject = TestEntityFactory.createProject(20, "OTHER", outsider);
            var foreignTask = TestEntityFactory.createTask(200, 1, foreignProject);
            givenAuthor(owner);
            when(taskRepository.findByProjectKeyAndTaskNumbers("OTHER", List.of(1)))
                    .thenReturn(List.of(foreignTask));

            assertThatThrownBy(() -> taskService.applySchedule(List.of(
                    new TaskService.ScheduleChange("OTHER-1", MONDAY, FRIDAY)), 1))
                    .isInstanceOf(AuthorizationException.class)
                    .hasMessage("No access to task: OTHER-1");
            assertThat(foreignTask.getStartDate()).isNull();
            verifyNoInteractions(taskActivityService, notificationService);
        }

        @Test
        @DisplayName("refuses a change whose due date precedes its start date")
        void shouldRefuseInvertedRange() {
            givenAuthor(owner);
            givenBatchLoads(first);

            assertThatThrownBy(() -> taskService.applySchedule(List.of(
                    new TaskService.ScheduleChange("PROJ-1", FRIDAY, MONDAY)), 1))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Invalid schedule for task: PROJ-1");
            assertThat(first.getStartDate()).isNull();
            verifyNoInteractions(taskActivityService, notificationService);
        }

        @Test
        @DisplayName("refuses a change with a missing date")
        void shouldRefuseMissingDate() {
            givenAuthor(owner);
            givenBatchLoads(first);

            assertThatThrownBy(() -> taskService.applySchedule(List.of(
                    new TaskService.ScheduleChange("PROJ-1", MONDAY, null)), 1))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Invalid schedule for task: PROJ-1");
            verifyNoInteractions(taskActivityService, notificationService);
        }

        @Test
        @DisplayName("does nothing at all for an empty batch")
        void shouldDoNothingForEmptyBatch() {
            assertThat(taskService.applySchedule(List.of(), 1)).isZero();
            assertThat(taskService.applySchedule(null, 1)).isZero();

            verifyNoInteractions(userService, taskRepository, taskActivityService, notificationService);
        }
    }

    @Nested
    @DisplayName("deleteTask")
    class DeleteTaskTests {

        private Task task;

        private void givenOwnedTask() {
            task = TestEntityFactory.createTask(100, 1, project);
            when(accessGuard.getOwnedProject("PROJ", 1)).thenReturn(project);
            when(taskRepository.findByTaskKey("PROJ-1")).thenReturn(Optional.of(task));
        }

        @Test
        @DisplayName("deletes the row first and only then takes the files off disk")
        void shouldDeleteRowBeforeFiles() {
            givenOwnedTask();
            task.replaceAttachments(List.of("/files/a.pdf", "/files/b.pdf"));

            taskService.deleteTask("PROJ", "PROJ-1", 1);

            verify(fileStorageService, times(1)).deleteFilesSilently(anyCollection());
            var order = inOrder(taskRepository, fileStorageService);
            order.verify(taskRepository).delete(task);
            order.verify(fileStorageService)
                    .deleteFilesSilently(List.of("/files/a.pdf", "/files/b.pdf"));
        }

        @Test
        @DisplayName("goes through the owner-only guard, not the member-level one")
        void shouldRequireOwnership() {
            givenOwnedTask();

            taskService.deleteTask("PROJ", "PROJ-1", 1);

            verify(accessGuard).getOwnedProject("PROJ", 1);
            verify(accessGuard, never()).getAccessibleProject(anyString(), any());
            verify(accessGuard).verifyTaskInProject(task, project);
        }

        @Test
        @DisplayName("tells the assignee that their task is gone")
        void shouldNotifyAssignee() {
            givenOwnedTask();
            task.setAssignee(member);

            taskService.deleteTask("PROJ", "PROJ-1", 1);

            verify(notificationService).createNotification(member,
                    "Task 'Task 1' has been deleted", NotificationType.TASK_DELETED, null);
        }

        @Test
        @DisplayName("stays silent when the caller deletes a task assigned to themselves")
        void shouldNotNotifyTheCaller() {
            givenOwnedTask();
            task.setAssignee(owner);

            taskService.deleteTask("PROJ", "PROJ-1", 1);

            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("reports the task as missing and deletes nothing when the key resolves to nothing")
        void shouldThrowWhenTaskMissing() {
            when(accessGuard.getOwnedProject("PROJ", 1)).thenReturn(project);
            when(taskRepository.findByTaskKey("PROJ-404")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> taskService.deleteTask("PROJ", "PROJ-404", 1))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Task not found: PROJ-404");
            verify(taskRepository, never()).delete(any(Task.class));
            verifyNoInteractions(fileStorageService);
        }
    }
}
