-- Phase 5 schema hardening.
--
-- Three things: (1) every foreign key gets an explicit ON DELETE decision, so deleting a
-- task/project/user works without application choreography; (2) the join and
-- element-collection tables get the primary keys and indexes they never had; (3) email
-- identity becomes case-insensitive at the DB level so it cannot drift again.

-- ---------------------------------------------------------------------------
-- 1. Foreign keys with an explicit ON DELETE action.
--
-- Constraint names differ depending on whether a database was built by Flyway V1 or by
-- Hibernate auto-DDL, so each FK is located by (table, column) in the catalog rather than
-- by name. Any pre-existing single-column FK on that column is dropped first, which also
-- collapses the duplicate refresh_tokens FK that auto-DDL + V2 could leave behind.
CREATE OR REPLACE FUNCTION flowlink_replace_fk(
        p_table text, p_column text, p_ref_table text, p_new_name text, p_action text)
RETURNS void AS $fn$
DECLARE
    v_name text;
BEGIN
    FOR v_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
        WHERE con.contype = 'f'
          AND ns.nspname = current_schema()
          AND rel.relname = p_table
          AND att.attname = p_column
          AND array_length(con.conkey, 1) = 1
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', p_table, v_name);
    END LOOP;

    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I (id) %s',
                   p_table, p_new_name, p_column, p_ref_table, p_action);
END;
$fn$ LANGUAGE plpgsql;

-- Audit rows and notifications are owned records: they die with their parent.
-- Without this, deleting any task fails — every task has a CREATED activity row.
SELECT flowlink_replace_fk('task_activities', 'task_id',   'tasks',    'fk_task_activity_task',   'ON DELETE CASCADE');
SELECT flowlink_replace_fk('task_activities', 'author_id', 'users',    'fk_task_activity_author', 'ON DELETE CASCADE');
SELECT flowlink_replace_fk('notifications',   'user_id',   'users',    'fk_notification_user',    'ON DELETE CASCADE');
SELECT flowlink_replace_fk('refresh_tokens',  'user_id',   'users',    'fk_refresh_token_user',   'ON DELETE CASCADE');

-- Comments and reactions: owned by their task, their author, and their parent comment.
SELECT flowlink_replace_fk('comments',          'task_id',           'tasks',    'fk_comment_task',            'ON DELETE CASCADE');
SELECT flowlink_replace_fk('comments',          'author_id',         'users',    'fk_comment_author',          'ON DELETE CASCADE');
SELECT flowlink_replace_fk('comments',          'parent_comment_id', 'comments', 'fk_comment_parent',          'ON DELETE CASCADE');
SELECT flowlink_replace_fk('comment_reactions', 'comment_id',        'comments', 'fk_comment_reaction_comment', 'ON DELETE CASCADE');
SELECT flowlink_replace_fk('comment_reactions', 'user_id',           'users',    'fk_comment_reaction_user',    'ON DELETE CASCADE');

-- Element collections: rows exist only for their owner.
SELECT flowlink_replace_fk('comment_attachments', 'comment_id', 'comments', 'fk_comment_attachment_comment', 'ON DELETE CASCADE');
SELECT flowlink_replace_fk('task_attachments',    'task_id',    'tasks',    'fk_task_attachment_task',       'ON DELETE CASCADE');
SELECT flowlink_replace_fk('project_attachments', 'project_id', 'projects', 'fk_project_attachment_project', 'ON DELETE CASCADE');

-- Membership: the link dies with either side.
SELECT flowlink_replace_fk('project_members', 'project_id', 'projects', 'fk_project_member_project', 'ON DELETE CASCADE');
SELECT flowlink_replace_fk('project_members', 'user_id',    'users',    'fk_project_member_user',    'ON DELETE CASCADE');

-- Tasks die with their project; an assignee leaving unassigns rather than deletes.
SELECT flowlink_replace_fk('tasks', 'project_id',  'projects', 'fk_task_project',  'ON DELETE CASCADE');
SELECT flowlink_replace_fk('tasks', 'assignee_id', 'users',    'fk_task_assignee', 'ON DELETE SET NULL');

