package com.backend.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Transactional
class DemoSeedIntegrationTest extends PostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;

    private String seed() throws Exception {
        // Let Spring's test transaction roll back the fixture, including identity sequences.
        return Files.readString(Path.of("scripts", "db", "demo-seed.sql"))
                .replaceFirst("^BEGIN;", "")
                .replaceFirst("COMMIT;\\s*$", "");
    }

    @Test
    void seedCanBeAppliedTwiceAgainstTheMigratedSchema() throws Exception {
        jdbc.execute(seed());
        jdbc.execute(seed());

        assertThat(jdbc.queryForObject("select count(*) from users", Integer.class)).isEqualTo(4);
        assertThat(jdbc.queryForObject("select count(*) from projects", Integer.class)).isEqualTo(3);
        assertThat(jdbc.queryForObject("select count(*) from tasks", Integer.class)).isEqualTo(45);
        assertThat(jdbc.queryForObject("select count(*) from comments", Integer.class)).isEqualTo(5);
        assertThat(jdbc.queryForObject("select count(*) from notifications", Integer.class)).isEqualTo(6);
    }

    @Test
    void seedRefusesARealAccountBeforeResettingAnyData() throws Exception {
        jdbc.execute(seed());
        jdbc.update("""
                insert into users(first_name, last_name, email, password, version)
                values ('Real', 'User', 'real@example.com', 'unused-test-hash', 0)
                """);
        String script = seed();
        jdbc.execute((ConnectionCallback<Void>) connection -> {
            var point = connection.setSavepoint();
            try (var statement = connection.createStatement()) {
                assertThatThrownBy(() -> statement.execute(script))
                        .hasMessageContaining("dedicated database");
            } finally {
                connection.rollback(point);
                connection.releaseSavepoint(point);
            }
            return null;
        });
        assertThat(jdbc.queryForObject("select count(*) from users", Integer.class)).isEqualTo(5);
        assertThat(jdbc.queryForObject("select count(*) from tasks", Integer.class)).isEqualTo(45);
    }
}
