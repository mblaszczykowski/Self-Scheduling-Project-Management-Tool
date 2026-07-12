-- ============================================================================
-- SCENARIO 1: "Sprint Crunch" — 1 dev overloaded with 6 overlapping tasks
-- Expected: optimizer serializes tasks, HIGHEST tasks stay near original dates
-- ============================================================================
DO $$
DECLARE
    v_uid INTEGER;
    v_pid INTEGER;
    v_key TEXT := 'SC1' || TO_CHAR(NOW(), 'DDMI');
    v_now TIMESTAMP := NOW();
    t1 INT; t2 INT; t3 INT; t4 INT; t5 INT; t6 INT;
BEGIN
    SELECT id INTO v_uid FROM users WHERE email = 'testdev@flowlink.com';
    IF v_uid IS NULL THEN RAISE EXCEPTION 'User testdev@flowlink.com not found'; END IF;

    INSERT INTO projects (project_key, summary, description, next_task_number, owner_id)
    VALUES (v_key, 'Sprint Crunch — Single Dev Overload', '1 developer, 6 tasks, all same week. Heavy resource conflict.', 7, v_uid)
    RETURNING id INTO v_pid;
    INSERT INTO project_members (project_id, user_id) VALUES (v_pid, v_uid);

    -- All 6 tasks assigned to same person, same week, overlapping
    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (1, 'Fix critical auth bug', 'IN_PROGRESS', CURRENT_DATE, CURRENT_DATE + 2, 10, v_uid, v_pid, 'HIGHEST', v_now, v_now) RETURNING id INTO t1;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (2, 'Deploy hotfix to production', 'TODO', CURRENT_DATE + 1, CURRENT_DATE + 1, 0, v_uid, v_pid, 'HIGHEST', v_now, v_now) RETURNING id INTO t2;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (3, 'Write migration script', 'TODO', CURRENT_DATE, CURRENT_DATE + 3, 0, v_uid, v_pid, 'HIGH', v_now, v_now) RETURNING id INTO t3;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (4, 'Update API documentation', 'BACKLOG', CURRENT_DATE, CURRENT_DATE + 4, 0, v_uid, v_pid, 'LOW', v_now, v_now) RETURNING id INTO t4;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (5, 'Refactor user service', 'BACKLOG', CURRENT_DATE + 1, CURRENT_DATE + 4, 0, v_uid, v_pid, 'MEDIUM', v_now, v_now) RETURNING id INTO t5;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (6, 'Add unit tests for auth', 'TODO', CURRENT_DATE + 1, CURRENT_DATE + 3, 0, v_uid, v_pid, 'MEDIUM', v_now, v_now) RETURNING id INTO t6;

    -- Dependencies: deploy depends on fix, tests depend on fix
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t2, t1);
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t6, t1);

    RAISE NOTICE 'Created project % — 6 tasks on 1 dev, 5 conflicts expected', v_key;
    RAISE NOTICE 'Delete: DELETE FROM projects WHERE project_key = ''%'';', v_key;
END $$;


-- ============================================================================
-- SCENARIO 2: "Two-Team Handoff" — 2 devs, dependency chain between teams
-- Expected: optimizer respects cross-person dependencies, no unnecessary delays
-- ============================================================================
DO $$
DECLARE
    v_uid INTEGER;
    v_pid INTEGER;
    v_key TEXT := 'SC2' || TO_CHAR(NOW(), 'DDMI');
    v_now TIMESTAMP := NOW();
    t1 INT; t2 INT; t3 INT; t4 INT; t5 INT; t6 INT; t7 INT; t8 INT;