-- A project owner cannot be deleted while they still own projects: fail loudly.
SELECT flowlink_replace_fk('projects', 'owner_id', 'users', 'fk_project_owner', 'ON DELETE RESTRICT');

DROP FUNCTION flowlink_replace_fk(text, text, text, text, text);

-- ---------------------------------------------------------------------------
-- 2. Primary keys and indexes on the join / element-collection tables.
--
-- These were created bare: no PK, no unique constraint, no index. Every project update
-- re-creates the whole project_members collection (clear + addAll), and every cascade
-- delete scanned the child table sequentially.
ALTER TABLE project_members      ADD CONSTRAINT pk_project_members      PRIMARY KEY (project_id, user_id);
ALTER TABLE project_dependencies ADD CONSTRAINT pk_project_dependencies PRIMARY KEY (project_id, dependency_id);
ALTER TABLE task_dependencies    ADD CONSTRAINT pk_task_dependencies    PRIMARY KEY (task_id, dependency_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user     ON project_members (user_id);
CREATE INDEX IF NOT EXISTS idx_project_dep_dependency   ON project_dependencies (dependency_id);
CREATE INDEX IF NOT EXISTS idx_task_dep_dependency      ON task_dependencies (dependency_id);
CREATE INDEX IF NOT EXISTS idx_comment_attachments_c    ON comment_attachments (comment_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_t       ON task_attachments (task_id);
CREATE INDEX IF NOT EXISTS idx_project_attachments_p    ON project_attachments (project_id);

-- The hourly cleanup job filters on expiry_date.
CREATE INDEX IF NOT EXISTS idx_refresh_token_expiry ON refresh_tokens (expiry_date);

-- These three back no repository predicate or sort — pure write amplification.
DROP INDEX IF EXISTS idx_task_status;
DROP INDEX IF EXISTS idx_task_priority;
DROP INDEX IF EXISTS idx_task_due_date;

-- ---------------------------------------------------------------------------
-- 3. Case-insensitive email identity.
--
-- Registration lower-cased but login looked up verbatim, so a user who registered
-- "John@Example.com" could never sign in. Normalising here and enforcing it with a
-- functional unique index means the invariant no longer depends on the entry point.
-- If two accounts differ only by case this UPDATE fails, which is the correct outcome:
-- silently merging two people's accounts would be worse than a failed migration.
UPDATE users SET email = lower(email) WHERE email <> lower(email);
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_email_lower ON users (lower(email));

-- ---------------------------------------------------------------------------
-- 4. Columns the entity model now carries.

-- Projects gained created/updated, so they can be sorted and displayed by age like tasks.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created timestamp(6) with time zone;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated timestamp(6) with time zone;
UPDATE projects SET created = now() WHERE created IS NULL;
UPDATE projects SET updated = now() WHERE updated IS NULL;
ALTER TABLE projects ALTER COLUMN created SET NOT NULL;
ALTER TABLE projects ALTER COLUMN updated SET NOT NULL;

-- User is the last editable aggregate root without optimistic locking, so a concurrent
-- profile save and preferences patch silently clobbered each other.
ALTER TABLE users ADD COLUMN IF NOT EXISTS version bigint;

-- ---------------------------------------------------------------------------
-- 5. New activity type: comment edits were never audited.
DO $$
DECLARE
    v_name text;
BEGIN
    SELECT con.conname INTO v_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE con.contype = 'c' AND rel.relname = 'task_activities'
      AND pg_get_constraintdef(con.oid) LIKE '%CREATED%'
    LIMIT 1;

    IF v_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE task_activities DROP CONSTRAINT %I', v_name);
    END IF;
END $$;

ALTER TABLE task_activities ADD CONSTRAINT ck_task_activity_type CHECK (type IN (
    'CREATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ASSIGNEE_CHANGED', 'PROGRESS_CHANGED',
    'DATES_CHANGED', 'SUMMARY_CHANGED', 'DESCRIPTION_CHANGED', 'LABELS_CHANGED',
    'DEPENDENCIES_CHANGED', 'ATTACHMENTS_CHANGED', 'COMMENT_ADDED', 'COMMENT_EDITED',
    'COMMENT_DELETED'
));
