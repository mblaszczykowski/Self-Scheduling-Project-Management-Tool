package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.dtos.ProjectDTO;
import com.backend.dtos.TaskDTO;
import com.backend.dtos.UserDTO;
import com.backend.entities.NotificationType;
import com.backend.entities.Project;
import com.backend.entities.User;
import com.backend.events.NotificationEvent;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import com.backend.requests.ProjectCreateRequest;
import com.backend.util.AccessGuard;
import com.backend.util.CriticalPathMethodHelper;
import com.backend.util.EntityMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private UserService userService;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private CriticalPathMethodHelper cpmHelper;

    @Mock
    private EntityMapper entityMapper;

    @Mock
    private AccessGuard accessGuard;

    @Mock
    private ApplicationEventPublisher applicationEventPublisher;

    private ProjectService projectService;

    private User owner;
    private User member;
    private Project project;

    @BeforeEach
    void setUp() {
        projectService = new ProjectService(
                projectRepository, userService, taskRepository,
                fileStorageService, cpmHelper, entityMapper,
                accessGuard, applicationEventPublisher
        );

        owner = TestEntityFactory.createUser(1, "owner@example.com");
        member = TestEntityFactory.createUser(2, "member@example.com");
        project = TestEntityFactory.createProject(10, "PROJ", owner);
        project.replaceMembers(Set.of(owner));
    }

    @Nested
    @DisplayName("createProject")
    class CreateProjectTests {

        @Test
        @DisplayName("should create project with valid data")
        void shouldCreateProjectWithValidData() {
            var request = new ProjectCreateRequest("TEST", "Test Project", "desc",
                    null, null, null);

            when(projectRepository.existsByProjectKey("TEST")).thenReturn(false);
            when(userService.getRequiredUserById(1)).thenReturn(owner);
            when(projectRepository.save(any(Project.class))).thenAnswer(inv -> {
                Project p = inv.getArgument(0);
                p.setId(10);
                return p;
            });
            when(entityMapper.toUserDTO(any(User.class))).thenReturn(
                    new UserDTO(1, "User", "1", "owner@example.com", null, null, null, null, null));

            var result = projectService.createProject(request, 1, null);

            assertNotNull(result);
            verify(projectRepository).save(any(Project.class));
        }

        @Test
        @DisplayName("should throw when project key already exists")
        void shouldThrowWhenProjectKeyExists() {
            var request = new ProjectCreateRequest("TEST", "Test Project", "desc",
                    null, null, null);

            when(projectRepository.existsByProjectKey("TEST")).thenReturn(true);

            assertThrows(ValidationException.class, () ->
                    projectService.createProject(request, 1, null));
        }

        @Test
        @DisplayName("should notify new members excluding owner")
        void shouldNotifyNewMembersExcludingOwner() {
            var memberDTO = new UserDTO(null, null, null, "member@example.com", null, null, null, null, null);
            var request = new ProjectCreateRequest("TEST", "Test Project", "desc",
                    List.of(memberDTO), null, null);

            when(projectRepository.existsByProjectKey("TEST")).thenReturn(false);
            when(userService.getRequiredUserById(1)).thenReturn(owner);
            when(userService.findByEmailsAsMap(Set.of("member@example.com")))
                    .thenReturn(Map.of("member@example.com", member));
            when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));
            when(entityMapper.toUserDTO(any(User.class))).thenReturn(
                    new UserDTO(1, "User", "1", "owner@example.com", null, null, null, null, null));

            projectService.createProject(request, 1, null);

            var captor = ArgumentCaptor.forClass(NotificationEvent.class);
            verify(applicationEventPublisher, atLeastOnce()).publishEvent(captor.capture());

            var events = captor.getAllValues();
            assertTrue(events.stream().anyMatch(e ->
                    e.recipient().equals(member) &&
                    e.message().contains("added to project") &&
                    e.type() == NotificationType.PROJECT_INVITATION));
            assertTrue(events.stream().noneMatch(e -> e.recipient().equals(owner)));
        }

        @Test
        @DisplayName("should send invitation email event when member email does not exist")
        void shouldSendInvitationEmailWhenMemberEmailNotFound() {
            var memberDTO = new UserDTO(null, null, null, "unknown@example.com", null, null, null, null, null);
            var request = new ProjectCreateRequest("TEST", "Test Project", "desc",
                    List.of(memberDTO), null, null);

            when(projectRepository.existsByProjectKey("TEST")).thenReturn(false);
            when(userService.getRequiredUserById(1)).thenReturn(owner);
            when(userService.findByEmailsAsMap(Set.of("unknown@example.com")))
                    .thenReturn(Map.of());
            when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));
            when(entityMapper.toUserDTO(any(User.class))).thenReturn(
                    new UserDTO(1, "User", "1", "owner@example.com", null, null, null, null, null));

            projectService.createProject(request, 1, null);

            verify(applicationEventPublisher).publishEvent(
                    ArgumentMatchers.<Object>argThat(event ->
                            event instanceof com.backend.events.InvitationEmailEvent));
        }

        @Test
        @DisplayName("should detect circular project dependencies on update")
        void shouldDetectCircularDependency() {
            // A brand-new project cannot be part of a cycle (nothing references it yet),
            // so cycle detection is exercised on update: adding DEP as a dependency of PROJ
            // when DEP already depends on PROJ would create PROJ(10) -> DEP(20) -> PROJ(10).
            var depProject = TestEntityFactory.createProject(20, "DEP", owner);
            depProject.replaceDependencies(List.of(project));

            var request = new ProjectCreateRequest("PROJ", "Updated", "desc",
                    null, List.of("DEP"), null);

            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            doNothing().when(accessGuard).requireOwner(project, 1);
            when(projectRepository.findByProjectKey("DEP")).thenReturn(Optional.of(depProject));

            assertThrows(ValidationException.class, () ->
                    projectService.updateProject("PROJ", request, 1, null));
        }
    }

    @Nested
    @DisplayName("getProjectByKey")
    class GetProjectByKeyTests {

        @Test
        @DisplayName("should return project for authorized user")
        void shouldReturnProjectForAuthorizedUser() {
            when(accessGuard.getAccessibleProject("PROJ", 1)).thenReturn(project);
            when(taskRepository.findByProjectIdWithDetails(10)).thenReturn(List.of());
            when(cpmHelper.calculateTaskDTOsWithCPM(anyList())).thenReturn(List.of());
            when(entityMapper.toUserDTO(any(User.class))).thenReturn(
                    new UserDTO(1, "User", "1", "owner@example.com", null, null, null, null, null));

            var result = projectService.getProjectByKey("PROJ", 1);

            assertNotNull(result);
            assertEquals("PROJ", result.projectKey());
        }

        @Test
        @DisplayName("should throw when project not found")
        void shouldThrowWhenProjectNotFound() {
            when(accessGuard.getAccessibleProject("NOPE", 1))
                    .thenThrow(new ResourceNotFoundException("Project not found"));

            assertThrows(ResourceNotFoundException.class, () ->
                    projectService.getProjectByKey("NOPE", 1));
        }

        @Test
        @DisplayName("should throw when user has no access")
        void shouldThrowWhenUserHasNoAccess() {
            when(accessGuard.getAccessibleProject("PROJ", 99))
                    .thenThrow(new ResourceNotFoundException("Project not found"));

            // userId 99 is neither owner nor member
            assertThrows(ResourceNotFoundException.class, () ->
                    projectService.getProjectByKey("PROJ", 99));
        }
    }

    @Nested
    @DisplayName("updateProject")
    class UpdateProjectTests {

        @Test
        @DisplayName("should update project for owner")
        void shouldUpdateProjectForOwner() {
            var request = new ProjectCreateRequest("PROJ", "Updated Summary", "Updated desc",
                    null, null, null);

            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            doNothing().when(accessGuard).requireOwner(project, 1);
            when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));
            when(entityMapper.toUserDTO(any(User.class))).thenReturn(
                    new UserDTO(1, "User", "1", "owner@example.com", null, null, null, null, null));

            var result = projectService.updateProject("PROJ", request, 1, null);

            assertNotNull(result);
            verify(projectRepository).save(any(Project.class));
        }

        @Test
        @DisplayName("should throw when non-owner tries to update")
        void shouldThrowWhenNonOwnerUpdates() {
            var request = new ProjectCreateRequest("PROJ", "Updated", "desc",
                    null, null, null);

            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            doThrow(new AuthorizationException("Only project owner can perform this action"))
                    .when(accessGuard).requireOwner(project, 99);

            assertThrows(AuthorizationException.class, () ->
                    projectService.updateProject("PROJ", request, 99, null));
        }

        @Test
        @DisplayName("should throw when project not found for update")
        void shouldThrowWhenProjectNotFoundForUpdate() {
            var request = new ProjectCreateRequest("NOPE", "Updated", "desc",
                    null, null, null);

            when(projectRepository.findByProjectKey("NOPE")).thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class, () ->
                    projectService.updateProject("NOPE", request, 1, null));
        }

        @Test
        @DisplayName("should notify newly added members on update")
        void shouldNotifyNewlyAddedMembersOnUpdate() {
            project.replaceMembers(Set.of(owner));

            var newMemberDTO = new UserDTO(null, null, null, "member@example.com", null, null, null, null, null);
            var request = new ProjectCreateRequest("PROJ", "Updated", "desc",
                    List.of(newMemberDTO), null, null);

            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            doNothing().when(accessGuard).requireOwner(project, 1);
            when(userService.findByEmailsAsMap(Set.of("member@example.com")))
                    .thenReturn(Map.of("member@example.com", member));
            when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));
            when(entityMapper.toUserDTO(any(User.class))).thenReturn(
                    new UserDTO(1, "User", "1", "owner@example.com", null, null, null, null, null));

            projectService.updateProject("PROJ", request, 1, null);

            var captor = ArgumentCaptor.forClass(Object.class);
            verify(applicationEventPublisher, atLeastOnce()).publishEvent(captor.capture());

            var events = captor.getAllValues();
            assertTrue(events.stream()
                    .filter(e -> e instanceof NotificationEvent)
                    .map(e -> (NotificationEvent) e)
                    .anyMatch(e ->
                            e.recipient().equals(member) &&
                            e.message().contains("added to project") &&
                            e.type() == NotificationType.PROJECT_INVITATION));
        }
    }

    @Nested
    @DisplayName("deleteProject")
    class DeleteProjectTests {

        @Test
        @DisplayName("should delete project for owner")
        void shouldDeleteProjectForOwner() {
            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            doNothing().when(accessGuard).requireOwner(project, 1);

            projectService.deleteProject("PROJ", 1);

            verify(projectRepository).delete(project);
        }

        @Test
        @DisplayName("should throw when non-owner tries to delete")
        void shouldThrowWhenNonOwnerDeletes() {
            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            doThrow(new AuthorizationException("Only project owner can perform this action"))
                    .when(accessGuard).requireOwner(project, 99);

            assertThrows(AuthorizationException.class, () ->
                    projectService.deleteProject("PROJ", 99));
            verify(projectRepository, never()).delete(any());
        }

        @Test
        @DisplayName("should throw when project not found for delete")
        void shouldThrowWhenProjectNotFoundForDelete() {
            when(projectRepository.findByProjectKey("NOPE")).thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class, () ->
                    projectService.deleteProject("NOPE", 1));
        }

        @Test
        @DisplayName("should delete attachments before deleting project")
        void shouldDeleteAttachmentsBeforeDeleting() {
            project.replaceAttachments(List.of("file1.png", "file2.png"));
            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            doNothing().when(accessGuard).requireOwner(project, 1);

            projectService.deleteProject("PROJ", 1);

            verify(fileStorageService).deleteFilesSilently(project.getAttachments());
            verify(projectRepository).delete(project);
        }
    }
}
