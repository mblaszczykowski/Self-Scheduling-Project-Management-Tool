package com.backend.security;

import com.backend.TestEntityFactory;
import com.backend.entities.Comment;
import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.entities.User;
import com.backend.exception.AuthorizationException;
import com.backend.exception.ResourceNotFoundException;
import com.backend.exception.ValidationException;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AccessGuard")
class AccessGuardTest {
    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private TaskRepository taskRepository;

    private AccessGuard accessGuard;

    private User owner;
    private User member;
    private User stranger;
    private Project project;

    @BeforeEach
    void setUp() {
        accessGuard = new AccessGuard(projectRepository, taskRepository);
        owner = TestEntityFactory.createUser(1, "owner@example.com");
        member = TestEntityFactory.createUser(2, "member@example.com");
        stranger = TestEntityFactory.createUser(3, "stranger@example.com");
        project = TestEntityFactory.createProjectWithMembers(10, "PROJ", owner, member);
    }

    @Nested
    @DisplayName("getAccessibleProject")
    class GetAccessibleProject {
        @Test
        @DisplayName("returns the project to its owner")
        void returnsTheProjectToItsOwner() {
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("PROJ"))
                    .thenReturn(Optional.of(project));

            var result = accessGuard.getAccessibleProject("PROJ", owner.getId());

            assertThat(result).isSameAs(project);
            assertThat(result.getProjectKey()).isEqualTo("PROJ");
        }

        @Test
        @DisplayName("returns the project to a member who does not own it")
        void returnsTheProjectToAMemberWhoDoesNotOwnIt() {
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("PROJ"))
                    .thenReturn(Optional.of(project));

            var result = accessGuard.getAccessibleProject("PROJ", member.getId());

