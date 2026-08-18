package com.backend.repositories;

import com.backend.entities.StoredFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StoredFileRepository extends JpaRepository<StoredFile, Long> {

    Optional<StoredFile> findByStoredName(String storedName);

    List<StoredFile> findByStoredNameIn(Collection<String> storedNames);

    /**
     * Every caller reaches this from an {@code AfterCommit} callback, where the surrounding
     * transaction has already committed — so without its own transaction the modifying query threw
     * {@code InvalidDataAccessApiUsageException}, which the best-effort delete then swallowed. The
     * ownership row survived every file deletion and the ledger drifted from disk immediately.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM StoredFile f WHERE f.storedName IN :storedNames")
    int deleteByStoredNameIn(@Param("storedNames") Collection<String> storedNames);
}
