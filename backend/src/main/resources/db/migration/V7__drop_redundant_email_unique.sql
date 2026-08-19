-- Drop the redundant case-sensitive email unique constraint from V1.
--
-- V3 added uk_users_email_lower, a unique index on lower(email), and every repository read path
-- looks up by that lowercased form. A duplicate under the case-insensitive index would already
-- be a duplicate under the case-sensitive one, so the V1 constraint can no longer reject
-- anything the V3 index would not have rejected first — it now only costs an extra index to
-- maintain on every insert and update.
--
-- Guarded so this is safe to run on a database where the constraint is already absent.
ALTER TABLE users DROP CONSTRAINT IF EXISTS user_email_unique;
