package com.backend.scheduling;

import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;

import java.time.LocalDate;
import java.util.List;

/** Builders for the scheduling tests, so each test reads as the scenario it describes. */
final class ScheduleFixtures {

    static final LocalDate TODAY = LocalDate.of(2026, 1, 5);

    private ScheduleFixtures() {}

    static Builder task(String key) {
        return new Builder(key);
    }

    static final class Builder {
        private final String key;
        private String projectKey = "P";
        private LocalDate start = TODAY;
        private LocalDate due = TODAY.plusDays(4);
        private String assignee;
        private TaskPriority priority = TaskPriority.MEDIUM;
        private TaskStatus status = TaskStatus.TODO;
        private Integer progress = 0;
        private List<String> dependencies = List.of();

        private Builder(String key) {
            this.key = key;
            var dash = key.lastIndexOf('-');
            if (dash > 0) {
                this.projectKey = key.substring(0, dash);
            }
        }

        Builder from(String start) { this.start = LocalDate.parse(start); return this; }
        Builder to(String due) { this.due = LocalDate.parse(due); return this; }
        Builder assignedTo(String assignee) { this.assignee = assignee; return this; }
        Builder priority(TaskPriority priority) { this.priority = priority; return this; }
        Builder status(TaskStatus status) { this.status = status; return this; }
        Builder progress(int progress) { this.progress = progress; return this; }
        Builder dependsOn(String... keys) { this.dependencies = List.of(keys); return this; }

        TaskDTO build() {
            return new TaskDTO(null, null, key, projectKey, key, null, status, start, due,
                    assignee, List.of(), dependencies, null, List.of(), null, null, progress, priority);
        }
    }
}
