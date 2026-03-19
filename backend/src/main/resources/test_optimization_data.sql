-- ============================================================================
-- OPTIMIZATION TEST DATA - FlowLink
-- ============================================================================
-- Creates a project "OPTDEMO" with 12 tasks across 3 developers that has:
-- - Resource conflicts (same person, overlapping dates)
-- - Dependency chains (A -> B -> C)
-- - Diamond dependencies (D depends on B and C)
-- - Mixed priorities (HIGHEST to LOWEST)
-- - Critical path tasks
-- - Mix of assigned and unassigned tasks
--
-- Run: psql -U postgres -d flowlink -f test_optimization_data.sql
-- Can be executed multiple times (increments project key suffix)
-- Delete manually: DELETE FROM projects WHERE project_key LIKE 'OPTDEMO%';
-- ============================================================================

DO $$
DECLARE
    v_user_id INTEGER;
    v_project_id INTEGER;
    v_suffix TEXT;
    v_project_key TEXT;
    v_now TIMESTAMP := NOW();

    -- Task IDs
    t_api_design INTEGER;
    t_api_impl INTEGER;
    t_api_tests INTEGER;
    t_db_schema INTEGER;
    t_db_migrate INTEGER;
    t_fe_layout INTEGER;
    t_fe_forms INTEGER;
    t_fe_integration INTEGER;
    t_code_review INTEGER;
    t_perf_test INTEGER;
    t_docs INTEGER;
    t_deploy INTEGER;
