package com.backend.services;

import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Serializes edge additions so concurrent edits cannot each validate an obsolete DAG. */
@Component
public class DependencyGraphLock {
    private final JdbcTemplate jdbcTemplate;

    public DependencyGraphLock(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void tasks() {
        acquire(1179407180L);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void projects() {
        acquire(1179407181L);
    }

    private void acquire(long key) {
        jdbcTemplate.execute((ConnectionCallback<Void>) connection -> {
            try (var statement = connection.prepareStatement("SELECT pg_advisory_xact_lock(?)")) {
                statement.setLong(1, key);
                statement.execute();
            }
            return null;
        });
    }
}
