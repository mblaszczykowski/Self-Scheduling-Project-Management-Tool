package com.backend.entities;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "stored_files",
        uniqueConstraints = @UniqueConstraint(name = "uk_stored_file_name", columnNames = "stored_name"),
        indexes = {
                @Index(name = "idx_stored_file_project", columnList = "project_id"),
                @Index(name = "idx_stored_file_uploader", columnList = "uploaded_by")
        })
public class StoredFile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "stored_name", nullable = false, unique = true, updatable = false)
    private String storedName;

    @Column(name = "project_id")
    private Integer projectId;

    @Column(name = "uploaded_by")
    private Integer uploadedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected StoredFile() {
    }

    public StoredFile(String storedName, Integer projectId, Integer uploadedBy) {
        this.storedName = storedName;
        this.projectId = projectId;
        this.uploadedBy = uploadedBy;
    }

    public String getStoredName() { return storedName; }

    public Integer getProjectId() { return projectId; }
}
