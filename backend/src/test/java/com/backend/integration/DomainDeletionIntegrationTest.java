package com.backend.integration;

import com.backend.config.AppProperties;
import com.backend.dtos.TaskDTO;
import com.backend.entities.ReactionType;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import com.backend.entities.User;
import com.backend.repositories.UserRepository;
import com.backend.requests.ApplyOptimizationRequest;
import com.backend.requests.OptimizationRequest;
import com.backend.requests.ProjectRequest;
import com.backend.requests.TaskRequest;
import com.backend.services.CommentService;
import com.backend.services.FileStorageService;
import com.backend.services.OptimizationService;
import com.backend.services.ProjectService;
import com.backend.services.TaskService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Each real create/edit/delete service call commits in its own transaction. */
class DomainDeletionIntegrationTest extends PostgresIntegrationTest {
    @Autowired ProjectService projectService;
    @Autowired TaskService taskService;
    @Autowired CommentService commentService;
    @Autowired OptimizationService optimizationService;
    @Autowired FileStorageService fileStorageService;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired AppProperties properties;

    private TransactionTemplate tx;
    private Integer ownerId;
    private Integer memberId;
    private Integer projectId;
    private Integer otherProjectId;
    private Integer rootCommentId;
    private Integer replyCommentId;
    private String key;
    private String otherKey;
    private String ownerEmail;
    private TaskDTO firstTask;
    private TaskDTO secondTask;
    private final List<String> fileUrls = new ArrayList<>();

