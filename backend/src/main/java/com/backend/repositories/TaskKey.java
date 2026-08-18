package com.backend.repositories;

import java.util.Optional;

/**
 * The two halves of a task key such as {@code WEB-14}.
 *
 * <p>One parser, because the {@code lastIndexOf('-')} + {@code parseInt} dance was written three
 * times — in the repository, in dependency resolution, and in the optimizer's apply path — and
 * all three swallowed malformed input differently.
 */
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
