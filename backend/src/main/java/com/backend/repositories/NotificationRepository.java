package com.backend.repositories;

import com.backend.entities.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;

public interface NotificationRepository extends JpaRepository<Notification, Integer> {

    // Ordered by id as well as timestamp: notifications created in one request (the member
    // fan-out loop) share a microsecond, and an unstable sort makes paged reads duplicate
    // one row and drop another.
    Page<Notification> findByUserIdOrderByTimestampDescIdDesc(Integer userId, Pageable pageable);

    long countByUserIdAndIsReadFalse(Integer userId);

    /** Flips the flag in one statement and scopes ownership in SQL rather than in Java. */
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.id IN :ids AND n.user.id = :userId")
    int markReadForUser(@Param("ids") Collection<Integer> ids, @Param("userId") Integer userId);

    /** Flips every unread notification for the user, for the "mark all read" bulk action. */
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId AND n.isRead = false")
    int markAllReadForUser(@Param("userId") Integer userId);

    @Query("SELECT COUNT(n) FROM Notification n WHERE n.id IN :ids AND n.user.id = :userId")
    long countOwnedBy(@Param("ids") Collection<Integer> ids, @Param("userId") Integer userId);
}
