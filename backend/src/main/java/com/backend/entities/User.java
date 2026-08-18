package com.backend.entities;

import jakarta.persistence.*;
import org.hibernate.Hibernate;

import java.util.Objects;

@Entity
@Table(name = "users", uniqueConstraints = {
        @UniqueConstraint(
                name = "user_email_unique",
                columnNames = "email"
        )
})
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false)
    private Integer id;

    @Version
    private Long version; // profile save vs. preferences patch would otherwise clobber each other

    @Column(name = "first_name", nullable = false)
    private String firstname;

    @Column(name = "last_name", nullable = false)
    private String lastname;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "password", nullable = false)
    private String password;

    @Column(name = "profile_picture")
    private String profilePicture;

    @Column(name = "email_notifications_enabled", nullable = false, columnDefinition = "boolean not null default true")
    private Boolean emailNotificationsEnabled = true;

    @Column(name = "email_on_task_assigned", nullable = false, columnDefinition = "boolean not null default true")
    private Boolean emailOnTaskAssigned = true;

    @Column(name = "email_on_comment_reply", nullable = false, columnDefinition = "boolean not null default true")
    private Boolean emailOnCommentReply = true;

    @Column(name = "email_on_project_invitation", nullable = false, columnDefinition = "boolean not null default true")
    private Boolean emailOnProjectInvitation = true;


    public User() {
    }

    public User(String firstname, String lastname, String email, String password) {
        this.firstname = firstname;
        this.lastname = lastname;
        this.email = email;
        this.password = password;
    }

    public Integer getId() {
        return id;
    }

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


    public void setId(Integer id) {
        this.id = id;
    }

    public String getFirstname() {
        return firstname;
    }

    public void setFirstname(String firstname) {
        this.firstname = firstname;
    }

    public String getLastname() {
        return lastname;
    }

    public void setLastname(String lastname) {
        this.lastname = lastname;
    }

    public String getFullName() {
        return firstname + " " + lastname;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getProfilePicture() {
        return profilePicture;
    }

    public void setProfilePicture(String profilePicture) {
        this.profilePicture = profilePicture;
    }

    public Boolean getEmailNotificationsEnabled() {
        return emailNotificationsEnabled;
    }

    public void setEmailNotificationsEnabled(Boolean emailNotificationsEnabled) {
        this.emailNotificationsEnabled = emailNotificationsEnabled;
    }

    public Boolean getEmailOnTaskAssigned() {
        return emailOnTaskAssigned;
    }

    public void setEmailOnTaskAssigned(Boolean emailOnTaskAssigned) {
        this.emailOnTaskAssigned = emailOnTaskAssigned;
    }

    public Boolean getEmailOnCommentReply() {
        return emailOnCommentReply;
    }

    public void setEmailOnCommentReply(Boolean emailOnCommentReply) {
        this.emailOnCommentReply = emailOnCommentReply;
    }

    public Boolean getEmailOnProjectInvitation() {
        return emailOnProjectInvitation;
    }

    public void setEmailOnProjectInvitation(Boolean emailOnProjectInvitation) {
        this.emailOnProjectInvitation = emailOnProjectInvitation;
    }

    /** Whether this user wants an email for the given notification type, per their preferences. */
    public boolean wantsEmailFor(NotificationType type) {
        if (!Boolean.TRUE.equals(emailNotificationsEnabled)) {
            return false;
        }
        return switch (type) {
            case TASK_ASSIGNED, TASK_UPDATED, TASK_DELETED, TASK_COMMENT ->
                    Boolean.TRUE.equals(emailOnTaskAssigned);
            case COMMENT_REPLY, COMMENT_REACTION ->
                    Boolean.TRUE.equals(emailOnCommentReply);
            case PROJECT_INVITATION, PROJECT_UPDATED, MEMBER_REMOVED ->
                    Boolean.TRUE.equals(emailOnProjectInvitation);
        };
    }

    // Id-based equality so a detached User compares equal to its managed twin — this entity
    // lives in Project.members, a HashSet. hashCode is deliberately constant per type rather
    // than derived from the id: an entity's id changes on persist, and a changing hashCode
    // would corrupt any set it was already a member of.
    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (other == null || Hibernate.getClass(this) != Hibernate.getClass(other)) return false;
        var that = (User) other;
        return id != null && Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Hibernate.getClass(this).hashCode();
    }
}
