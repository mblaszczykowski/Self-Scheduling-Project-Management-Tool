package com.backend.services;

import com.backend.TestEntityFactory;
import com.backend.dtos.ProjectDTO;
import com.backend.dtos.TaskDTO;
import com.backend.dtos.UserDTO;
import com.backend.entities.NotificationType;
import com.backend.entities.Project;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import com.backend.util.CriticalPathMethodHelper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
    private TaskService taskService;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private CriticalPathMethodHelper cpmHelper;

    private ProjectService projectService;

    private User owner;
    private User member;
    private Project project;

    @BeforeEach
    void setUp() {
        projectService = new ProjectService(
                projectRepository, userService, taskService,
                taskRepository, notificationService, fileStorageService, cpmHelper
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
            var dto = new ProjectDTO(null, "TEST", "Test Project", "desc",
                    null, null, null, null, null);

            when(projectRepository.existsByProjectKey("TEST")).thenReturn(false);
            when(userService.getRequiredUserById(1)).thenReturn(owner);
            when(projectRepository.save(any(Project.class))).thenAnswer(inv -> {
                Project p = inv.getArgument(0);
                p.setId(10);
                return p;
            });
            when(userService.convertToDTO(any(User.class))).thenReturn(
                    new UserDTO(1, "User", "1", "owner@example.com", null));

            var result = projectService.createProject(dto, 1, null);

            assertNotNull(result);
            verify(projectRepository).save(any(Project.class));
        }

        @Test
        @DisplayName("should throw when project key already exists")
        void shouldThrowWhenProjectKeyExists() {
            var dto = new ProjectDTO(null, "TEST", "Test Project", "desc",
                    null, null, null, null, null);

            when(projectRepository.existsByProjectKey("TEST")).thenReturn(true);

            assertThrows(ValidationException.class, () ->
                    projectService.createProject(dto, 1, null));
        }

        @Test
        @DisplayName("should throw when project key is empty")
        void shouldThrowWhenProjectKeyEmpty() {
            var dto = new ProjectDTO(null, "", "Test Project", "desc",
                    null, null, null, null, null);

            assertThrows(ValidationException.class, () ->
                    projectService.createProject(dto, 1, null));
        }

        @Test
        @DisplayName("should throw when project key is lowercase")
        void shouldThrowWhenProjectKeyLowercase() {
            var dto = new ProjectDTO(null, "test", "Test Project", "desc",
                    null, null, null, null, null);

            assertThrows(ValidationException.class, () ->
                    projectService.createProject(dto, 1, null));
        }

        @Test
        @DisplayName("should throw when summary is empty")
        void shouldThrowWhenSummaryEmpty() {
            var dto = new ProjectDTO(null, "TEST", "", "desc",
                    null, null, null, null, null);

            assertThrows(ValidationException.class, () ->
                    projectService.createProject(dto, 1, null));
        }

        @Test
        @DisplayName("should notify new members excluding owner")
        void shouldNotifyNewMembersExcludingOwner() {
            var memberDTO = new UserDTO(null, null, null, "member@example.com", null);
            var dto = new ProjectDTO(null, "TEST", "Test Project", "desc",
                    null, List.of(memberDTO), null, null, null);

            when(projectRepository.existsByProjectKey("TEST")).thenReturn(false);
            when(userService.getRequiredUserById(1)).thenReturn(owner);
            when(userService.findByEmailsAsMap(Set.of("member@example.com")))
                    .thenReturn(Map.of("member@example.com", member));
            when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));
            when(userService.convertToDTO(any(User.class))).thenReturn(
                    new UserDTO(1, "User", "1", "owner@example.com", null));

            projectService.createProject(dto, 1, null);

            verify(notificationService).createNotification(
                    eq(member), contains("added to project"), eq(NotificationType.PROJECT_INVITATION), anyString());
            verify(notificationService, never()).createNotification(
                    eq(owner), anyString(), any(), anyString());
        }

        @Test
        @DisplayName("should throw when member email does not exist")
        void shouldThrowWhenMemberEmailNotFound() {
            var memberDTO = new UserDTO(null, null, null, "unknown@example.com", null);
            var dto = new ProjectDTO(null, "TEST", "Test Project", "desc",
                    null, List.of(memberDTO), null, null, null);

            when(projectRepository.existsByProjectKey("TEST")).thenReturn(false);
            when(userService.getRequiredUserById(1)).thenReturn(owner);
            when(userService.findByEmailsAsMap(Set.of("unknown@example.com")))
                    .thenReturn(Map.of());

            assertThrows(ValidationException.class, () ->
                    projectService.createProject(dto, 1, null));
        }

        @Test
        @DisplayName("should detect circular project dependencies")
        void shouldDetectCircularDependency() {
            var depProject = TestEntityFactory.createProject(20, "DEP", owner);
            depProject.replaceDependencies(List.of(project));

            var dto = new ProjectDTO(null, "TEST", "Test Project", "desc",
                    null, null, null, null, List.of("DEP"));

            when(projectRepository.existsByProjectKey("TEST")).thenReturn(false);
            when(userService.getRequiredUserById(1)).thenReturn(owner);
            when(projectRepository.save(any(Project.class))).thenAnswer(inv -> {
                Project p = inv.getArgument(0);
                p.setId(10);
                return p;
            });
            when(projectRepository.findByProjectKey("DEP")).thenReturn(Optional.of(depProject));

            // cycle: project(10) -> DEP(20) -> project(10)
            assertThrows(ValidationException.class, () ->
                    projectService.createProject(dto, 1, null));
        }
    }

    @Nested
    @DisplayName("getProjectByKey")
    class GetProjectByKeyTests {

        @Test
        @DisplayName("should return project for authorized user")
        void shouldReturnProjectForAuthorizedUser() {
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("PROJ"))
                    .thenReturn(Optional.of(project));
            when(taskRepository.findByProjectIdWithDetails(10)).thenReturn(List.of());
            when(cpmHelper.calculateTaskDTOsWithCPM(anyList())).thenReturn(List.of());
            when(userService.convertToDTO(any(User.class))).thenReturn(
                    new UserDTO(1, "User", "1", "owner@example.com", null));

            var result = projectService.getProjectByKey("PROJ", 1);

            assertNotNull(result);
            assertEquals("PROJ", result.projectKey());
        }

        @Test
        @DisplayName("should throw when project not found")
        void shouldThrowWhenProjectNotFound() {
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("NOPE"))
                    .thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class, () ->
                    projectService.getProjectByKey("NOPE", 1));
        }

        @Test
        @DisplayName("should throw when user has no access")
        void shouldThrowWhenUserHasNoAccess() {
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("PROJ"))
                    .thenReturn(Optional.of(project));

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
            var dto = new ProjectDTO(null, "PROJ", "Updated Summary", "Updated desc",
                    null, null, null, null, null);

            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));
            when(userService.convertToDTO(any(User.class))).thenReturn(
                    new UserDTO(1, "User", "1", "owner@example.com", null));

            var result = projectService.updateProject("PROJ", dto, 1, null);

            assertNotNull(result);
            verify(projectRepository).save(any(Project.class));
        }

        @Test
        @DisplayName("should throw when non-owner tries to update")
        void shouldThrowWhenNonOwnerUpdates() {
            var dto = new ProjectDTO(null, "PROJ", "Updated", "desc",
                    null, null, null, null, null);

            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));

            assertThrows(AuthorizationException.class, () ->
                    projectService.updateProject("PROJ", dto, 99, null));
        }

        @Test
        @DisplayName("should throw when project not found for update")
        void shouldThrowWhenProjectNotFoundForUpdate() {
            var dto = new ProjectDTO(null, "NOPE", "Updated", "desc",
                    null, null, null, null, null);

            when(projectRepository.findByProjectKey("NOPE")).thenReturn(Optional.empty());

            assertThrows(ResourceNotFoundException.class, () ->
                    projectService.updateProject("NOPE", dto, 1, null));
        }

        @Test
        @DisplayName("should notify newly added members on update")
        void shouldNotifyNewlyAddedMembersOnUpdate() {
            project.replaceMembers(Set.of(owner));

            var newMemberDTO = new UserDTO(null, null, null, "member@example.com", null);
            var dto = new ProjectDTO(null, "PROJ", "Updated", "desc",
                    null, List.of(newMemberDTO), null, null, null);

            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));
            when(userService.findByEmailsAsMap(Set.of("member@example.com")))
                    .thenReturn(Map.of("member@example.com", member));
            when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));
            when(userService.convertToDTO(any(User.class))).thenReturn(
                    new UserDTO(1, "User", "1", "owner@example.com", null));

            projectService.updateProject("PROJ", dto, 1, null);

            verify(notificationService).createNotification(
                    eq(member), contains("added to project"), eq(NotificationType.PROJECT_INVITATION), anyString());
        }
    }

    @Nested
    @DisplayName("deleteProject")
    class DeleteProjectTests {

        @Test
        @DisplayName("should delete project for owner")
        void shouldDeleteProjectForOwner() {
            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));

            projectService.deleteProject("PROJ", 1);

            verify(projectRepository).delete(project);
        }

        @Test
        @DisplayName("should throw when non-owner tries to delete")
        void shouldThrowWhenNonOwnerDeletes() {
            when(projectRepository.findByProjectKey("PROJ")).thenReturn(Optional.of(project));

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

            projectService.deleteProject("PROJ", 1);

            verify(fileStorageService).deleteFilesSilently(project.getAttachments());
            verify(projectRepository).delete(project);
        }
    }
}
