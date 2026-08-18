-- File authorization.
--
-- /files/{uuid} previously authenticated the caller and then discarded the result: any logged-in
-- user who knew (or once saw) a UUID could download any attachment in the system, forever,
-- including after being removed from the project. Security rested entirely on the identifier
-- being unguessable.
--
-- Recording who a stored file belongs to makes an actual authorization check possible, and lets
-- an attachment reference supplied by a client be validated against the project it claims to
-- belong to.

CREATE TABLE stored_files (
    id           bigserial    NOT NULL,
    stored_name  varchar(255) NOT NULL,
    -- NULL means "not scoped to a project": profile pictures, which every authenticated user may
    -- already see through the member views.
    project_id   integer,
    uploaded_by  integer,
    created_at   timestamp(6) with time zone NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_stored_file_name UNIQUE (stored_name),
    CONSTRAINT fk_stored_file_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_stored_file_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_stored_file_project ON stored_files (project_id);

-- Files uploaded before this migration have no recorded owner. They stay readable by any
-- authenticated user (the previous behaviour) rather than becoming unreachable; new uploads are
-- scoped from the start.
