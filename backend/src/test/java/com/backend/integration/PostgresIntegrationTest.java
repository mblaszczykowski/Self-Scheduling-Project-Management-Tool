package com.backend.integration;

import org.junit.jupiter.api.Tag;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Base for tests that need the real schema.
 *
 * <p>PostgreSQL rather than an in-memory database in PostgreSQL mode: the schema depends on
 * {@code timestamptz} handling, enum check constraints and {@code ON DELETE} semantics that H2 does
 * not enforce — and the single most consequential bug in this codebase (deleting any task failed on
 * a foreign key) was invisible precisely because no test touched a real schema.
 *
 * <p>The container is shared across every subclass: {@code static} plus Testcontainers' JVM
 * shutdown hook means one database start per build, not one per test class.
 */
@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
@Tag("integration")
public abstract class PostgresIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    /** Marker for the annotations above, so subclasses only extend the class. */
    @Target(ElementType.TYPE)
    @Retention(RetentionPolicy.RUNTIME)
    @interface Unused {}
}
