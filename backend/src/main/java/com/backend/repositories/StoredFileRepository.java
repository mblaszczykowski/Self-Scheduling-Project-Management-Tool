package com.backend.repositories;

import com.backend.entities.StoredFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface StoredFileRepository extends JpaRepository<StoredFile, Long> {
    Optional<StoredFile> findByStoredName(String storedName);

    @Query(value = "SELECT attachment_url FROM project_attachments "
            + "UNION SELECT attachment_url FROM task_attachments "
            + "UNION SELECT attachment_url FROM comment_attachments "
            + "UNION SELECT profile_picture FROM users WHERE profile_picture IS NOT NULL", nativeQuery = true)
    Set<String> findAllReferencedUrls();

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("SELECT f FROM StoredFile f WHERE f.storedName IN :storedNames")
    List<StoredFile> findByStoredNameIn(@Param("storedNames") Collection<String> storedNames);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT f FROM StoredFile f WHERE f.storedName = :storedName")
    Optional<StoredFile> findByStoredNameForUpdate(@Param("storedName") String storedName);

    @Query(value = "SELECT EXISTS (SELECT 1 FROM project_attachments WHERE attachment_url = :url) "
            + "OR EXISTS (SELECT 1 FROM task_attachments WHERE attachment_url = :url) "
            + "OR EXISTS (SELECT 1 FROM comment_attachments WHERE attachment_url = :url) "
            + "OR EXISTS (SELECT 1 FROM users WHERE profile_picture = :url)", nativeQuery = true)
    @Transactional(readOnly = true)
    boolean isReferenced(@Param("url") String url);

    @Modifying
    @Transactional
    @Query("DELETE FROM StoredFile f WHERE f.storedName IN :storedNames")
    int deleteByStoredNameIn(@Param("storedNames") Collection<String> storedNames);
}
