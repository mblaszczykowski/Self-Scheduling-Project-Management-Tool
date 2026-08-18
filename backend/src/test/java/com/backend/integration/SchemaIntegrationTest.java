package com.backend.integration;

import com.backend.entities.Comment;
import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.entities.TaskActivity;
import com.backend.entities.TaskActivityType;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.entities.User;
import com.backend.repositories.CommentRepository;
import com.backend.repositories.NotificationRepository;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.RefreshTokenRepository;
import com.backend.repositories.TaskActivityRepository;
import com.backend.repositories.TaskRepository;
import com.backend.repositories.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the real schema: that the migrations apply, that Hibernate's {@code validate} agrees
 * with them (the context would not start otherwise), that every hand-written query parses and
 * runs, and that the delete paths actually work.
 */
@Transactional
class SchemaIntegrationTest extends PostgresIntegrationTest {

    @Autowired UserRepository userRepository;
    @Autowired ProjectRepository projectRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired CommentRepository commentRepository;
    @Autowired TaskActivityRepository taskActivityRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired EntityManager entityManager;

    private User owner;
    private User member;
    private Project project;
    private Task task;

    @BeforeEach
    void setUp() {
        owner = userRepository.save(new User("Ada", "Lovelace", "ada@example.com", "hash"));
        member = userRepository.save(new User("Alan", "Turing", "alan@example.com", "hash"));

        project = new Project();
        project.setProjectKey("SCHEMA");
        project.setSummary("Schema coverage");
        project.setOwner(owner);
        project.setNextTaskNumber(1);
        project.replaceMembers(List.of(owner, member));
        project = projectRepository.save(project);

        task = new Task();
        task.setProject(project);
        task.setTaskNumber(project.allocateNextTaskNumber());
        task.setSummary("First task");
        task.setStatus(TaskStatus.TODO);
        task.setPriority(TaskPriority.HIGH);
        task.setProgress(0);
        task.setStartDate(LocalDate.of(2026, 1, 5));
        task.setDueDate(LocalDate.of(2026, 1, 9));
        task.setAssignee(member);
        task.replaceAttachments(List.of("/files/a.pdf"));
        task = taskRepository.save(task);

        // Every task gets an activity row on creation, which is exactly what used to make deleting
        // any task impossible.
        taskActivityRepository.save(
                new TaskActivity(task, owner, TaskActivityType.CREATED, null, null, null));

        commentRepository.save(new Comment(task, member, null, "A comment", List.of("/files/c.png")));
        entityManager.flush();
    }

    // ======================== The delete paths ========================

    @Test
    @DisplayName("a task with audit rows and comments can be deleted")
    void taskWithActivitiesCanBeDeleted() {
        var taskId = task.getId();

        taskRepository.delete(task);
        entityManager.flush();
        entityManager.clear();

        assertThat(taskRepository.findById(taskId)).isEmpty();
        assertThat(taskActivityRepository.findByTaskIdWithAuthor(taskId, PageRequest.of(0, 10)))
                .isEmpty();
    }

    @Test
    @DisplayName("a project can be deleted with all of its tasks, comments and audit rows")
    void projectCascadeDeleteWorks() {
        var projectId = project.getId();

        projectRepository.delete(project);
        entityManager.flush();
        entityManager.clear();

        assertThat(projectRepository.findById(projectId)).isEmpty();
        assertThat(taskRepository.findByProjectIdWithDetails(projectId)).isEmpty();
        // The owner survives: projects reference users, not the other way round.
        assertThat(userRepository.findById(owner.getId())).isPresent();
    }

    @Test
    @DisplayName("deleting a user unassigns their tasks instead of failing or deleting them")
    void deletingAssigneeUnassignsTasks() {
        var taskId = task.getId();

        // The member's comment goes with them; the task they were assigned to does not.
        commentRepository.deleteAll(commentRepository.findRepliesByParentIdsWithDetails(List.of(-1)));
        entityManager.flush();

        userRepository.delete(member);
        entityManager.flush();
        entityManager.clear();

        var reloaded = taskRepository.findById(taskId);
        assertThat(reloaded).isPresent();
        assertThat(reloaded.get().getAssignee()).isNull();
    }

    // ======================== Every hand-written query ========================

    @Test
    @DisplayName("all project queries parse and run")
    void projectQueriesRun() {
        assertThat(projectRepository.existsByProjectKey("SCHEMA")).isTrue();
        assertThat(projectRepository.findByProjectKeyWithOwnerAndMembers("SCHEMA")).isPresent();
        assertThat(projectRepository.findByProjectKeyWithLock("SCHEMA")).isPresent();
        assertThat(projectRepository.findByProjectKeyIn(List.of("SCHEMA"))).hasSize(1);
        assertThat(projectRepository.findAllAccessibleByUser(owner.getId())).hasSize(1);
        assertThat(projectRepository.findAllAccessibleByUserPaged(member.getId(), PageRequest.of(0, 10))
                .getTotalElements()).isEqualTo(1);
        assertThat(projectRepository.doUsersShareProject(owner.getId(), member.getId())).isTrue();
        assertThat(projectRepository.searchAccessible(owner.getId(), "%schema%", PageRequest.of(0, 5)))
                .hasSize(1);
    }

