CREATE INDEX IF NOT EXISTS idx_task_activity_author ON task_activities (author_id);
CREATE INDEX IF NOT EXISTS idx_comment_reaction_user ON comment_reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_stored_file_uploader ON stored_files (uploaded_by);
