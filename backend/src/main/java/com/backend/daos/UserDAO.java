package com.backend.daos;

import com.backend.entities.User;
import com.backend.repositories.UserRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class UserDAO {
    private final UserRepository userRepository;

    public UserDAO(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User save(User user) {
        return userRepository.save(user);
    }

    public Optional<User> getUserById(Integer id) {
        return userRepository.findById(id);
    }

    public Optional<User> getUserByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public boolean existsUserWithEmail(String email) {
        return userRepository.existsByEmail(email);
    }

    /**
     * Batch load users by email addresses.
     * Returns a map of email -> User for efficient lookup.
     */
    public Map<String, User> findByEmailsAsMap(Collection<String> emails) {
        if (emails == null || emails.isEmpty()) {
            return Map.of();
        }
        return userRepository.findByEmailIn(emails).stream()
                .collect(Collectors.toMap(User::getEmail, user -> user));
    }
}