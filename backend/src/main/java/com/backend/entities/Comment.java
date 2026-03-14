package com.backend.entities;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.ArrayList;
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

    @OneToMany(mappedBy = "parentComment", cascade = CascadeType.ALL, orphanRemoval = true)
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

    public List<Comment> getReplies() { return replies; }
    public void setReplies(List<Comment> replies) { this.replies = replies; }

    public Set<CommentReaction> getReactions() { return reactions; }
    public void setReactions(Set<CommentReaction> reactions) { this.reactions = reactions; }

    public Set<String> getAttachments() { return attachments; }
    public void setAttachments(Set<String> attachments) { this.attachments = attachments; }
}