BEGIN
    SELECT id INTO v_uid FROM users WHERE email = 'testdev@flowlink.com';
    IF v_uid IS NULL THEN RAISE EXCEPTION 'User testdev@flowlink.com not found'; END IF;

    INSERT INTO projects (project_key, summary, description, next_task_number, owner_id)
    VALUES (v_key, 'Two-Team Handoff', 'Backend dev and frontend dev with handoff dependencies. Tests cross-person precedence.', 9, v_uid)
    RETURNING id INTO v_pid;
    INSERT INTO project_members (project_id, user_id) VALUES (v_pid, v_uid);

    -- Backend tasks (assigned to testdev)
    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (1, 'Backend: Design API schema', 'TODO', CURRENT_DATE, CURRENT_DATE + 2, 0, v_uid, v_pid, 'HIGH', v_now, v_now) RETURNING id INTO t1;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (2, 'Backend: Implement endpoints', 'TODO', CURRENT_DATE + 1, CURRENT_DATE + 5, 0, v_uid, v_pid, 'HIGHEST', v_now, v_now) RETURNING id INTO t2;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (3, 'Backend: Write tests', 'BACKLOG', CURRENT_DATE + 3, CURRENT_DATE + 5, 0, v_uid, v_pid, 'MEDIUM', v_now, v_now) RETURNING id INTO t3;

    -- Frontend tasks (unassigned — simulates different dev)
    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (4, 'Frontend: Setup project', 'TODO', CURRENT_DATE, CURRENT_DATE + 1, 0, NULL, v_pid, 'HIGH', v_now, v_now) RETURNING id INTO t4;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (5, 'Frontend: Build components', 'BACKLOG', CURRENT_DATE + 1, CURRENT_DATE + 4, 0, NULL, v_pid, 'HIGH', v_now, v_now) RETURNING id INTO t5;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (6, 'Frontend: Integrate with API', 'BACKLOG', CURRENT_DATE + 4, CURRENT_DATE + 7, 0, NULL, v_pid, 'HIGHEST', v_now, v_now) RETURNING id INTO t6;

    -- Integration tasks (testdev again — creates conflict with backend tasks)
    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (7, 'Integration testing', 'BACKLOG', CURRENT_DATE + 5, CURRENT_DATE + 7, 0, v_uid, v_pid, 'HIGH', v_now, v_now) RETURNING id INTO t7;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (8, 'Deploy to staging', 'BACKLOG', CURRENT_DATE + 7, CURRENT_DATE + 8, 0, v_uid, v_pid, 'MEDIUM', v_now, v_now) RETURNING id INTO t8;

    -- Dependencies: Backend chain
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t2, t1);
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t3, t2);
    -- Frontend chain
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t5, t4);
    -- Cross-team: FE integration depends on Backend endpoints AND FE components
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t6, t2);
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t6, t5);
    -- Integration depends on backend tests AND FE integration
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t7, t3);
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t7, t6);
    -- Deploy depends on integration
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t8, t7);

    RAISE NOTICE 'Created project % — 8 tasks, 2 teams, cross-team deps', v_key;
    RAISE NOTICE 'Delete: DELETE FROM projects WHERE project_key = ''%'';', v_key;
END $$;


-- ============================================================================
-- SCENARIO 3: "No Conflicts" — well-planned project, should optimize minimally
-- Expected: optimizer returns few/no shifts, original schedule is already good
-- ============================================================================
DO $$
DECLARE
    v_uid INTEGER;
    v_pid INTEGER;
    v_key TEXT := 'SC3' || TO_CHAR(NOW(), 'DDMI');
    v_now TIMESTAMP := NOW();
    t1 INT; t2 INT; t3 INT; t4 INT; t5 INT;
