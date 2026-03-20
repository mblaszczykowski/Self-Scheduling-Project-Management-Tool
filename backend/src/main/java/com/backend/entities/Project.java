package com.backend.entities;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;

@Entity
@Table(name = "projects",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_project_key", columnNames = "project_key")
        },
        indexes = {
                @Index(name = "idx_project_owner", columnList = "owner_id")
        }
)
@NamedEntityGraph(
        name = "Project.withMembers",
        attributeNodes = {
                @NamedAttributeNode("owner"),
                @NamedAttributeNode("members")
        }
)
public class Project {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "project_key", nullable = false, unique = true, updatable = false)
    private String projectKey;

    @Column(nullable = false)
    private String summary;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "next_task_number", nullable = false)
    private Integer nextTaskNumber = 1;

    @ElementCollection
    @CollectionTable(name = "project_attachments", joinColumns = @JoinColumn(name = "project_id"))
    @Column(name = "attachment_url")
    private List<String> attachments = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "project_members",
            joinColumns = @JoinColumn(name = "project_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private List<User> members = new ArrayList<>();

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Task> tasks = new ArrayList<>();

    @ManyToMany
    @JoinTable(
            name = "project_dependencies",
            joinColumns = @JoinColumn(name = "project_id",
                    foreignKey = @ForeignKey(foreignKeyDefinition = "FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE")),
            inverseJoinColumns = @JoinColumn(name = "dependency_id",
                    foreignKey = @ForeignKey(foreignKeyDefinition = "FOREIGN KEY (dependency_id) REFERENCES projects(id) ON DELETE CASCADE"))
    )
    private List<Project> dependencies = new ArrayList<>();

    public Project() {}

    public boolean isOwner(Integer userId) {
        return owner != null && owner.getId().equals(userId);
    }

    public boolean isMember(Integer userId) {
        return members.stream().anyMatch(m -> m.getId().equals(userId));
    }

    public boolean hasAccess(Integer userId) {
        return isOwner(userId) || isMember(userId);
    }

    public Integer allocateNextTaskNumber() {
        Integer number = this.nextTaskNumber;
        this.nextTaskNumber++;
        return number;
    }

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getProjectKey() { return projectKey; }
    public void setProjectKey(String projectKey) { this.projectKey = projectKey; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getNextTaskNumber() { return nextTaskNumber; }
    public void setNextTaskNumber(Integer nextTaskNumber) { this.nextTaskNumber = nextTaskNumber; }

    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }

    public List<Task> getTasks() { return Collections.unmodifiableList(tasks); }

    public List<String> getAttachments() { return Collections.unmodifiableList(attachments); }

    public void replaceAttachments(List<String> attachments) {
        this.attachments.clear();
        if (attachments != null) {
            this.attachments.addAll(attachments);
        }
    }

    public void addAttachments(Collection<String> attachments) {
        if (attachments != null) {
            this.attachments.addAll(attachments);
        }
    }

    public List<User> getMembers() { return Collections.unmodifiableList(members); }

    public void replaceMembers(Collection<? extends User> members) {
        this.members.clear();
        if (members != null) {
            this.members.addAll(members);
        }
    }

    public List<Project> getDependencies() { return Collections.unmodifiableList(dependencies); }

    public void replaceDependencies(List<Project> dependencies) {
        this.dependencies.clear();
        if (dependencies != null) {
            this.dependencies.addAll(dependencies);
        }
    }

    public void clearDependencies() {
        this.dependencies.clear();
    }
}