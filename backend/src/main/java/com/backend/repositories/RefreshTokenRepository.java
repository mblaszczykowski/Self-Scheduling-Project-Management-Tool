package com.backend.repositories;

import com.backend.entities.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.consumedAt = :now WHERE r.tokenHash = :tokenHash AND r.consumedAt IS NULL")
    int markConsumedIfUnconsumed(@Param("tokenHash") String tokenHash, @Param("now") Instant now);

    // Bulk deletes rather than derived deletes: RefreshToken has no children and no cascades,
    // so there is nothing for per-entity removal to do, and the derived form loaded every
    // matching row first. Backed by idx_refresh_token_expiry / idx_refresh_user.
    @Modifying
    @Query("DELETE FROM RefreshToken r WHERE r.expiryDate < :now")
    int deleteExpired(@Param("now") Instant now);

    /** Revokes every session of one user — used on password change and "sign out everywhere". */
    @Modifying
    @Query("DELETE FROM RefreshToken r WHERE r.user.id = :userId")
    int deleteAllForUser(@Param("userId") Integer userId);

    /** Revokes one rotation family: a single device's session, or a leaked chain. */
    @Modifying
    @Query("DELETE FROM RefreshToken r WHERE r.familyId = :familyId")
    int deleteFamily(@Param("familyId") String familyId);
}
