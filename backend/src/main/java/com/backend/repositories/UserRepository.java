package com.backend.repositories;

import com.backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {
    @Query("SELECT u FROM User u WHERE LOWER(u.email) = LOWER(:email)")
    Optional<User> findByEmailIgnoringCase(@Param("email") String email);

    @Query("SELECT COUNT(u) > 0 FROM User u WHERE LOWER(u.email) = LOWER(:email)")
    boolean existsByEmailIgnoringCase(@Param("email") String email);

    @Query("SELECT u FROM User u WHERE LOWER(u.email) IN :lowerCasedEmails")
    List<User> findByEmailInIgnoringCase(@Param("lowerCasedEmails") Collection<String> lowerCasedEmails);
}
