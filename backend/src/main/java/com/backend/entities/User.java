package com.backend.entities;

import jakarta.persistence.*;

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
}
