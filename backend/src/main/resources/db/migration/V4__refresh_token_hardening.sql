-- Refresh tokens: hashed at rest, grouped into rotation families, with replay detection.
--
-- The token value is a bearer credential. Stored verbatim, any backup leak or read-replica
-- exposure handed an attacker every active session for the full 7-day lifetime. Only a hash
-- is kept now, so a leaked row cannot be replayed.
--
-- Rotation previously deleted the presented row, which made a stolen-token replay
-- indistinguishable from an expired one. Consumed rows are now retained until expiry, so a
-- second presentation is detectable and revokes the whole family.

-- Existing rows hold plaintext values that cannot be converted into the new scheme in a way
-- the application would accept, so they are dropped. The one-time cost is that everyone signs
-- in again after deploy.
DELETE FROM refresh_tokens;

ALTER TABLE refresh_tokens RENAME COLUMN token TO token_hash;

-- The old unique index/constraint follows the renamed column, but its name no longer describes
-- it. Recreate under a name that does.
DO $$
DECLARE
    v_name text;
BEGIN
    FOR v_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE con.contype = 'u' AND rel.relname = 'refresh_tokens'
    LOOP
        EXECUTE format('ALTER TABLE refresh_tokens DROP CONSTRAINT %I', v_name);
    END LOOP;
END $$;

ALTER TABLE refresh_tokens
    ADD CONSTRAINT uk_refresh_token_hash UNIQUE (token_hash);

-- All tokens descended from one login share a family id; family_started_at is copied forward
-- on every rotation so the absolute session lifetime can be enforced.
ALTER TABLE refresh_tokens ADD COLUMN family_id varchar(64);
ALTER TABLE refresh_tokens ADD COLUMN family_started_at timestamp(6) with time zone;
ALTER TABLE refresh_tokens ADD COLUMN consumed_at timestamp(6) with time zone;

UPDATE refresh_tokens SET family_id = gen_random_uuid()::text WHERE family_id IS NULL;
UPDATE refresh_tokens SET family_started_at = created_at WHERE family_started_at IS NULL;

ALTER TABLE refresh_tokens ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE refresh_tokens ALTER COLUMN family_started_at SET NOT NULL;

CREATE INDEX idx_refresh_token_family ON refresh_tokens (family_id);
