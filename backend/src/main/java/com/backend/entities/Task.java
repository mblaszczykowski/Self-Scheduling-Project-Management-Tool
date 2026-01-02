package com.backend.entities;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "tasks",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_task_project_number", columnNames = {"project_id", "task_number"})
        },
        indexes = {
                @Index(name = "idx_task_project", columnList = "project_id"),
                @Index(name = "idx_task_assignee", columnList = "assignee_id"),
                @Index(name = "idx_task_status", columnList = "status"),
                @Index(name = "idx_task_due_date", columnList = "due_date"),
                @Index(name = "idx_task_priority", columnList = "priority")
        }
)
@NamedEntityGraph(
        name = "Task.withDetails",
        attributeNodes = {
                @NamedAttributeNode("assignee"),
                @NamedAttributeNode("project"),
                @NamedAttributeNode(value = "dependencies", subgraph = "dependency-project")
        },
        subgraphs = {
                @NamedSubgraph(name = "dependency-project", attributeNodes = @NamedAttributeNode("project"))
        }
)
public class Task {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "task_number", nullable = false)
    private Integer taskNumber;

    @Column(nullable = false)
    private String summary;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status = TaskStatus.BACKLOG;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "progress")
    private Integer progress = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    private User assignee;

    private String labels;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToMany
    @JoinTable(
            name = "task_dependencies",
            joinColumns = @JoinColumn(name = "task_id"),
            inverseJoinColumns = @JoinColumn(name = "dependency_id")
    )
    private List<Task> dependencies = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "task_attachments", joinColumns = @JoinColumn(name = "task_id"))
    @Column(name = "attachment_url")
    private List<String> attachments = new ArrayList<>();

    @Column(name = "created", nullable = false, updatable = false)
    private Instant created;

    @Column(name = "updated", nullable = false)
    private Instant updated;

    @Enumerated(EnumType.STRING)
    @Column
    private TaskPriority priority = TaskPriority.MEDIUM;

    public Task() {
        this.created = Instant.now();
        this.updated = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updated = Instant.now();
    }

    public String getTaskKey() {
        if (project == null || taskNumber == null) {
            return null;
        }
        return project.getProjectKey() + "-" + taskNumber;
    }

    // Getters and Setters
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public Integer getTaskNumber() { return taskNumber; }
    public void setTaskNumber(Integer taskNumber) { this.taskNumber = taskNumber; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public User getAssignee() { return assignee; }
    public void setAssignee(User assignee) { this.assignee = assignee; }

    public String getLabels() { return labels; }
    public void setLabels(String labels) { this.labels = labels; }

    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }

    public List<Task> getDependencies() { return dependencies; }
    public void setDependencies(List<Task> dependencies) { this.dependencies = dependencies; }

    public List<String> getAttachments() { return attachments; }
    public void setAttachments(List<String> attachments) { this.attachments = attachments; }

    public Instant getCreated() { return created; }
    public void setCreated(Instant created) { this.created = created; }

    public Instant getUpdated() { return updated; }
    public void setUpdated(Instant updated) { this.updated = updated; }

    public Integer getProgress() { return progress; }
    public void setProgress(Integer progress) { this.progress = progress; }

    public TaskPriority getPriority() { return priority; }
    public void setPriority(TaskPriority priority) { this.priority = priority; }
}