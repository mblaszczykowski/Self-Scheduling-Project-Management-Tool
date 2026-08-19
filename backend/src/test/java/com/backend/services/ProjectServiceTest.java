package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.dtos.TaskDTO;
import com.backend.entities.NotificationType;
import com.backend.entities.Project;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.mapper.EntityMapper;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import com.backend.requests.ProjectRequest;
import com.backend.scheduling.CriticalPathAnalyzer;
import com.backend.scheduling.SchedulingService;
import com.backend.security.AccessGuard;
import com.backend.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {
    private static final Integer OWNER_ID = 1;
    private static final Integer MEMBER_ID = 2;
    private static final Integer OUTSIDER_ID = 99;

    @Mock private ProjectRepository projectRepository;
    @Mock private UserService userService;
    @Mock private TaskRepository taskRepository;
    @Mock private FileStorageService fileStorageService;
    @Mock private SchedulingService schedulingService;
    @Mock private AccessGuard accessGuard;
    @Mock private NotificationService notificationService;
    @Mock private EmailService emailService;

    private ProjectService projectService;
    private RateLimitService rateLimitService;

    private User owner;
    private User member;
    private Project project;

    @BeforeEach
    void setUp() {
        owner = TestEntityFactory.createUser(OWNER_ID, "owner@example.com");
        member = TestEntityFactory.createUser(MEMBER_ID, "member@example.com");
        project = TestEntityFactory.createProjectWithMembers(10, "WEB", owner, member);

        rateLimitService = new RateLimitService(new AppProperties());
        projectService = new ProjectService(projectRepository, userService, taskRepository,
                fileStorageService, schedulingService, new EntityMapper(), accessGuard,
                notificationService, emailService, rateLimitService);

        lenient().when(userService.getRequiredUserById(OWNER_ID)).thenReturn(owner);
        lenient().when(fileStorageService.storeFiles(any(), any(), any())).thenReturn(List.of());
        lenient().when(fileStorageService.resolveAttachments(any(), any(), any(), any())).thenAnswer(invocation -> {
            Integer projectId = invocation.getArgument(0);
            List<String> declared = invocation.getArgument(1);
            var newFiles = invocation.getArgument(2, List.class);
            Integer uploaderId = invocation.getArgument(3);
            fileStorageService.requireAttachmentsBelongTo(projectId, declared);
            var merged = new java.util.ArrayList<>(declared);
            merged.addAll(fileStorageService.storeFiles(newFiles, projectId, uploaderId));
            return merged;
        });
        lenient().when(taskRepository.findByProjectIdWithDetails(anyInt())).thenReturn(List.of());
        lenient().when(schedulingService.analyzeCriticalPath(anyList(), any()))
                .thenReturn(CriticalPathAnalyzer.Analysis.empty());
        lenient().when(schedulingService.applyCriticality(any(), any())).thenAnswer(invocation -> {
            TaskDTO dto = invocation.getArgument(0);
            CriticalPathAnalyzer.Analysis analysis = invocation.getArgument(1);
            return dto.withCriticality(analysis.criticalKeys().contains(dto.taskKey()),
                    analysis.totalFloat().get(dto.taskKey()));
        });
        lenient().when(projectRepository.save(any(Project.class))).thenAnswer(call -> call.getArgument(0));
    }

    private static ProjectRequest request(String key, String summary, String description,
                                          List<String> memberEmails, List<String> dependencies,
                                          List<String> attachments) {
        return new ProjectRequest(key, summary, description, memberEmails, dependencies, attachments);
    }

    @Nested
    @DisplayName("Creating a project")
    class CreateProject {
        @Test
        @DisplayName("stores the submitted details and makes the caller its owner")
        void createsProject() {
            var result = projectService.createProject(
                    request("NEW", "New project", "Description", null, null, null),
                    OWNER_ID, List.of());

            var saved = ArgumentCaptor.forClass(Project.class);
            verify(projectRepository).save(saved.capture());
            assertThat(saved.getValue().getProjectKey()).isEqualTo("NEW");
            assertThat(saved.getValue().getSummary()).isEqualTo("New project");
            assertThat(saved.getValue().getOwner()).isSameAs(owner);
            assertThat(saved.getValue().getNextTaskNumber()).isEqualTo(1);

            assertThat(result.projectKey()).isEqualTo("NEW");
            assertThat(result.owner().email()).isEqualTo("owner@example.com");
            assertThat(result.members()).extracting("email").contains("owner@example.com");
        }

        @Test
        @DisplayName("rejects a project key that is already taken")
        void rejectsDuplicateKey() {
            when(projectRepository.existsByProjectKey("WEB")).thenReturn(true);

            assertThatThrownBy(() -> projectService.createProject(
                    request("WEB", "Duplicate", null, null, null, null), OWNER_ID, List.of()))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("already exists");

            verify(projectRepository, never()).save(any());
        }

        @Test
        @DisplayName("adds members resolved by email and notifies each of them once")
        void addsAndNotifiesMembers() {
            when(userService.findByEmailsAsMap(anyCollection()))
                    .thenReturn(Map.of("member@example.com", member));

            projectService.createProject(
                    request("NEW", "New project", null, List.of("member@example.com"), null, null),
                    OWNER_ID, List.of());

            var pending = capturePendingNotifications();
            assertThat(pending).hasSize(1);
            assertThat(pending.get(0).recipient()).isSameAs(member);
            assertThat(pending.get(0).type()).isEqualTo(NotificationType.PROJECT_INVITATION);
        }

        @Test
        @DisplayName("never notifies the owner about their own project")
        void doesNotNotifyOwner() {
            projectService.createProject(
                    request("NEW", "New project", null, List.of("owner@example.com"), null, null),
                    OWNER_ID, List.of());

            assertThat(capturePendingNotifications()).isEmpty();
        }

        @Test
        @DisplayName("invites an address that has no account yet, after the transaction would commit")
        void invitesUnregisteredAddresses() {
            when(userService.findByEmailsAsMap(anyCollection())).thenReturn(Map.of());

            projectService.createProject(
                    request("NEW", "New project", null, List.of("stranger@example.com"), null, null),
                    OWNER_ID, List.of());

            verify(emailService).sendInvitationEmail("stranger@example.com", "New project",
                    owner.getFullName());
        }

        @Test
        @DisplayName("caps how many invitations one user can trigger")
        void capsInvitations() {
            when(userService.findByEmailsAsMap(anyCollection())).thenReturn(Map.of());
            int limit = new AppProperties().getRateLimit().getInvitation();

            for (int i = 0; i < limit; i++) {
                projectService.createProject(
                        request("P" + i, "Project " + i, null, List.of("stranger@example.com"),
                                null, null),
                        OWNER_ID, List.of());
            }

            assertThatThrownBy(() -> projectService.createProject(
                    request("OVER", "One too many", null, List.of("stranger@example.com"), null, null),
                    OWNER_ID, List.of()))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("Too many invitations");
        }

        @Test
        @DisplayName("resolves a dependency through the access guard rather than by raw key")
        void resolvesDependenciesThroughTheGuard() {
            var dependency = TestEntityFactory.createProject(20, "API", owner);
            when(projectRepository.findByProjectKeyIn(List.of("API"))).thenReturn(List.of(dependency));

            projectService.createProject(
                    request("NEW", "New project", null, null, List.of("API"), null),
                    OWNER_ID, List.of());

            verify(accessGuard).requireAccess(dependency, OWNER_ID);
        }

        @Test
        @DisplayName("propagates the guard's refusal for a dependency the caller cannot see")
        void rejectsInaccessibleDependency() {
            var secret = TestEntityFactory.createProject(30, "SECRET", owner);
            when(projectRepository.findByProjectKeyIn(List.of("SECRET"))).thenReturn(List.of(secret));
            doThrow(new ResourceNotFoundException("Project not found"))
                    .when(accessGuard).requireAccess(secret, OWNER_ID);

            assertThatThrownBy(() -> projectService.createProject(
                    request("NEW", "New project", null, null, List.of("SECRET"), null),
                    OWNER_ID, List.of()))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("refuses a dependency key that does not resolve to any project")
        void rejectsUnknownDependencyKey() {
            when(projectRepository.findByProjectKeyIn(List.of("GHOST"))).thenReturn(List.of());

            assertThatThrownBy(() -> projectService.createProject(
                    request("NEW", "New project", null, null, List.of("GHOST"), null),
                    OWNER_ID, List.of()))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("resolves every dependency key in one query rather than one query per key")
        void batchesDependencyLookups() {
            var api = TestEntityFactory.createProject(20, "API", owner);
            var web = TestEntityFactory.createProject(21, "WEB2", owner);
            when(projectRepository.findByProjectKeyIn(List.of("API", "WEB2")))
                    .thenReturn(List.of(api, web));

            projectService.createProject(
                    request("NEW", "New project", null, null, List.of("API", "WEB2"), null),
                    OWNER_ID, List.of());

            verify(projectRepository, times(1)).findByProjectKeyIn(anyList());
        }

        @Test
        @DisplayName("records uploaded attachments against the project that owns them")
        void storesAttachmentsAgainstTheProject() {
            when(projectRepository.save(any(Project.class))).thenAnswer(call -> {
                Project saved = call.getArgument(0);
                saved.setId(10);
                return saved;
            });
            when(fileStorageService.storeFiles(any(), eq(10), eq(OWNER_ID)))
                    .thenReturn(List.of("/files/spec.pdf"));
            var uploads = List.<org.springframework.web.multipart.MultipartFile>of();

            var result = projectService.createProject(
                    request("NEW", "New project", null, null, null, null), OWNER_ID, uploads);

            verify(fileStorageService).storeFiles(eq(uploads), eq(10), eq(OWNER_ID));
            assertThat(result.attachments()).containsExactly("/files/spec.pdf");
        }
    }

    @Nested
    @DisplayName("Updating a project")
    class UpdateProject {
        @BeforeEach
        void projectIsOwnedByCaller() {
            lenient().when(accessGuard.getOwnedProject("WEB", OWNER_ID)).thenReturn(project);
        }

        @Test
        @DisplayName("requires ownership")
        void requiresOwnership() {
            when(accessGuard.getOwnedProject("WEB", MEMBER_ID))
                    .thenThrow(new AuthorizationException("Only project owner can perform this action"));

            assertThatThrownBy(() -> projectService.updateProject("WEB",
                    request("WEB", "Renamed", null, null, null, null), MEMBER_ID, List.of()))
                    .isInstanceOf(AuthorizationException.class);
        }

        @Test
        @DisplayName("replaces the attachment list, so removing one actually removes it")
        void replacesAttachments() {
            project.replaceAttachments(List.of("/files/old.pdf", "/files/keep.pdf"));

            var result = projectService.updateProject("WEB",
                    request("WEB", "Project WEB", null, null, null, List.of("/files/keep.pdf")),
                    OWNER_ID, List.of());

            assertThat(result.attachments()).containsExactly("/files/keep.pdf");
            assertThat(project.getAttachments()).containsExactly("/files/keep.pdf");
        }

        @Test
        @DisplayName("delegates removal of detached files to FileStorageService")
        void deletesDetachedAttachments() {
            project.replaceAttachments(List.of("/files/old.pdf", "/files/keep.pdf"));

            projectService.updateProject("WEB",
                    request("WEB", "Project WEB", null, null, null, List.of("/files/keep.pdf")),
                    OWNER_ID, List.of());

            verify(fileStorageService).deleteRemovedAfterCommit(
                    List.of("/files/old.pdf", "/files/keep.pdf"),
                    List.of("/files/keep.pdf"),
                    "delete detached project attachments");
        }

        @Test
        @DisplayName("leaves attachments alone when the request omits the collection entirely")
        void omittedAttachmentsAreLeftUntouched() {
            project.replaceAttachments(List.of("/files/a.pdf", "/files/b.pdf"));

            var result = projectService.updateProject("WEB",
                    request("WEB", "Renamed", null, null, null, null),
                    OWNER_ID, List.of());

            assertThat(result.attachments()).containsExactly("/files/a.pdf", "/files/b.pdf");
            assertThat(project.getAttachments()).containsExactly("/files/a.pdf", "/files/b.pdf");
        }

        @Test
        @DisplayName("deletes nothing when the request omits the attachment collection")
        void omittedAttachmentsDeleteNoFiles() {
            project.replaceAttachments(List.of("/files/a.pdf", "/files/b.pdf"));

            projectService.updateProject("WEB",
                    request("WEB", "Renamed", null, null, null, null),
                    OWNER_ID, List.of());

            verify(fileStorageService).deleteRemovedAfterCommit(
                    List.of("/files/a.pdf", "/files/b.pdf"),
                    List.of("/files/a.pdf", "/files/b.pdf"),
                    "delete detached project attachments");
        }

        @Test
        @DisplayName("clears attachments when the request declares an empty collection")
        void emptyAttachmentCollectionClears() {
            project.replaceAttachments(List.of("/files/a.pdf"));

            var result = projectService.updateProject("WEB",
                    request("WEB", "Project WEB", null, null, null, List.of()),
                    OWNER_ID, List.of());

            assertThat(result.attachments()).isEmpty();
        }

        @Test
        @DisplayName("validates that a submitted attachment belongs to this project")
        void validatesAttachmentOwnership() {
            projectService.updateProject("WEB",
                    request("WEB", "Project WEB", null, null, null, List.of("/files/a.pdf")),
                    OWNER_ID, List.of());

            verify(fileStorageService).requireAttachmentsBelongTo(eq(10), eq(List.of("/files/a.pdf")));
        }

        @Test
        @DisplayName("notifies members that the project changed only when it actually changed")
        void notifiesOnlyOnRealChanges() {
            projectService.updateProject("WEB",
                    request("WEB", project.getSummary(), project.getDescription(), null, null, null),
                    OWNER_ID, List.of());

            assertThat(capturePendingNotifications()).isEmpty();
        }

        @Test
        @DisplayName("notifies every other member when the details change")
        void notifiesMembersOfRealChange() {
            projectService.updateProject("WEB",
                    request("WEB", "A different summary", null, null, null, null),
                    OWNER_ID, List.of());

            var pending = capturePendingNotifications();
            assertThat(pending).hasSize(1);
            assertThat(pending.get(0).recipient()).isSameAs(member);
            assertThat(pending.get(0).type()).isEqualTo(NotificationType.PROJECT_UPDATED);
        }

        @Test
        @DisplayName("sends a newly added member the invitation and not also the update")
        void newMemberGetsOneNotification() {
            var newcomer = TestEntityFactory.createUser(3, "newcomer@example.com");
            when(userService.findByEmailsAsMap(anyCollection()))
                    .thenReturn(Map.of("member@example.com", member, "newcomer@example.com", newcomer));

            projectService.updateProject("WEB",
                    request("WEB", "A different summary", null,
                            List.of("member@example.com", "newcomer@example.com"), null, null),
                    OWNER_ID, List.of());

            var pending = capturePendingNotifications();
            var forNewcomer = pending.stream()
                    .filter(candidate -> candidate.recipient() == newcomer)
                    .toList();
            assertThat(forNewcomer).hasSize(1);
            assertThat(forNewcomer.get(0).type()).isEqualTo(NotificationType.PROJECT_INVITATION);
        }

        @Test
        @DisplayName("tells a member who was dropped that they were removed")
        void notifiesRemovedMember() {
            projectService.updateProject("WEB",
                    request("WEB", "Project WEB", null, List.of(), null, null),
                    OWNER_ID, List.of());

            var pending = capturePendingNotifications();
            assertThat(pending).extracting("recipient", "type")
                    .containsExactly(org.assertj.core.groups.Tuple.tuple(member,
                            NotificationType.MEMBER_REMOVED));
            assertThat(project.getMembers()).containsExactly(owner);
        }

        @Test
        @DisplayName("leaves the member list alone when the request omits it")
        void omittedMembersAreUntouched() {
            projectService.updateProject("WEB",
                    request("WEB", "Project WEB", null, null, null, null), OWNER_ID, List.of());

            assertThat(project.getMembers()).containsExactlyInAnyOrder(owner, member);
        }

        @Test
        @DisplayName("clears dependencies when an empty list is submitted")
        void clearsDependencies() {
            var dependency = TestEntityFactory.createProject(20, "API", owner);
            project.replaceDependencies(List.of(dependency));

            projectService.updateProject("WEB",
                    request("WEB", "Project WEB", null, null, List.of(), null), OWNER_ID, List.of());

            assertThat(project.getDependencies()).isEmpty();
        }

        @Test
        @DisplayName("refuses a dependency cycle")
        void refusesDependencyCycle() {
            var other = TestEntityFactory.createProject(20, "API", owner);
            other.replaceDependencies(List.of(project));
            when(projectRepository.findByProjectKeyIn(List.of("API"))).thenReturn(List.of(other));

            assertThatThrownBy(() -> projectService.updateProject("WEB",
                    request("WEB", "Project WEB", null, null, List.of("API"), null),
                    OWNER_ID, List.of()))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("Circular");
        }
    }

    @Nested
    @DisplayName("Reading and deleting")
    class ReadAndDelete {
        @Test
        @DisplayName("returns a project the caller can see, with its critical path marked")
        void returnsAccessibleProject() {
            var task = TestEntityFactory.createTask(100, 1, project);
            task.setStartDate(java.time.LocalDate.of(2026, 1, 5));
            task.setDueDate(java.time.LocalDate.of(2026, 1, 9));
            when(accessGuard.getAccessibleProject("WEB", MEMBER_ID)).thenReturn(project);
            when(taskRepository.findByProjectIdWithDetails(10)).thenReturn(List.of(task));
            when(schedulingService.analyzeCriticalPath(anyList(), any()))
                    .thenReturn(new CriticalPathAnalyzer.Analysis(
                            java.util.Map.of("WEB-1", 0), java.util.Set.of("WEB-1")));

            var result = projectService.getProjectByKey("WEB", MEMBER_ID);

            assertThat(result.tasks()).hasSize(1);
            assertThat(result.tasks().get(0).taskKey()).isEqualTo("WEB-1");
            assertThat(result.tasks().get(0).isCritical()).isTrue();
        }

        @Test
        @DisplayName("hides a project the caller cannot see behind a not-found")
        void hidesInaccessibleProject() {
            when(accessGuard.getAccessibleProject("WEB", OUTSIDER_ID))
                    .thenThrow(new ResourceNotFoundException("Project not found"));

            assertThatThrownBy(() -> projectService.getProjectByKey("WEB", OUTSIDER_ID))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Project not found");
        }

        @Test
        @DisplayName("deletes the rows first and the files only afterwards")
        void deletesRowsBeforeFiles() {
            project.replaceAttachments(List.of("/files/spec.pdf"));
            when(accessGuard.getOwnedProject("WEB", OWNER_ID)).thenReturn(project);

            projectService.deleteProject("WEB", OWNER_ID);

            var order = org.mockito.Mockito.inOrder(projectRepository, fileStorageService);
            order.verify(projectRepository).delete(project);
            order.verify(fileStorageService).deleteFilesSilently(anyCollection());
        }

        @Test
        @DisplayName("requires ownership to delete")
        void requiresOwnershipToDelete() {
            when(accessGuard.getOwnedProject("WEB", MEMBER_ID))
                    .thenThrow(new AuthorizationException("Only project owner can perform this action"));

            assertThatThrownBy(() -> projectService.deleteProject("WEB", MEMBER_ID))
                    .isInstanceOf(AuthorizationException.class);
            verify(projectRepository, never()).delete(any());
        }
    }

    @SuppressWarnings("unchecked")
    private List<NotificationService.Pending> capturePendingNotifications() {
        var captor = ArgumentCaptor.forClass(java.util.Collection.class);
        verify(notificationService, org.mockito.Mockito.atLeastOnce()).notifyAll(captor.capture());
        return captor.getAllValues().stream()
                .flatMap(collection -> ((java.util.Collection<NotificationService.Pending>) collection).stream())
                .toList();
    }
}
