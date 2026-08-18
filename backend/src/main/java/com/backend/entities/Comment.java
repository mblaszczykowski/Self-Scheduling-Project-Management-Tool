package com.backend.entities;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "comments", indexes = {
        @Index(name = "idx_comment_task", columnList = "task_id"),
        @Index(name = "idx_comment_author", columnList = "author_id"),
        @Index(name = "idx_comment_parent", columnList = "parent_comment_id")
})
public class Comment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Version
    private Long version; // optimistic lock — concurrent edits surface as OptimisticLockException (409)

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false, updatable = false)
    private Instant timestamp;

    private Instant editedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_comment_id")
    private Comment parentComment;

    @OneToMany(mappedBy = "parentComment")
    private List<Comment> replies = new ArrayList<>();

    @OneToMany(mappedBy = "comment", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<CommentReaction> reactions = new HashSet<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "comment_attachments", joinColumns = @JoinColumn(name = "comment_id"))
    @Column(name = "attachment_url")
    private Set<String> attachments = new HashSet<>();

    public Comment() {
        this.timestamp = Instant.now();
    }

    public Comment(Task task, User author, Comment parentComment, String content, List<String> attachments) {
        this.task = task;
        this.author = author;
        this.parentComment = parentComment;
        this.content = content;
        this.attachments = attachments != null ? new HashSet<>(attachments) : new HashSet<>();
        this.timestamp = Instant.now();
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

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public Instant getTimestamp() { return timestamp; }

    public Instant getEditedAt() { return editedAt; }
    public void setEditedAt(Instant editedAt) { this.editedAt = editedAt; }

    public Task getTask() { return task; }
    public void setTask(Task task) { this.task = task; }

    public User getAuthor() { return author; }
    public void setAuthor(User author) { this.author = author; }

    public Comment getParentComment() { return parentComment; }
    public void setParentComment(Comment parentComment) { this.parentComment = parentComment; }

    public List<Comment> getReplies() { return Collections.unmodifiableList(replies); }

    public Set<CommentReaction> getReactions() { return Collections.unmodifiableSet(reactions); }

    // Reactions are mutated through the aggregate so the in-memory collection always matches
    // what will be flushed — the DTO built from getReactions() then reflects the change by
    // construction, rather than depending on Hibernate's flush/collection-load ordering.
    public void addReaction(CommentReaction reaction) {
        if (reaction == null) return;
        reaction.setComment(this);
        this.reactions.add(reaction);
    }

    public void removeReaction(CommentReaction reaction) {
        if (reaction == null) return;
        this.reactions.remove(reaction);
        reaction.setComment(null);
    }

    public Set<String> getAttachments() { return Collections.unmodifiableSet(attachments); }

    public void addAttachments(Collection<String> attachments) {
        if (attachments != null) {
            this.attachments.addAll(attachments);
        }
    }

    public void replaceAttachments(Set<String> attachments) {
        this.attachments.clear();
        if (attachments != null) {
            this.attachments.addAll(attachments);
        }
    }
}
