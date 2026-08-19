-- V5 recorded upload ownership going forward and never backfilled what already existed, so files
-- predating it have no stored_files row. Two behaviours now depend on that row: a row-less file is
-- refused rather than served, and the unreferenced-upload sweep deletes it. Without this backfill
-- an older deployment would lose its legacy attachments and be unable to edit the tasks holding
-- them. Every referenced file is recoverable because the owning project is reachable from each
-- attachment table; a profile picture is deliberately unscoped, matching how V5 treats them.

INSERT INTO stored_files (stored_name, project_id, uploaded_by, created_at)
SELECT DISTINCT ON (stored_name) stored_name, project_id, NULL, now()
FROM (
    SELECT regexp_replace(ta.attachment_url, '^/files/', '') AS stored_name,
           t.project_id                                      AS project_id
    FROM task_attachments ta
    JOIN tasks t ON t.id = ta.task_id
    WHERE ta.attachment_url IS NOT NULL

    UNION ALL

    SELECT regexp_replace(pa.attachment_url, '^/files/', ''), pa.project_id
    FROM project_attachments pa
    WHERE pa.attachment_url IS NOT NULL

    UNION ALL

    SELECT regexp_replace(ca.attachment_url, '^/files/', ''), t.project_id
    FROM comment_attachments ca
    JOIN comments c ON c.id = ca.comment_id
    JOIN tasks t ON t.id = c.task_id
    WHERE ca.attachment_url IS NOT NULL

    UNION ALL

    SELECT regexp_replace(u.profile_picture, '^/files/', ''), NULL
    FROM users u
    WHERE u.profile_picture IS NOT NULL AND u.profile_picture <> ''
) AS referenced
WHERE stored_name <> ''
  AND NOT EXISTS (SELECT 1 FROM stored_files sf WHERE sf.stored_name = referenced.stored_name);
