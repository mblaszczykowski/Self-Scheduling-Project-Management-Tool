package com.backend.integration;

import com.backend.entities.Project;
import com.backend.entities.Task;
import com.backend.entities.User;
import com.backend.exception.ValidationException;
import com.backend.repositories.ProjectRepository;
import com.backend.repositories.TaskRepository;
import com.backend.repositories.UserRepository;
import com.backend.requests.ProjectRequest;
import com.backend.requests.TaskRequest;
import com.backend.services.DependencyGraphLock;
import com.backend.services.OptimizationInputLoader;
import com.backend.services.ProjectService;
import com.backend.services.TaskService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DomainConcurrencyIntegrationTest extends PostgresIntegrationTest {
    @Autowired ProjectRepository projects;
    @Autowired TaskRepository tasks;
    @Autowired UserRepository users;
    @Autowired ProjectService projectService;
    @Autowired TaskService taskService;
    @Autowired OptimizationInputLoader inputLoader;
    @Autowired DependencyGraphLock graphLock;
    @Autowired PlatformTransactionManager transactionManager;

    private TransactionTemplate tx;
    private Integer userId;
    private Integer firstProjectId;
    private Integer secondProjectId;
    private Integer firstTaskId;
    private Integer secondTaskId;
    private String firstKey;
    private String secondKey;

    @BeforeEach
    void createFixture() {
        tx = new TransactionTemplate(transactionManager);
        var suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 7).toUpperCase();
        firstKey = "A" + suffix;
        secondKey = "B" + suffix;
        tx.executeWithoutResult(status -> {
            var owner = users.save(new User("Concurrent", "Reviewer", suffix + "@example.com", "hash"));
            userId = owner.getId();
            var first = saveProject(firstKey, owner);
            var second = saveProject(secondKey, owner);
            firstProjectId = first.getId();
            secondProjectId = second.getId();
            firstTaskId = saveTask(first, 1).getId();
            secondTaskId = saveTask(first, 2).getId();
        });
    }

    @AfterEach
    void deleteFixture() {
        tx.executeWithoutResult(status -> {
            projects.deleteById(firstProjectId);
            projects.deleteById(secondProjectId);
            projects.flush();
            users.deleteById(userId);
        });
    }

    @Test
    void concurrentTaskEdgesCannotCreateACycleAfterWaitingForTheGraphLock() throws Exception {
        var firstHasLock = new CountDownLatch(1);
        var releaseFirst = new CountDownLatch(1);
        var first = CompletableFuture.runAsync(() -> tx.executeWithoutResult(status -> {
            graphLock.tasks();
            var one = tasks.findById(firstTaskId).orElseThrow();
            one.replaceDependencies(List.of(tasks.findById(secondTaskId).orElseThrow()));
            firstHasLock.countDown();
            await(releaseFirst);
        }));
        assertThat(firstHasLock.await(10, TimeUnit.SECONDS)).isTrue();
        var second = CompletableFuture.runAsync(() -> taskService.updateTask(firstKey, firstKey + "-2",
                new TaskRequest("Second", null, null, null, 0, null, null, null,
                        List.of(), List.of(firstKey + "-1"), List.of()), userId, List.of()));
        try {
            assertThatThrownBy(() -> second.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
        } finally {
            releaseFirst.countDown();
        }
        first.get(10, TimeUnit.SECONDS);
        assertThatThrownBy(() -> second.get(10, TimeUnit.SECONDS)).hasCauseInstanceOf(ValidationException.class);
        tx.executeWithoutResult(status -> assertThat(tasks.findById(secondTaskId).orElseThrow().getDependencies()).isEmpty());
    }

    @Test
    void concurrentProjectEdgesCannotCreateACycleAfterWaitingForTheGraphLock() throws Exception {
        var firstHasLock = new CountDownLatch(1);
        var releaseFirst = new CountDownLatch(1);
        var first = CompletableFuture.runAsync(() -> tx.executeWithoutResult(status -> {
            graphLock.projects();
            var one = projects.findById(firstProjectId).orElseThrow();
            one.replaceDependencies(List.of(projects.findById(secondProjectId).orElseThrow()));
            firstHasLock.countDown();
            await(releaseFirst);
        }));
        assertThat(firstHasLock.await(10, TimeUnit.SECONDS)).isTrue();
        var second = CompletableFuture.runAsync(() -> projectService.updateProject(secondKey,
                new ProjectRequest(secondKey, "Second", null, null, List.of(firstKey), null), userId, List.of()));
        try {
            assertThatThrownBy(() -> second.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
        } finally {
            releaseFirst.countDown();
        }
        first.get(10, TimeUnit.SECONDS);
        assertThatThrownBy(() -> second.get(10, TimeUnit.SECONDS)).hasCauseInstanceOf(ValidationException.class);
        tx.executeWithoutResult(status -> assertThat(projects.findById(secondProjectId).orElseThrow().getDependencies()).isEmpty());
    }

    @Test
    void applyingCannotCommitWhenAnyLoadedTaskChangesDuringOptimization() throws Exception {
        var loaded = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var applying = CompletableFuture.runAsync(() -> tx.executeWithoutResult(status -> {
            inputLoader.load(List.of(firstKey), userId);
            loaded.countDown();
            await(release);
        }));
        assertThat(loaded.await(10, TimeUnit.SECONDS)).isTrue();
        try {
            tx.executeWithoutResult(status -> tasks.findById(secondTaskId).orElseThrow().setSummary("Concurrent edit"));
        } finally {
            release.countDown();
        }
        assertThatThrownBy(() -> applying.get(10, TimeUnit.SECONDS))
                .hasCauseInstanceOf(ObjectOptimisticLockingFailureException.class);
    }

    private Project saveProject(String key, User owner) {
        var project = new Project();
        project.setProjectKey(key);
        project.setSummary(key);
        project.setOwner(owner);
        project.replaceMembers(List.of(owner));
        return projects.save(project);
    }

    private Task saveTask(Project project, int number) {
        var task = new Task();
        task.setProject(project);
        task.setTaskNumber(number);
        task.setSummary("Task " + number);
        return tasks.save(task);
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(10, TimeUnit.SECONDS)) {
                throw new AssertionError("Concurrent operation did not finish in time");
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AssertionError(ex);
        }
    }
}