            assertThat(result).isSameAs(project);
            assertThat(result.isOwner(member.getId())).isFalse();
        }

        @Test
        @DisplayName("hides the project from a stranger behind a not-found, so the endpoint is not an existence oracle")
        void hidesTheProjectFromAStrangerBehindANotFound() {
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("PROJ"))
                    .thenReturn(Optional.of(project));

            assertThatThrownBy(() -> accessGuard.getAccessibleProject("PROJ", stranger.getId()))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Project not found")
                    .isNotInstanceOf(AuthorizationException.class);
        }

        @Test
        @DisplayName("reports a nonexistent project key with exactly the same not-found as an inaccessible one")
        void reportsANonexistentProjectKeyWithTheSameNotFound() {
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("GHOST"))
                    .thenReturn(Optional.empty());
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("PROJ"))
                    .thenReturn(Optional.of(project));

            var missing = catchThrowable(() -> accessGuard.getAccessibleProject("GHOST", stranger.getId()));
            var forbidden = catchThrowable(() -> accessGuard.getAccessibleProject("PROJ", stranger.getId()));

            assertThat(missing).isInstanceOf(ResourceNotFoundException.class);
            assertThat(forbidden).isInstanceOf(ResourceNotFoundException.class);
            assertThat(missing).hasMessage(forbidden.getMessage());
        }
    }

    @Nested
    @DisplayName("requireAccess")
    class RequireAccess {
        @Test
        @DisplayName("passes for the owner and for a member, and rejects everybody else")
        void passesForTheOwnerAndForAMember() {
            assertThatCode(() -> accessGuard.requireAccess(project, owner.getId()))
                    .doesNotThrowAnyException();
            assertThatCode(() -> accessGuard.requireAccess(project, member.getId()))
                    .doesNotThrowAnyException();
            assertThatThrownBy(() -> accessGuard.requireAccess(project, stranger.getId()))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Project not found");
        }
    }

    @Nested
    @DisplayName("requireOwner")
    class RequireOwner {
        @Test
        @DisplayName("passes for the owner")
        void passesForTheOwner() {
            assertThatCode(() -> accessGuard.requireOwner(project, owner.getId()))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("rejects a member who is not the owner with a forbidden, not a not-found")
        void rejectsAMemberWhoIsNotTheOwner() {
            assertThat(project.hasAccess(member.getId())).isTrue();

            assertThatThrownBy(() -> accessGuard.requireOwner(project, member.getId()))
                    .isInstanceOf(AuthorizationException.class)
                    .hasMessage("Only project owner can perform this action");
        }
    }

    @Nested
    @DisplayName("getOwnedProject")
    class GetOwnedProject {
        @Test
        @DisplayName("returns the project to its owner")
        void returnsTheProjectToItsOwner() {
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("PROJ"))
                    .thenReturn(Optional.of(project));

            assertThat(accessGuard.getOwnedProject("PROJ", owner.getId())).isSameAs(project);
        }

        @Test
        @DisplayName("rejects a member who is not the owner")
        void rejectsAMemberWhoIsNotTheOwner() {
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("PROJ"))
                    .thenReturn(Optional.of(project));

            assertThatThrownBy(() -> accessGuard.getOwnedProject("PROJ", member.getId()))
                    .isInstanceOf(AuthorizationException.class)
                    .hasMessage("Only project owner can perform this action");
        }

        @Test
        @DisplayName("reports a nonexistent project key as not found")
        void reportsANonexistentProjectKeyAsNotFound() {
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("GHOST"))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> accessGuard.getOwnedProject("GHOST", owner.getId()))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Project not found");
        }

        @Test
        @DisplayName("hides the project from a stranger with zero access behind exactly the same not-found as a nonexistent key")
        void hidesTheProjectFromAStrangerWithZeroAccess() {
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("PROJ"))
                    .thenReturn(Optional.of(project));
            when(projectRepository.findByProjectKeyWithOwnerAndMembers("GHOST"))
                    .thenReturn(Optional.empty());

            var strangerResult = catchThrowable(() -> accessGuard.getOwnedProject("PROJ", stranger.getId()));
            var missingResult = catchThrowable(() -> accessGuard.getOwnedProject("GHOST", stranger.getId()));

            assertThat(strangerResult)
                    .isInstanceOf(ResourceNotFoundException.class)
                    .isNotInstanceOf(AuthorizationException.class);
            assertThat(strangerResult).hasMessage(missingResult.getMessage());
        }
    }

    @Nested
    @DisplayName("requireProjectAccessById")
    class RequireProjectAccessById {
        @Test
        @DisplayName("passes for a member of the project the id points at")
        void passesForAMemberOfTheProject() {
            when(projectRepository.findById(10)).thenReturn(Optional.of(project));

            assertThatCode(() -> accessGuard.requireProjectAccessById(10, member.getId()))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("rejects a stranger with a not-found")
        void rejectsAStrangerWithANotFound() {
            when(projectRepository.findById(10)).thenReturn(Optional.of(project));

            assertThatThrownBy(() -> accessGuard.requireProjectAccessById(10, stranger.getId()))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Project not found");
        }

        @Test
        @DisplayName("rejects an unknown project id with a not-found")
        void rejectsAnUnknownProjectId() {
            when(projectRepository.findById(999)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> accessGuard.requireProjectAccessById(999, owner.getId()))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Project not found");
        }
    }

    @Nested
    @DisplayName("verifyTaskInProject")
    class VerifyTaskInProject {
        @Test
        @DisplayName("passes for a task that belongs to the project")
        void passesForATaskThatBelongsToTheProject() {
            var task = TestEntityFactory.createTask(100, 1, project);

            assertThatCode(() -> accessGuard.verifyTaskInProject(task, project))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("rejects a task key borrowed from another project")
        void rejectsATaskKeyBorrowedFromAnotherProject() {
            var otherProject = TestEntityFactory.createProject(20, "OTHER", owner);
            var foreignTask = TestEntityFactory.createTask(200, 1, otherProject);

            assertThatThrownBy(() -> accessGuard.verifyTaskInProject(foreignTask, project))
                    .isInstanceOf(ValidationException.class)
                    .hasMessage("Task does not belong to the specified project");
        }
    }

    @Nested
    @DisplayName("getAccessibleTaskById")
    class GetAccessibleTaskById {
        @Test
        @DisplayName("returns a task whose project the caller can see")
        void returnsATaskWhoseProjectTheCallerCanSee() {
            Task task = TestEntityFactory.createTask(100, 1, project);
            when(taskRepository.findById(100)).thenReturn(Optional.of(task));

            var result = accessGuard.getAccessibleTaskById(100, member.getId());

            assertThat(result).isSameAs(task);
            assertThat(result.getTaskKey()).isEqualTo("PROJ-1");
        }

        @Test
        @DisplayName("hides a task in a project the caller cannot see behind exactly the same not-found as a missing id")
        void hidesATaskInAnInaccessibleProject() {
            Task task = TestEntityFactory.createTask(100, 1, project);
            when(taskRepository.findById(100)).thenReturn(Optional.of(task));

            assertThatThrownBy(() -> accessGuard.getAccessibleTaskById(100, stranger.getId()))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Task not found");
        }

        @Test
        @DisplayName("reports an unknown task id as a missing task")
        void reportsAnUnknownTaskId() {
            when(taskRepository.findById(404)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> accessGuard.getAccessibleTaskById(404, owner.getId()))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessage("Task not found");
        }

        @Test
        @DisplayName("reports an inaccessible task with exactly the same message as a missing one")
        void reportsAnInaccessibleTaskWithTheSameMessageAsAMissingOne() {
            Task task = TestEntityFactory.createTask(100, 1, project);
            when(taskRepository.findById(100)).thenReturn(Optional.of(task));
            when(taskRepository.findById(404)).thenReturn(Optional.empty());

            var inaccessible = catchThrowable(() -> accessGuard.getAccessibleTaskById(100, stranger.getId()));
            var missing = catchThrowable(() -> accessGuard.getAccessibleTaskById(404, stranger.getId()));

            assertThat(inaccessible).isInstanceOf(ResourceNotFoundException.class);
            assertThat(missing).isInstanceOf(ResourceNotFoundException.class);
            assertThat(inaccessible).hasMessage(missing.getMessage());
        }
    }

    @Nested
    @DisplayName("requireCommentOwnership")
    class RequireCommentOwnership {
        @Test
        @DisplayName("passes for the comment's own author")
        void passesForTheCommentsOwnAuthor() {
            Comment comment = TestEntityFactory.createComment(
                    5, TestEntityFactory.createTask(100, 1, project), member);

            assertThatCode(() -> accessGuard.requireCommentOwnership(comment, member.getId()))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("rejects anybody else, including the project owner")
        void rejectsAnybodyElseIncludingTheProjectOwner() {
            Comment comment = TestEntityFactory.createComment(
                    5, TestEntityFactory.createTask(100, 1, project), member);

            assertThatThrownBy(() -> accessGuard.requireCommentOwnership(comment, owner.getId()))
                    .isInstanceOf(AuthorizationException.class)
                    .hasMessage("User not authorized to modify this comment");
        }
    }
}
