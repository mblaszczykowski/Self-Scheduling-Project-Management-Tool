package com.backend.repositories;

import java.util.Optional;

public record TaskKey(String projectKey, int taskNumber) {
    public static Optional<TaskKey> parse(String taskKey) {
        if (taskKey == null) {
            return Optional.empty();
        }
        var lastDash = taskKey.lastIndexOf('-');
        if (lastDash <= 0 || lastDash == taskKey.length() - 1) {
            return Optional.empty();
        }
        try {
            var number = Integer.parseInt(taskKey.substring(lastDash + 1));
            if (number <= 0) {
                return Optional.empty();
            }
            return Optional.of(new TaskKey(taskKey.substring(0, lastDash), number));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