    @BeforeEach
    void createAndEditThroughServices() {
        tx = new TransactionTemplate(transactionManager);
        var suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 7).toUpperCase();
        key = "D" + suffix;
        otherKey = "E" + suffix;
        ownerEmail = "owner" + suffix + "@example.com";
        tx.executeWithoutResult(status -> {
            ownerId = users.save(new User("Owner", suffix, ownerEmail, "hash")).getId();
            memberId = users.save(new User("Member", suffix, "member" + suffix + "@example.com", "hash")).getId();
        });
        var project = projectService.createProject(new ProjectRequest(key, "Deletion regression", "Details",
                List.of("member" + suffix + "@example.com"), List.of(), List.of()), ownerId, List.of(upload()));
        projectId = project.id();
        fileUrls.addAll(project.attachments());
        var other = projectService.createProject(new ProjectRequest(otherKey, "Other project", null,
                List.of(), List.of(key), List.of()), ownerId, List.of());
        otherProjectId = other.id();
        firstTask = taskService.createTask(key, taskRequest("First", List.of(), List.of()), ownerId, List.of(upload()));
        fileUrls.addAll(firstTask.attachments());
        secondTask = taskService.createTask(key, taskRequest("Second", List.of(), List.of()), ownerId, List.of());
        taskService.createTask(otherKey, taskRequest("Incoming dependency", List.of(firstTask.taskKey()), List.of()),
                ownerId, List.of());
        var root = commentService.addComment(firstTask.id(), ownerId, "Root comment", List.of(upload()), null);
        rootCommentId = root.id();
        fileUrls.addAll(root.attachments());
        var reply = commentService.addComment(firstTask.id(), memberId, "Reply", List.of(upload()), root.id());
        replyCommentId = reply.id();
        fileUrls.addAll(reply.attachments());
        commentService.addComment(firstTask.id(), ownerId, "Nested reply", List.of(), reply.id());
        commentService.reactToComment(firstTask.id(), root.id(), memberId, ReactionType.LIKE);
        commentService.updateComment(firstTask.id(), root.id(), ownerId, "Edited root", List.of());
        firstTask = taskService.updateTask(key, firstTask.taskKey(),
                taskRequest("Edited task", List.of(), firstTask.attachments()), ownerId, List.of());
    }

    @AfterEach
    void cleanFixtureEvenWhenTheServiceRegressionFails() {
        tx.executeWithoutResult(status -> {
            if (projectId != null) jdbc.update("DELETE FROM projects WHERE id = ?", projectId);
            if (otherProjectId != null) jdbc.update("DELETE FROM projects WHERE id = ?", otherProjectId);
            if (ownerId != null) jdbc.update("DELETE FROM users WHERE id = ?", ownerId);
            if (memberId != null) jdbc.update("DELETE FROM users WHERE id = ?", memberId);
        });
        fileStorageService.deleteFilesSilently(fileUrls);
    }

    @Test
    void deletingProjectThroughTheServiceCleansTheLoadedGraphAndIncomingReferences() {
        projectService.deleteProject(key, ownerId);
        assertProjectAndChildrenDeleted();
    }

    @Test
    void deletingProjectAfterApplyingOptimizationCommitsAndCleansAllChildren() {
        var preview = optimizationService.simulate(new OptimizationRequest(List.of(key), null, null, LocalDate.now()), ownerId);
        assertThat(preview.tasksShifted()).isPositive();
        var updated = optimizationService.apply(new ApplyOptimizationRequest(List.of(key), null, null,
                LocalDate.now(), preview.suggestions().stream().map(s -> s.taskKey()).toList(), preview.previewToken()), ownerId);
        assertThat(updated).isPositive();

        projectService.deleteProject(key, ownerId);
        assertProjectAndChildrenDeleted();
    }

    @Test
    void deletingTaskThroughTheServiceCleansLoadedCommentsReactionsActivitiesAndDependencies() {
        taskService.deleteTask(key, firstTask.taskKey(), ownerId);
        assertThat(count("SELECT count(*) FROM tasks WHERE id = ?", firstTask.id())).isZero();
        assertTaskChildrenDeleted(firstTask.id());
        assertThat(count("SELECT count(*) FROM task_dependencies WHERE dependency_id = ?", firstTask.id())).isZero();
        assertThat(count("SELECT count(*) FROM projects WHERE id = ?", projectId)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM tasks WHERE id = ?", secondTask.id())).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM tasks WHERE project_id = ?", otherProjectId)).isEqualTo(1);
        assertPhysicalFilesDeleted(fileUrls.subList(1, fileUrls.size()));
    }

    @Test
    void deletingCommentThroughTheServiceCleansTheWholeLoadedReplyTree() {
        commentService.deleteComment(firstTask.id(), rootCommentId, ownerId);
        assertThat(count("SELECT count(*) FROM comments WHERE task_id = ?", firstTask.id())).isZero();
        assertThat(count("SELECT count(*) FROM comment_reactions WHERE comment_id IN (?, ?)", rootCommentId, replyCommentId)).isZero();
        assertThat(count("SELECT count(*) FROM comment_attachments WHERE comment_id IN (?, ?)", rootCommentId, replyCommentId)).isZero();
        assertThat(count("SELECT count(*) FROM tasks WHERE id = ?", firstTask.id())).isEqualTo(1);
        assertPhysicalFilesDeleted(fileUrls.subList(2, fileUrls.size()));
    }

    private void assertProjectAndChildrenDeleted() {
        assertThat(count("SELECT count(*) FROM projects WHERE id = ?", projectId)).isZero();
        assertThat(count("SELECT count(*) FROM tasks WHERE project_id = ?", projectId)).isZero();
        assertThat(count("SELECT count(*) FROM project_members WHERE project_id = ?", projectId)).isZero();
        assertThat(count("SELECT count(*) FROM project_attachments WHERE project_id = ?", projectId)).isZero();
        assertThat(count("SELECT count(*) FROM stored_files WHERE project_id = ?", projectId)).isZero();
        assertThat(count("SELECT count(*) FROM project_dependencies WHERE project_id = ? OR dependency_id = ?", projectId, projectId)).isZero();
        assertThat(count("SELECT count(*) FROM task_dependencies WHERE task_id IN (?, ?) OR dependency_id IN (?, ?)",
                firstTask.id(), secondTask.id(), firstTask.id(), secondTask.id())).isZero();
        assertTaskChildrenDeleted(firstTask.id());
        assertTaskChildrenDeleted(secondTask.id());
        assertThat(count("SELECT count(*) FROM projects WHERE id = ?", otherProjectId)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM tasks WHERE project_id = ?", otherProjectId)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM users WHERE id IN (?, ?)", ownerId, memberId)).isEqualTo(2);
        assertPhysicalFilesDeleted(fileUrls);
    }

    private void assertTaskChildrenDeleted(Integer taskId) {
        assertThat(count("SELECT count(*) FROM comments WHERE task_id = ?", taskId)).isZero();
        assertThat(count("SELECT count(*) FROM task_activities WHERE task_id = ?", taskId)).isZero();
        assertThat(count("SELECT count(*) FROM task_attachments WHERE task_id = ?", taskId)).isZero();
        assertThat(count("SELECT count(*) FROM comment_reactions WHERE comment_id IN (?, ?)", rootCommentId, replyCommentId)).isZero();
        assertThat(count("SELECT count(*) FROM comment_attachments WHERE comment_id IN (?, ?)", rootCommentId, replyCommentId)).isZero();
    }

    private void assertPhysicalFilesDeleted(List<String> urls) {
        var directory = Path.of(properties.getStorage().getUploadDir());
        for (var url : urls) {
            assertThat(Files.exists(directory.resolve(url.substring(url.lastIndexOf('/') + 1))))
                    .as("physical attachment %s", url).isFalse();
        }
    }

    private long count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Long.class, args);
    }

    private TaskRequest taskRequest(String summary, List<String> dependencies, List<String> attachments) {
        var today = LocalDate.now();
        return new TaskRequest(summary, "Description", TaskStatus.TODO, TaskPriority.MEDIUM,
                50, today.plusDays(1), today.plusDays(3), ownerEmail, List.of(), dependencies, attachments);
    }

    private MockMultipartFile upload() {
        return new MockMultipartFile("attachments", "note.txt", "text/plain", "Attachment text".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
