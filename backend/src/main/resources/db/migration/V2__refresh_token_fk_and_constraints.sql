-- Phase 4 schema hardening.

-- Redundant: the UNIQUE constraint on refresh_tokens.token already provides a backing index.
DROP INDEX IF EXISTS idx_refresh_token;

-- RefreshToken.user_id becomes a real foreign key to users, cascading on user deletion
-- (previously a bare integer column with no referential integrity).
ALTER TABLE refresh_tokens
    ADD CONSTRAINT fk_refresh_token_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- Task priority is always populated (defaults to MEDIUM); enforce non-null at the DB level.
UPDATE tasks SET priority = 'MEDIUM' WHERE priority IS NULL;
ALTER TABLE tasks ALTER COLUMN priority SET NOT NULL;
