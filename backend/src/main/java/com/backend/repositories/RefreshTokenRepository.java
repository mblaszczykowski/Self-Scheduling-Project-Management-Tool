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

    @Modifying
    @Query("DELETE FROM RefreshToken r WHERE r.expiryDate < :now")
    int deleteExpired(@Param("now") Instant now);

    @Modifying
    @Query("DELETE FROM RefreshToken r WHERE r.user.id = :userId")
    int deleteAllForUser(@Param("userId") Integer userId);

    @Modifying
    @Query("DELETE FROM RefreshToken r WHERE r.familyId = :familyId")
    int deleteFamily(@Param("familyId") String familyId);
}