BEGIN
    -- Find user
    SELECT id INTO v_user_id FROM users WHERE email = 'testdev@flowlink.com';
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User testdev@flowlink.com not found. Run: INSERT INTO users (first_name, last_name, email, password) VALUES (''Test'', ''Developer'', ''testdev@flowlink.com'', ''$2b$12$UeCe6BcsKmY624jQCB3U9.x5HHBU7efifRp3mFBw5HIhz5669LJh2'');';
    END IF;

    -- Generate unique suffix so SQL can be run multiple times
    v_suffix := TO_CHAR(NOW(), 'MMDD_HH24MI');
    v_project_key := 'OPT' || TO_CHAR(NOW(), 'MMDDMI');

    -- ========================================================================
    -- CREATE PROJECT
    -- ========================================================================
    INSERT INTO projects (project_key, summary, description, next_task_number, owner_id)
    VALUES (
        v_project_key,
        'Schedule Optimization Demo',
        'Demo project with resource conflicts, dependency chains, and mixed priorities to test the MORCPSP optimizer.',
        13,  -- next_task_number (we insert 12 tasks numbered 1-12)
        v_user_id
    )
    RETURNING id INTO v_project_id;

    -- Add owner as member
    INSERT INTO project_members (project_id, user_id) VALUES (v_project_id, v_user_id);

    -- ========================================================================
    -- CREATE TASKS
    -- ========================================================================
    -- Developer allocation:
    --   ***REMOVED-EMAIL*** = "lead dev" - gets 6 tasks (creates conflicts!)
    --   2 tasks unassigned (no resource constraint)
    --   Sprint: starts today, 4 weeks
    -- ========================================================================

    -- TASK 1: API Design (lead dev, HIGH, 5 days)
    -- No dependencies - starting point
    INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (1, 'Design REST API endpoints', 'Define OpenAPI spec for all optimization endpoints', 'IN_PROGRESS',
            CURRENT_DATE, CURRENT_DATE + 4, 20, v_user_id, v_project_id, 'HIGH', v_now, v_now)
    RETURNING id INTO t_api_design;

    -- TASK 2: API Implementation (lead dev, HIGHEST, 7 days) - CONFLICTS with task 1!
    -- Depends on: API Design
    INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (2, 'Implement optimization endpoints', 'Build /simulate and /apply REST controllers + service layer', 'TODO',
            CURRENT_DATE + 2, CURRENT_DATE + 8, 0, v_user_id, v_project_id, 'HIGHEST', v_now, v_now)
    RETURNING id INTO t_api_impl;

    -- TASK 3: API Tests (lead dev, MEDIUM, 3 days) - CONFLICTS with task 2!
    -- Depends on: API Implementation
    INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (3, 'Write API integration tests', 'JUnit tests for optimization controller and service', 'TODO',
            CURRENT_DATE + 6, CURRENT_DATE + 8, 0, v_user_id, v_project_id, 'MEDIUM', v_now, v_now)
    RETURNING id INTO t_api_tests;

    -- TASK 4: Database Schema (lead dev, HIGH, 4 days) - CONFLICTS with task 1!
    -- No dependencies - parallel track
    INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (4, 'Design database schema changes', 'Add optimization_runs table, indexes for scheduling queries', 'TODO',
            CURRENT_DATE + 1, CURRENT_DATE + 4, 0, v_user_id, v_project_id, 'HIGH', v_now, v_now)
    RETURNING id INTO t_db_schema;

    -- TASK 5: DB Migration (lead dev, MEDIUM, 2 days)
    -- Depends on: Database Schema
    INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (5, 'Run database migrations', 'Execute Flyway migrations on staging and production', 'BACKLOG',
            CURRENT_DATE + 4, CURRENT_DATE + 5, 0, v_user_id, v_project_id, 'MEDIUM', v_now, v_now)
    RETURNING id INTO t_db_migrate;

    -- TASK 6: Frontend Layout (unassigned, HIGH, 5 days)
    -- No dependencies - can run in parallel (no resource constraint since unassigned)
    INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (6, 'Build optimization panel UI', 'Create dark-theme metrics panel with animated ghost bars', 'TODO',
            CURRENT_DATE, CURRENT_DATE + 4, 0, NULL, v_project_id, 'HIGH', v_now, v_now)
    RETURNING id INTO t_fe_layout;

    -- TASK 7: Frontend Forms (unassigned, MEDIUM, 4 days)
    -- Depends on: Frontend Layout
    INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (7, 'Implement optimization settings form', 'Alpha/beta weight sliders, project selector, horizon date picker', 'BACKLOG',
            CURRENT_DATE + 3, CURRENT_DATE + 6, 0, NULL, v_project_id, 'MEDIUM', v_now, v_now)
    RETURNING id INTO t_fe_forms;

    -- TASK 8: Frontend Integration (lead dev, HIGH, 3 days) - CONFLICTS with other lead dev tasks!
    -- Depends on: API Implementation AND Frontend Forms (diamond!)
    INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (8, 'Connect frontend to optimization API', 'Wire up API calls, handle loading/error states, toast notifications', 'BACKLOG',
            CURRENT_DATE + 7, CURRENT_DATE + 9, 0, v_user_id, v_project_id, 'HIGH', v_now, v_now)
    RETURNING id INTO t_fe_integration;

    -- TASK 9: Code Review (lead dev, LOW, 2 days) - CONFLICTS with lead dev tasks!
    -- Depends on: API Tests AND Frontend Integration (diamond!)
    INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (9, 'Code review all optimization PRs', 'Review all PRs, check edge cases, verify test coverage', 'BACKLOG',
            CURRENT_DATE + 9, CURRENT_DATE + 10, 0, v_user_id, v_project_id, 'LOW', v_now, v_now)
    RETURNING id INTO t_code_review;

    -- TASK 10: Performance Testing (lead dev, HIGHEST, 3 days)
    -- Depends on: Code Review
    INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (10, 'Performance test with 100+ tasks', 'Load test SSGS solver with large portfolios, measure response times', 'BACKLOG',
            CURRENT_DATE + 10, CURRENT_DATE + 12, 0, v_user_id, v_project_id, 'HIGHEST', v_now, v_now)
    RETURNING id INTO t_perf_test;

    -- TASK 11: Documentation (unassigned, LOWEST, 3 days)
    -- Depends on: API Implementation
    INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (11, 'Write API documentation', 'Document all optimization endpoints in Swagger/OpenAPI', 'BACKLOG',
            CURRENT_DATE + 8, CURRENT_DATE + 10, 0, NULL, v_project_id, 'LOWEST', v_now, v_now)
    RETURNING id INTO t_docs;

    -- TASK 12: Deploy to Staging (lead dev, HIGH, 1 day)
    -- Depends on: Performance Testing AND Documentation
    INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, assignee_id, project_id, priority, created, updated)
    VALUES (12, 'Deploy optimization to staging', 'Deploy full optimization feature to staging environment', 'BACKLOG',
            CURRENT_DATE + 12, CURRENT_DATE + 12, 0, v_user_id, v_project_id, 'HIGH', v_now, v_now)
    RETURNING id INTO t_deploy;

    -- ========================================================================
    -- CREATE DEPENDENCIES
    -- ========================================================================
    -- Dependency chain: API Design -> API Impl -> API Tests
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t_api_impl, t_api_design);
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t_api_tests, t_api_impl);

    -- Dependency chain: DB Schema -> DB Migration
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t_db_migrate, t_db_schema);

    -- Dependency chain: FE Layout -> FE Forms
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t_fe_forms, t_fe_layout);

    -- Diamond: FE Integration depends on API Impl AND FE Forms
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t_fe_integration, t_api_impl);
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t_fe_integration, t_fe_forms);

    -- Diamond: Code Review depends on API Tests AND FE Integration
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t_code_review, t_api_tests);
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t_code_review, t_fe_integration);

    -- Chain: Code Review -> Perf Test
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t_perf_test, t_code_review);

    -- Docs depends on API Impl
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t_docs, t_api_impl);

    -- Deploy depends on Perf Test AND Docs
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t_deploy, t_perf_test);
    INSERT INTO task_dependencies (task_id, dependency_id) VALUES (t_deploy, t_docs);

    -- ========================================================================
    -- SUMMARY
    -- ========================================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created project: % (ID: %)', v_project_key, v_project_id;
    RAISE NOTICE '12 tasks created with:';
    RAISE NOTICE '  - 8 tasks assigned to ***REMOVED-EMAIL*** (creates resource conflicts)';
    RAISE NOTICE '  - 3 tasks unassigned (no resource constraint)';
    RAISE NOTICE '  - 12 dependency edges (chains + diamonds)';
    RAISE NOTICE '  - Multiple overlapping date ranges on same assignee';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Resource conflicts on ***REMOVED-EMAIL***:';
    RAISE NOTICE '  Tasks 1,2,4 overlap on days 2-4 (3 tasks same person!)';
    RAISE NOTICE '  Tasks 2,3 overlap on days 6-8';
    RAISE NOTICE '  Tasks 8,9 overlap with preceding tasks';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'To delete: DELETE FROM projects WHERE project_key = ''%'';', v_project_key;
    RAISE NOTICE '========================================';

END $$;
