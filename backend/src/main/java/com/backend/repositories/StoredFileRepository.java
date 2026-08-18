package com.backend.repositories;

import com.backend.entities.StoredFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StoredFileRepository extends JpaRepository<StoredFile, Long> {

    Optional<StoredFile> findByStoredName(String storedName);

    List<StoredFile> findByStoredNameIn(Collection<String> storedNames);

    @Modifying
    @Query("DELETE FROM StoredFile f WHERE f.storedName IN :storedNames")
    int deleteByStoredNameIn(@Param("storedNames") Collection<String> storedNames);
}
