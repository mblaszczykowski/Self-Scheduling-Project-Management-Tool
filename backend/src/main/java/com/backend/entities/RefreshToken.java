package com.backend.entities;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * One rotation step of one login session.
 *
 * <p>Only the SHA-256 hash of the token value is persisted, so a leaked row cannot be replayed.
 * Rows are kept after being consumed (until they expire) so that presenting the same token twice
 * is detectable as a replay rather than looking like an ordinary expiry.
 */
@Entity
@Table(name = "refresh_tokens",
        uniqueConstraints = @UniqueConstraint(name = "uk_refresh_token_hash", columnNames = "token_hash"),
        indexes = {
                @Index(name = "idx_refresh_user", columnList = "user_id"),
                @Index(name = "idx_refresh_token_family", columnList = "family_id")
        })
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "token_hash", nullable = false, unique = true, updatable = false)
    private String tokenHash;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Shared by every token descended from the same login. */
    @Column(name = "family_id", nullable = false, updatable = false, length = 64)
    private String familyId;

    /** When the login that started this family happened; bounds the absolute session lifetime. */
    @Column(name = "family_started_at", nullable = false, updatable = false)
    private Instant familyStartedAt;

    @Column(name = "expiry_date", nullable = false)
    private Instant expiryDate;

    /** Set when this token is exchanged for a successor. A second presentation is a replay. */
    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected RefreshToken() {
    }

    public RefreshToken(String tokenHash, User user, String familyId,
                        Instant familyStartedAt, Instant expiryDate) {
        this.tokenHash = tokenHash;
        this.user = user;
        this.familyId = familyId;
        this.familyStartedAt = familyStartedAt;
        this.expiryDate = expiryDate;
    }

    public Long getId() { return id; }

    public String getTokenHash() { return tokenHash; }

    public User getUser() { return user; }

    /** Reads the FK without initializing the lazy proxy. */
    public Integer getUserId() { return user != null ? user.getId() : null; }

    public String getFamilyId() { return familyId; }

    public Instant getFamilyStartedAt() { return familyStartedAt; }

    public boolean isConsumed() { return consumedAt != null; }

    public void markConsumed() { this.consumedAt = Instant.now(); }

    public boolean isExpired(Instant now) { return expiryDate.isBefore(now); }
}