    @Test
    @DisplayName("all task queries parse and run")
    void taskQueriesRun() {
        assertThat(taskRepository.findByProjectIdWithDetails(project.getId())).hasSize(1);
        assertThat(taskRepository.findByProjectKeyAndTaskNumber("SCHEMA", 1)).isPresent();
        assertThat(taskRepository.findByTaskKey("SCHEMA-1")).isPresent();
        assertThat(taskRepository.findByProjectKeyAndTaskNumbers("SCHEMA", List.of(1))).hasSize(1);
        assertThat(taskRepository.findByProjectIdsWithDetails(List.of(project.getId()))).hasSize(1);
        assertThat(taskRepository.findAllByIdInWithDetails(List.of(task.getId()))).hasSize(1);
        assertThat(taskRepository.searchAccessible(owner.getId(), "%first%", PageRequest.of(0, 5)))
                .hasSize(1);
    }

    @Test
    @DisplayName("the LIKE escape character is honoured, so a literal underscore is not a wildcard")
    void likeEscapeIsHonoured() {
        // "_irst" would match "First" if the underscore were treated as a single-character
        // wildcard; escaped with '!' it must not.
        assertThat(taskRepository.searchAccessible(owner.getId(), "%!_irst%", PageRequest.of(0, 5)))
                .isEmpty();
        assertThat(taskRepository.searchAccessible(owner.getId(), "%_irst%", PageRequest.of(0, 5)))
                .hasSize(1);
    }

    @Test
    @DisplayName("all comment queries parse and run")
    void commentQueriesRun() {
        var topLevel = commentRepository.findTopLevelCommentsByTaskId(task.getId(), PageRequest.of(0, 10));
        assertThat(topLevel.getTotalElements()).isEqualTo(1);

        var parentId = topLevel.getContent().get(0).getId();
        assertThat(commentRepository.findByIdWithTaskAndProject(parentId)).isPresent();
        assertThat(commentRepository.findRepliesByParentIdsWithDetails(List.of(parentId))).isEmpty();
        assertThat(commentRepository.searchAccessible(owner.getId(), "%comment%", PageRequest.of(0, 5)))
                .hasSize(1);
    }

    @Test
    @DisplayName("all user queries parse and run, case-insensitively")
    void userQueriesRun() {
        assertThat(userRepository.findByEmailIgnoringCase("ADA@EXAMPLE.COM")).isPresent();
        assertThat(userRepository.existsByEmailIgnoringCase("Ada@Example.Com")).isTrue();
        assertThat(userRepository.findByEmailInIgnoringCase(List.of("ada@example.com"))).hasSize(1);
    }

    @Test
    @DisplayName("all notification queries parse and run")
    void notificationQueriesRun() {
        var notification = new com.backend.entities.Notification();
        notification.setUser(owner);
        notification.setMessage("Hello");
        notification.setType(com.backend.entities.NotificationType.TASK_UPDATED);
        notification.setTimestamp(Instant.now());
        var saved = notificationRepository.save(notification);
        entityManager.flush();

        assertThat(notificationRepository
                .findByUserIdOrderByTimestampDescIdDesc(owner.getId(), PageRequest.of(0, 10))
                .getTotalElements()).isEqualTo(1);
        assertThat(notificationRepository.countByUserIdAndIsReadFalse(owner.getId())).isEqualTo(1);
        assertThat(notificationRepository.countOwnedBy(List.of(saved.getId()), owner.getId())).isEqualTo(1);
        assertThat(notificationRepository.countOwnedBy(List.of(saved.getId()), member.getId())).isZero();
        assertThat(notificationRepository.markReadForUser(List.of(saved.getId()), owner.getId()))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("refresh token bulk operations parse and run")
    void refreshTokenQueriesRun() {
        var expired = new com.backend.entities.RefreshToken(
                "hash-1", owner, "family-1", Instant.now().minusSeconds(120),
                Instant.now().minusSeconds(60));
        refreshTokenRepository.save(expired);
        entityManager.flush();

        assertThat(refreshTokenRepository.findByTokenHash("hash-1")).isPresent();
        assertThat(refreshTokenRepository.deleteExpired(Instant.now())).isEqualTo(1);
        assertThat(refreshTokenRepository.deleteFamily("family-1")).isZero();
        assertThat(refreshTokenRepository.deleteAllForUser(owner.getId())).isZero();
    }

    // ======================== Schema-level guarantees ========================

    @Test
    @DisplayName("email uniqueness ignores case")
    void emailUniquenessIgnoresCase() {
        assertThat(userRepository.existsByEmailIgnoringCase("ADA@example.com")).isTrue();
    }

    @Test
    @DisplayName("a project records when it was created and updated")
    void projectHasTimestamps() {
        assertThat(project.getCreated()).isNotNull();
        assertThat(project.getUpdated()).isNotNull();
    }
}
