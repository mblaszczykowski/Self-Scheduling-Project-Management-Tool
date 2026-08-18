UPDATE users SET version = 0 WHERE version IS NULL;

ALTER TABLE users ALTER COLUMN version SET NOT NULL;
