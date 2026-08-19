package com.backend;

import com.backend.entities.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Builders for entities in unit tests, so a test body describes only what it is about. */
public final class TestEntityFactory {

    private TestEntityFactory() {}

    public static User createUser(Integer id, String email) {
        var user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setFirstname("User");
        user.setLastname(String.valueOf(id));
        user.setPassword("encoded-password");
        return user;
    }

    public static Project createProject(Integer id, String projectKey, User owner) {
        var project = new Project();
        project.setId(id);
        project.setProjectKey(projectKey);
        project.setSummary("Project " + projectKey);
        project.setDescription("Description for " + projectKey);
        project.setOwner(owner);
        project.setNextTaskNumber(1);
        project.replaceMembers(new ArrayList<>());
        return project;
    }

    public static Task createTask(Integer id, Integer taskNumber, Project project) {
        var task = new Task();
        task.setId(id);
        task.setTaskNumber(taskNumber);
        task.setProject(project);
        task.setSummary("Task " + taskNumber);
        task.setDescription("Description for task " + taskNumber);
        task.setStatus(TaskStatus.BACKLOG);
        task.setPriority(TaskPriority.MEDIUM);
        task.setProgress(0);
        return task;
    }

    public static Comment createComment(Integer id, Task task, User author) {
        var comment = new Comment(task, author, null, "Comment " + id, new ArrayList<>());
        comment.setId(id);
        return comment;
    }

    public static Notification createNotification(Integer id, User user) {
        var notification = new Notification();
        notification.setId(id);
        notification.setUser(user);
        notification.setMessage("Notification " + id);
        notification.setType(NotificationType.TASK_ASSIGNED);
        notification.setTimestamp(Instant.now());
        notification.setIsRead(false);
        return notification;
    }

    public static Project createProjectWithMembers(Integer id, String projectKey, User owner,
                                                   User... members) {
        var project = createProject(id, projectKey, owner);
        var all = new ArrayList<User>();
        all.add(owner);
        all.addAll(List.of(members));
        project.replaceMembers(all);
        return project;
    }
}
