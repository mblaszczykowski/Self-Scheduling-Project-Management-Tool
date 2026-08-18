package com.backend.entities;

import jakarta.persistence.*;
import org.hibernate.Hibernate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Entity
@Table(name = "tasks",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_task_project_number", columnNames = {"project_id", "task_number"})
        },
        indexes = {
                @Index(name = "idx_task_project", columnList = "project_id"),
                @Index(name = "idx_task_assignee", columnList = "assignee_id")
        }
)
// Only to-one associations are fetch-joined. The `dependencies` collection is loaded lazily
// and batched (hibernate.default_batch_fetch_size): fetch-joining it here produced a cartesian
// product / duplicate root rows and forced in-memory pagination on the paged search query.
@NamedEntityGraph(
        name = "Task.withDetails",
        attributeNodes = {
                @NamedAttributeNode("assignee"),
                @NamedAttributeNode("project")
        }
)
public class Task {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Version
    private Long version; // optimistic lock — concurrent edits surface as OptimisticLockException (409)

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
            joinColumns = @JoinColumn(name = "task_id",
                    foreignKey = @ForeignKey(foreignKeyDefinition = "FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE")),
            inverseJoinColumns = @JoinColumn(name = "dependency_id",
                    foreignKey = @ForeignKey(foreignKeyDefinition = "FOREIGN KEY (dependency_id) REFERENCES tasks(id) ON DELETE CASCADE"))
    )
    private Set<Task> dependencies = new HashSet<>();

    @OneToMany(mappedBy = "task")
    private List<Comment> comments = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "task_attachments", joinColumns = @JoinColumn(name = "task_id"))
    @Column(name = "attachment_url")
    private List<String> attachments = new ArrayList<>();

    @Column(name = "created", nullable = false, updatable = false)
    private Instant created;

    @Column(name = "updated", nullable = false)
    private Instant updated;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
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

    public Integer getId() { return id; }

    /**
     * Exposed deliberately, and not only for completeness.
     *
     * <p>Spring Data decides whether an entity is new by reading its version property, and with no
     * getter it falls back to reading the field directly. On an uninitialized Hibernate proxy that
     * field is null, so {@code repository.delete(proxy)} concluded the entity was unsaved and
     * silently did nothing. Going through a getter initializes the proxy and returns the real value.
     */
    public Long getVersion() {
        return version;
    }

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

    public Set<Task> getDependencies() { return Collections.unmodifiableSet(dependencies); }

    public void replaceDependencies(Collection<Task> dependencies) {
        this.dependencies.clear();
        if (dependencies != null) {
            this.dependencies.addAll(dependencies);
        }
    }

    public void clearDependencies() {
        this.dependencies.clear();
    }

    public List<String> getAttachments() { return Collections.unmodifiableList(attachments); }

    public void replaceAttachments(List<String> attachments) {
        this.attachments.clear();
        if (attachments != null) {
            this.attachments.addAll(attachments);
        }
    }

    public void addAttachments(List<String> attachments) {
        if (attachments != null) {
            this.attachments.addAll(attachments);
        }
    }

    public Instant getCreated() { return created; }

    public Instant getUpdated() { return updated; }

    public Integer getProgress() { return progress; }
    public void setProgress(Integer progress) { this.progress = progress; }

    public List<Comment> getComments() { return Collections.unmodifiableList(comments); }

    public TaskPriority getPriority() { return priority; }
    public void setPriority(TaskPriority priority) { this.priority = priority; }

    // See User.equals for why hashCode is constant per type rather than id-derived.
    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (other == null || Hibernate.getClass(this) != Hibernate.getClass(other)) return false;
        var that = (Task) other;
        return id != null && Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Hibernate.getClass(this).hashCode();
    }
}
