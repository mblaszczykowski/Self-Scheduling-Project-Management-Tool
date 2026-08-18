package com.backend.repositories;

import com.backend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {

    // Email identity is case-insensitive: registration lower-cases on write, and every read
    // goes through LOWER(...) so a user who signed up as "John@Example.com" can log in with
    // any casing. Backed by the uk_users_email_lower functional index (V3).
    @Query("SELECT u FROM User u WHERE LOWER(u.email) = LOWER(:email)")
    Optional<User> findByEmailIgnoringCase(@Param("email") String email);

    @Query("SELECT COUNT(u) > 0 FROM User u WHERE LOWER(u.email) = LOWER(:email)")
    boolean existsByEmailIgnoringCase(@Param("email") String email);

    /** @param lowerCasedEmails must already be lower-cased by the caller. */
    @Query("SELECT u FROM User u WHERE LOWER(u.email) IN :lowerCasedEmails")
    List<User> findByEmailInIgnoringCase(@Param("lowerCasedEmails") Collection<String> lowerCasedEmails);
}
