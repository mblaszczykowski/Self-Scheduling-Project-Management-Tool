package com.backend.entities;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "task_activities",
        indexes = {
                @Index(name = "idx_task_activity_task", columnList = "task_id"),
        @Index(name = "idx_task_activity_author", columnList = "author_id"),
                @Index(name = "idx_task_activity_timestamp", columnList = "task_id, timestamp")
        }
)
public class TaskActivity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskActivityType type;

    @Column(name = "field_name")
    private String fieldName;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(nullable = false, updatable = false)
    private Instant timestamp;

    public TaskActivity() {
        this.timestamp = Instant.now();
    }

    public TaskActivity(Task task, User author, TaskActivityType type, String fieldName,
                        String oldValue, String newValue) {
        this();
        this.task = task;
        this.author = author;
        this.type = type;
        this.fieldName = fieldName;
        this.oldValue = oldValue;
        this.newValue = newValue;
    }

    public Integer getId() { return id; }
    public Task getTask() { return task; }
    public User getAuthor() { return author; }
    public TaskActivityType getType() { return type; }
    public String getFieldName() { return fieldName; }
    public String getOldValue() { return oldValue; }
    public String getNewValue() { return newValue; }
    public Instant getTimestamp() { return timestamp; }
}