BEGIN
    SELECT id INTO v_uid FROM users WHERE email = 'testdev@flowlink.com';
    IF v_uid IS NULL THEN RAISE EXCEPTION 'User testdev@flowlink.com not found'; END IF;

    INSERT INTO projects (project_key, summary, description, next_task_number, owner_id)
    VALUES (v_key, 'Well-Planned Sprint — No Conflicts', 'Tasks already properly sequenced. Optimizer should confirm schedule is good.', 6, v_uid)
    RETURNING id INTO v_pid;
    INSERT INTO project_members (project_id, user_id) VALUES (v_pid, v_uid);

    -- Tasks properly sequenced — no overlap on testdev
    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (1, 'Sprint planning', 'DONE', CURRENT_DATE - 2, CURRENT_DATE - 1, 100, v_uid, v_pid, 'HIGH', v_now, v_now) RETURNING id INTO t1;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (2, 'Implement feature A', 'IN_PROGRESS', CURRENT_DATE, CURRENT_DATE + 3, 50, v_uid, v_pid, 'HIGHEST', v_now, v_now) RETURNING id INTO t2;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (3, 'Implement feature B', 'TODO', CURRENT_DATE + 4, CURRENT_DATE + 7, 0, v_uid, v_pid, 'HIGH', v_now, v_now) RETURNING id INTO t3;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (4, 'Code review', 'BACKLOG', CURRENT_DATE + 8, CURRENT_DATE + 9, 0, v_uid, v_pid, 'MEDIUM', v_now, v_now) RETURNING id INTO t4;

    INSERT INTO tasks (task_number, summary, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (5, 'Deploy to production', 'BACKLOG', CURRENT_DATE + 10, CURRENT_DATE + 10, 0, v_uid, v_pid, 'HIGH', v_now, v_now) RETURNING id INTO t5;

    -- Dependencies: sequential chain
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t2, t1);
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t3, t2);
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t4, t3);
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t5, t4);

    RAISE NOTICE 'Created project % — 5 tasks, no conflicts, sequential', v_key;
    RAISE NOTICE 'Delete: DELETE FROM projects WHERE project_key = ''%'';', v_key;
END $$;


DELETE FROM task_dependencies WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE
    project_key LIKE 'SC1%' OR project_key LIKE 'SC2%' OR project_key LIKE 'SC3%' OR project_key LIKE 'OPT%'));
DELETE FROM task_dependencies WHERE dependency_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects
                                                                                                WHERE project_key LIKE 'SC1%' OR project_key LIKE 'SC2%' OR project_key LIKE 'SC3%' OR project_key LIKE 'OPT%'));
DELETE FROM comment_reactions WHERE comment_id IN (SELECT c.id FROM comments c JOIN tasks t ON c.task_id = t.id WHERE
    t.project_id IN (SELECT id FROM projects WHERE project_key LIKE 'SC1%' OR project_key LIKE 'SC2%' OR project_key LIKE
                                                                                                         'SC3%' OR project_key LIKE 'OPT%'));
DELETE FROM comments WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE project_key
    LIKE 'SC1%' OR project_key LIKE 'SC2%' OR project_key LIKE 'SC3%' OR project_key LIKE 'OPT%'));
DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE
    project_key LIKE 'SC1%' OR project_key LIKE 'SC2%' OR project_key LIKE 'SC3%' OR project_key LIKE 'OPT%'));
DELETE FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE project_key LIKE 'SC1%' OR project_key LIKE 'SC2%' OR
    project_key LIKE 'SC3%' OR project_key LIKE 'OPT%');
DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE project_key LIKE 'SC1%' OR project_key LIKE
                                                                                                          'SC2%' OR project_key LIKE 'SC3%' OR project_key LIKE 'OPT%');
DELETE FROM project_attachments WHERE project_id IN (SELECT id FROM projects WHERE project_key LIKE 'SC1%' OR project_key
    LIKE 'SC2%' OR project_key LIKE 'SC3%' OR project_key LIKE 'OPT%');
DELETE FROM project_dependencies WHERE project_id IN (SELECT id FROM projects WHERE project_key LIKE 'SC1%' OR project_key
    LIKE 'SC2%' OR project_key LIKE 'SC3%' OR project_key LIKE 'OPT%');
DELETE FROM projects WHERE project_key LIKE 'SC1%' OR project_key LIKE 'SC2%' OR project_key LIKE 'SC3%' OR project_key
    LIKE 'OPT%';
