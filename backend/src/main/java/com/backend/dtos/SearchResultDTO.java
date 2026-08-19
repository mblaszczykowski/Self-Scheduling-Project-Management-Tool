package com.backend.dtos;

import java.util.List;

public record SearchResultDTO(
    List<ProjectResult> projects,
    List<TaskResult> tasks,
    List<CommentResult> comments
) {
    public record ProjectResult(String projectKey, String summary, String description) {}
    public record TaskResult(String taskKey, String projectKey, String summary, String status, String priority, String assigneeName) {}
    public record CommentResult(Integer commentId, Integer taskId, String taskKey, String authorName, String snippet) {}
}
