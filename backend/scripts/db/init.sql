-- FlowLink Database Seed Data
-- This script populates the database with realistic data to showcase all features

-- ============================================
-- USERS
-- ============================================
-- Password for all users is: password123 (BCrypt encoded)
INSERT INTO users (firstname, lastname, email, password, profile_picture) VALUES
    ('John', 'Doe', 'john.doe@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.c8H/ebTmAFPAQDW7Aq', NULL),
    ('Jane', 'Smith', 'jane.smith@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.c8H/ebTmAFPAQDW7Aq', NULL),
    ('Mike', 'Johnson', 'mike.johnson@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.c8H/ebTmAFPAQDW7Aq', NULL),
    ('Sarah', 'Williams', 'sarah.williams@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.c8H/ebTmAFPAQDW7Aq', NULL),
    ('Alex', 'Brown', 'alex.brown@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.c8H/ebTmAFPAQDW7Aq', NULL);

-- ============================================
-- PROJECTS
-- ============================================
INSERT INTO projects (project_key, summary, description, next_task_number, owner_id) VALUES
    ('FLOW', 'FlowLink Platform', 'Main FlowLink project management platform development. This project encompasses all core features including task management, notifications, and collaboration tools.', 15, 1),
    ('MOBILE', 'Mobile App Development', 'Native mobile application for iOS and Android platforms. Includes offline support and push notifications.', 8, 1),
    ('API', 'API Gateway Service', 'Centralized API gateway for microservices architecture. Handles authentication, rate limiting, and request routing.', 6, 2),
    ('DOCS', 'Documentation Portal', 'Company-wide documentation system with markdown support and version control integration.', 4, 1);

-- ============================================
-- PROJECT MEMBERS (Many-to-Many)
-- ============================================
-- FLOW project members
INSERT INTO project_members (project_id, user_id) VALUES
    (1, 1), (1, 2), (1, 3), (1, 4), (1, 5);

-- MOBILE project members
INSERT INTO project_members (project_id, user_id) VALUES
    (2, 1), (2, 3), (2, 5);

-- API project members
INSERT INTO project_members (project_id, user_id) VALUES
    (3, 2), (3, 4), (3, 1);

-- DOCS project members
INSERT INTO project_members (project_id, user_id) VALUES
    (4, 1), (4, 2);

-- ============================================
-- TASKS FOR FLOW PROJECT
-- ============================================
INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, priority, labels, is_critical, created, updated, assignee_id, project_id) VALUES
    -- Completed tasks
    (1, 'Set up project repository', 'Initialize Git repository with proper branching strategy and CI/CD pipeline configuration.', 'DONE', '2025-01-01', '2025-01-05', 100, 'HIGH', 'setup,infrastructure', false, NOW() - INTERVAL '30 days', NOW() - INTERVAL '25 days', 1, 1),
    (2, 'Design database schema', 'Create comprehensive database schema for users, projects, tasks, and notifications.', 'DONE', '2025-01-03', '2025-01-10', 100, 'HIGHEST', 'database,design', true, NOW() - INTERVAL '28 days', NOW() - INTERVAL '20 days', 2, 1),
    (3, 'Implement user authentication', 'JWT-based authentication with refresh tokens and secure password hashing.', 'DONE', '2025-01-08', '2025-01-15', 100, 'HIGHEST', 'auth,security', true, NOW() - INTERVAL '25 days', NOW() - INTERVAL '15 days', 1, 1),

    -- In Progress tasks
    (4, 'Build dashboard UI', 'Create responsive dashboard with project cards, statistics, and quick actions.', 'IN_PROGRESS', '2025-01-20', '2025-02-05', 75, 'HIGH', 'frontend,ui', false, NOW() - INTERVAL '15 days', NOW() - INTERVAL '1 day', 3, 1),
    (5, 'Implement notification system', 'Real-time notifications for task assignments, comments, and project updates.', 'IN_PROGRESS', '2025-01-22', '2025-02-03', 60, 'HIGH', 'backend,notifications', true, NOW() - INTERVAL '12 days', NOW(), 4, 1),
    (6, 'Create timeline view', 'Gantt chart style timeline with drag-and-drop task scheduling and dependency visualization.', 'IN_PROGRESS', '2025-01-25', '2025-02-10', 40, 'MEDIUM', 'frontend,timeline', false, NOW() - INTERVAL '10 days', NOW(), 1, 1),

    -- To Do / Upcoming tasks
    (7, 'Add file attachment support', 'Allow users to attach files to tasks and comments with preview functionality.', 'TODO', '2025-02-01', '2025-02-15', 0, 'MEDIUM', 'feature,files', false, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', 2, 1),
    (8, 'Implement task dependencies', 'Visual dependency management with critical path calculation.', 'TODO', '2025-02-05', '2025-02-20', 0, 'HIGH', 'feature,dependencies', true, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 1, 1),
    (9, 'Build reporting module', 'Generate PDF/Excel reports for project progress and team performance.', 'BACKLOG', '2025-02-15', '2025-03-01', 0, 'LOW', 'feature,reports', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NULL, 1),

    -- Delayed tasks (due date in the past, not completed)
    (10, 'Fix login page responsiveness', 'Login form breaks on mobile devices smaller than 375px width.', 'IN_PROGRESS', '2025-01-10', '2025-01-25', 30, 'HIGH', 'bug,frontend,mobile', false, NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 days', 5, 1),
    (11, 'Optimize database queries', 'Several N+1 queries identified in project listing endpoint.', 'TODO', '2025-01-15', '2025-01-28', 0, 'HIGHEST', 'performance,backend', true, NOW() - INTERVAL '18 days', NOW() - INTERVAL '5 days', 2, 1),

    -- Tasks with upcoming deadlines (within 3 days)
    (12, 'Write unit tests for auth module', 'Achieve 80% code coverage for authentication service.', 'IN_PROGRESS', '2025-01-28', CURRENT_DATE + INTERVAL '2 days', 50, 'MEDIUM', 'testing,auth', false, NOW() - INTERVAL '7 days', NOW(), 3, 1),
    (13, 'Review PR for dashboard', 'Code review for dashboard feature branch with 15 files changed.', 'TO_REVIEW', '2025-01-30', CURRENT_DATE + INTERVAL '1 day', 80, 'HIGH', 'review,frontend', false, NOW() - INTERVAL '3 days', NOW(), 4, 1),

    -- More variety
    (14, 'Setup monitoring and alerting', 'Configure Prometheus and Grafana for application monitoring.', 'GATHERING_INTEREST', '2025-02-10', '2025-02-25', 0, 'MEDIUM', 'devops,monitoring', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NULL, 1);

-- ============================================
-- TASKS FOR MOBILE PROJECT
-- ============================================
INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, priority, labels, is_critical, created, updated, assignee_id, project_id) VALUES
    (1, 'Setup React Native project', 'Initialize React Native project with TypeScript and navigation setup.', 'DONE', '2025-01-10', '2025-01-15', 100, 'HIGH', 'setup,mobile', true, NOW() - INTERVAL '25 days', NOW() - INTERVAL '18 days', 3, 2),
    (2, 'Implement offline storage', 'Local SQLite database for offline task management.', 'IN_PROGRESS', '2025-01-20', '2025-02-10', 45, 'HIGH', 'feature,offline', true, NOW() - INTERVAL '15 days', NOW(), 5, 2),
    (3, 'Design app icons and splash screen', 'Create app icon variants and animated splash screen.', 'DONE', '2025-01-12', '2025-01-18', 100, 'MEDIUM', 'design,assets', false, NOW() - INTERVAL '22 days', NOW() - INTERVAL '15 days', 1, 2),
    (4, 'Implement push notifications', 'Firebase Cloud Messaging integration for real-time alerts.', 'TODO', '2025-02-01', '2025-02-15', 0, 'HIGH', 'feature,notifications', true, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', 3, 2),
    (5, 'Build authentication screens', 'Login, registration, and password reset screens.', 'IN_PROGRESS', '2025-01-25', '2025-02-05', 70, 'HIGH', 'auth,ui', true, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day', 5, 2),
    (6, 'App Store submission preparation', 'Screenshots, descriptions, and metadata for store listings.', 'BACKLOG', '2025-02-20', '2025-03-01', 0, 'LOW', 'release,store', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NULL, 2),
    (7, 'Performance optimization', 'Reduce app startup time and memory usage.', 'TODO', '2025-02-10', CURRENT_DATE + INTERVAL '3 days', 0, 'MEDIUM', 'performance', false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 3, 2);

-- ============================================
-- TASKS FOR API PROJECT
-- ============================================
INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, priority, labels, is_critical, created, updated, assignee_id, project_id) VALUES
    (1, 'Design API architecture', 'Define microservices boundaries and communication patterns.', 'DONE', '2025-01-05', '2025-01-12', 100, 'HIGHEST', 'architecture,design', true, NOW() - INTERVAL '30 days', NOW() - INTERVAL '22 days', 2, 3),
    (2, 'Implement rate limiting', 'Token bucket algorithm for API rate limiting per client.', 'IN_PROGRESS', '2025-01-18', '2025-02-01', 65, 'HIGH', 'security,feature', true, NOW() - INTERVAL '18 days', NOW(), 4, 3),
    (3, 'Setup API documentation', 'OpenAPI/Swagger documentation with examples.', 'IN_PROGRESS', '2025-01-20', '2025-01-30', 80, 'MEDIUM', 'docs,api', false, NOW() - INTERVAL '15 days', NOW() - INTERVAL '2 days', 2, 3),
    (4, 'Implement circuit breaker', 'Resilience4j circuit breaker for downstream service calls.', 'TODO', '2025-02-01', '2025-02-12', 0, 'HIGH', 'resilience,backend', true, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', 4, 3),
    (5, 'Add request logging', 'Structured logging with correlation IDs for request tracing.', 'DONE', '2025-01-15', '2025-01-22', 100, 'MEDIUM', 'logging,observability', false, NOW() - INTERVAL '20 days', NOW() - INTERVAL '12 days', 1, 3);

-- ============================================
-- TASKS FOR DOCS PROJECT
-- ============================================
INSERT INTO tasks (task_number, summary, description, status, start_date, due_date, progress, priority, labels, is_critical, created, updated, assignee_id, project_id) VALUES
    (1, 'Setup documentation framework', 'VuePress or Docusaurus setup with custom theme.', 'DONE', '2025-01-08', '2025-01-15', 100, 'HIGH', 'setup,docs', true, NOW() - INTERVAL '28 days', NOW() - INTERVAL '20 days', 1, 4),
    (2, 'Write API reference docs', 'Complete API documentation with request/response examples.', 'IN_PROGRESS', '2025-01-20', '2025-02-10', 55, 'HIGH', 'api,docs', true, NOW() - INTERVAL '15 days', NOW(), 2, 4),
    (3, 'Create onboarding guide', 'Step-by-step guide for new team members.', 'TODO', '2025-02-05', '2025-02-20', 0, 'MEDIUM', 'onboarding,guide', false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 1, 4);

-- ============================================
-- TASK DEPENDENCIES
-- ============================================
-- FLOW project dependencies
INSERT INTO task_dependencies (task_id, dependency_id) VALUES
    -- Task 3 (auth) depends on Task 2 (database schema)
    ((SELECT id FROM tasks WHERE project_id = 1 AND task_number = 3), (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 2)),
    -- Task 4 (dashboard) depends on Task 3 (auth)
    ((SELECT id FROM tasks WHERE project_id = 1 AND task_number = 4), (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 3)),
    -- Task 5 (notifications) depends on Task 3 (auth)
    ((SELECT id FROM tasks WHERE project_id = 1 AND task_number = 5), (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 3)),
    -- Task 6 (timeline) depends on Task 4 (dashboard)
    ((SELECT id FROM tasks WHERE project_id = 1 AND task_number = 6), (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 4)),
    -- Task 8 (task dependencies feature) depends on Task 6 (timeline)
    ((SELECT id FROM tasks WHERE project_id = 1 AND task_number = 8), (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 6)),
    -- Task 12 (unit tests) depends on Task 3 (auth)
    ((SELECT id FROM tasks WHERE project_id = 1 AND task_number = 12), (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 3));

-- MOBILE project dependencies
INSERT INTO task_dependencies (task_id, dependency_id) VALUES
    -- Task 2 (offline) depends on Task 1 (setup)
    ((SELECT id FROM tasks WHERE project_id = 2 AND task_number = 2), (SELECT id FROM tasks WHERE project_id = 2 AND task_number = 1)),
    -- Task 5 (auth screens) depends on Task 1 (setup)
    ((SELECT id FROM tasks WHERE project_id = 2 AND task_number = 5), (SELECT id FROM tasks WHERE project_id = 2 AND task_number = 1)),
    -- Task 4 (push notifications) depends on Task 5 (auth screens)
    ((SELECT id FROM tasks WHERE project_id = 2 AND task_number = 4), (SELECT id FROM tasks WHERE project_id = 2 AND task_number = 5));

-- API project dependencies
INSERT INTO task_dependencies (task_id, dependency_id) VALUES
    -- Task 2 (rate limiting) depends on Task 1 (architecture)
    ((SELECT id FROM tasks WHERE project_id = 3 AND task_number = 2), (SELECT id FROM tasks WHERE project_id = 3 AND task_number = 1)),
    -- Task 4 (circuit breaker) depends on Task 1 (architecture)
    ((SELECT id FROM tasks WHERE project_id = 3 AND task_number = 4), (SELECT id FROM tasks WHERE project_id = 3 AND task_number = 1));

-- ============================================
-- COMMENTS
-- ============================================
-- Comments on FLOW-4 (Dashboard UI)
INSERT INTO comments (content, timestamp, edited_at, task_id, author_id, parent_comment_id) VALUES
    ('I''ve started working on the dashboard layout. Using CSS Grid for the main structure. Here''s the initial mockup we discussed.', NOW() - INTERVAL '5 days', NULL, (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 4), 3, NULL),
    ('Looks great! Can we add a dark mode toggle? Many users have been requesting it.', NOW() - INTERVAL '4 days', NULL, (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 4), 1, NULL),
    ('Good idea! I''ll add it to the scope. Should be straightforward with CSS variables.', NOW() - INTERVAL '4 days', NULL, (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 4), 3, (SELECT id FROM comments WHERE content LIKE 'Looks great!%')),
    ('The statistics cards are now responsive. Testing on various screen sizes.', NOW() - INTERVAL '2 days', NULL, (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 4), 3, NULL),
    ('@jane.smith Can you review the color scheme? Want to make sure it aligns with our design system.', NOW() - INTERVAL '1 day', NULL, (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 4), 3, NULL);

-- Comments on FLOW-5 (Notification system)
INSERT INTO comments (content, timestamp, edited_at, task_id, author_id, parent_comment_id) VALUES
    ('Started implementing the notification service. Using WebSocket for real-time updates.', NOW() - INTERVAL '8 days', NULL, (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 5), 4, NULL),
    ('Should we also support email notifications for important events?', NOW() - INTERVAL '7 days', NULL, (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 5), 2, NULL),
    ('Yes, let''s add email as a secondary channel. I''ll create a separate task for that.', NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days', (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 5), 4, (SELECT id FROM comments WHERE content LIKE 'Should we also support%')),
    ('Notification polling is working. Set to 30-second intervals to balance freshness and server load.', NOW() - INTERVAL '1 day', NULL, (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 5), 4, NULL);

-- Comments on FLOW-10 (Login responsiveness bug)
INSERT INTO comments (content, timestamp, edited_at, task_id, author_id, parent_comment_id) VALUES
    ('Reproduced the bug on iPhone SE. The form overflows on screens < 375px.', NOW() - INTERVAL '10 days', NULL, (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 10), 5, NULL),
    ('Found the issue - fixed width on the input container. Changing to max-width should fix it.', NOW() - INTERVAL '8 days', NULL, (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 10), 5, NULL),
    ('Also noticed the logo doesn''t scale properly. Adding that to this fix.', NOW() - INTERVAL '5 days', NULL, (SELECT id FROM tasks WHERE project_id = 1 AND task_number = 10), 5, NULL);

-- Comments on MOBILE-2 (Offline storage)
INSERT INTO comments (content, timestamp, edited_at, task_id, author_id, parent_comment_id) VALUES
    ('Evaluated SQLite vs Realm for offline storage. Recommending SQLite for simplicity and better React Native support.', NOW() - INTERVAL '10 days', NULL, (SELECT id FROM tasks WHERE project_id = 2 AND task_number = 2), 5, NULL),
    ('Agreed. SQLite also has better tooling for debugging. Let''s proceed with that.', NOW() - INTERVAL '9 days', NULL, (SELECT id FROM tasks WHERE project_id = 2 AND task_number = 2), 1, (SELECT id FROM comments WHERE content LIKE 'Evaluated SQLite%')),
    ('Sync logic is tricky. Implementing conflict resolution based on last-modified timestamp.', NOW() - INTERVAL '3 days', NULL, (SELECT id FROM tasks WHERE project_id = 2 AND task_number = 2), 5, NULL);

-- Comments on API-2 (Rate limiting)
INSERT INTO comments (content, timestamp, edited_at, task_id, author_id, parent_comment_id) VALUES
    ('Implementing token bucket with Redis backend. This allows distributed rate limiting across instances.', NOW() - INTERVAL '12 days', NULL, (SELECT id FROM tasks WHERE project_id = 3 AND task_number = 2), 4, NULL),
    ('What are the default limits you''re thinking?', NOW() - INTERVAL '11 days', NULL, (SELECT id FROM tasks WHERE project_id = 3 AND task_number = 2), 2, NULL),
    ('100 requests/minute for authenticated users, 20/minute for anonymous. Configurable per endpoint.', NOW() - INTERVAL '11 days', NULL, (SELECT id FROM tasks WHERE project_id = 3 AND task_number = 2), 4, (SELECT id FROM comments WHERE content LIKE 'What are the default%'));

-- ============================================
-- COMMENT REACTIONS
-- ============================================
INSERT INTO comment_reactions (type, comment_id, user_id) VALUES
    ('LIKE', (SELECT id FROM comments WHERE content LIKE 'I''ve started working on the dashboard%'), 1),
    ('LIKE', (SELECT id FROM comments WHERE content LIKE 'I''ve started working on the dashboard%'), 2),
    ('LIKE', (SELECT id FROM comments WHERE content LIKE 'I''ve started working on the dashboard%'), 4),
    ('LIKE', (SELECT id FROM comments WHERE content LIKE 'Good idea! I''ll add it%'), 1),
    ('LIKE', (SELECT id FROM comments WHERE content LIKE 'Good idea! I''ll add it%'), 2),
    ('LIKE', (SELECT id FROM comments WHERE content LIKE 'Evaluated SQLite%'), 1),
    ('LIKE', (SELECT id FROM comments WHERE content LIKE 'Evaluated SQLite%'), 3),
    ('LIKE', (SELECT id FROM comments WHERE content LIKE '100 requests/minute%'), 2),
    ('LIKE', (SELECT id FROM comments WHERE content LIKE 'Notification polling is working%'), 1),
    ('LIKE', (SELECT id FROM comments WHERE content LIKE 'Notification polling is working%'), 2),
    ('LIKE', (SELECT id FROM comments WHERE content LIKE 'Notification polling is working%'), 3);

-- ============================================
-- NOTIFICATIONS
-- ============================================
-- Notifications for John Doe (user 1)
INSERT INTO notifications (message, timestamp, is_read, type, link, user_id) VALUES
    ('Jane Smith assigned you to "Create timeline view"', NOW() - INTERVAL '10 days', true, 'TASK_ASSIGNED', '/projects?selectedIssue=FLOW-6', 1),
    ('Mike Johnson commented on "Build dashboard UI"', NOW() - INTERVAL '5 days', true, 'COMMENT_REPLY', '/projects?selectedIssue=FLOW-4', 1),
    ('Sarah Williams mentioned you in a comment', NOW() - INTERVAL '2 days', false, 'COMMENT_REPLY', '/projects?selectedIssue=FLOW-5', 1),
    ('Task "Optimize database queries" is overdue', NOW() - INTERVAL '1 day', false, 'TASK_UPDATED', '/projects?selectedIssue=FLOW-11', 1),
    ('Alex Brown updated "Fix login page responsiveness"', NOW() - INTERVAL '12 hours', false, 'TASK_UPDATED', '/projects?selectedIssue=FLOW-10', 1),
    ('New comment on "Implement offline storage"', NOW() - INTERVAL '3 days', true, 'COMMENT_REPLY', '/projects?selectedIssue=MOBILE-2', 1);

-- Notifications for Jane Smith (user 2)
INSERT INTO notifications (message, timestamp, is_read, type, link, user_id) VALUES
    ('John Doe added you to project "API Gateway Service"', NOW() - INTERVAL '15 days', true, 'PROJECT_INVITATION', '/projects?projectKey=API', 2),
    ('You were assigned to "Add file attachment support"', NOW() - INTERVAL '5 days', true, 'TASK_ASSIGNED', '/projects?selectedIssue=FLOW-7', 2),
    ('Mike Johnson liked your comment', NOW() - INTERVAL '4 days', true, 'COMMENT_REACTION', '/projects?selectedIssue=FLOW-4', 2),
    ('Task "Write API reference docs" deadline approaching', NOW() - INTERVAL '1 day', false, 'TASK_UPDATED', '/projects?selectedIssue=DOCS-2', 2),
    ('Sarah Williams commented on "Implement rate limiting"', NOW() - INTERVAL '11 days', true, 'COMMENT_REPLY', '/projects?selectedIssue=API-2', 2);

-- Notifications for Mike Johnson (user 3)
INSERT INTO notifications (message, timestamp, is_read, type, link, user_id) VALUES
    ('John Doe assigned you to "Build dashboard UI"', NOW() - INTERVAL '15 days', true, 'TASK_ASSIGNED', '/projects?selectedIssue=FLOW-4', 3),
    ('Jane Smith requested your review on "Review PR for dashboard"', NOW() - INTERVAL '3 days', false, 'TASK_ASSIGNED', '/projects?selectedIssue=FLOW-13', 3),
    ('3 people liked your comment on dashboard task', NOW() - INTERVAL '4 days', true, 'COMMENT_REACTION', '/projects?selectedIssue=FLOW-4', 3),
    ('Task "Performance optimization" assigned to you', NOW() - INTERVAL '3 days', false, 'TASK_ASSIGNED', '/projects?selectedIssue=MOBILE-7', 3);

-- Notifications for Sarah Williams (user 4)
INSERT INTO notifications (message, timestamp, is_read, type, link, user_id) VALUES
    ('You were assigned to "Implement notification system"', NOW() - INTERVAL '12 days', true, 'TASK_ASSIGNED', '/projects?selectedIssue=FLOW-5', 4),
    ('John Doe commented on your task', NOW() - INTERVAL '7 days', true, 'COMMENT_REPLY', '/projects?selectedIssue=FLOW-5', 4),
    ('Task "Review PR for dashboard" needs attention', NOW() - INTERVAL '1 day', false, 'TASK_UPDATED', '/projects?selectedIssue=FLOW-13', 4),
    ('You were assigned to "Implement circuit breaker"', NOW() - INTERVAL '5 days', true, 'TASK_ASSIGNED', '/projects?selectedIssue=API-4', 4);

-- Notifications for Alex Brown (user 5)
INSERT INTO notifications (message, timestamp, is_read, type, link, user_id) VALUES
    ('You were assigned to "Fix login page responsiveness"', NOW() - INTERVAL '20 days', true, 'TASK_ASSIGNED', '/projects?selectedIssue=FLOW-10', 5),
    ('John Doe commented on "Implement offline storage"', NOW() - INTERVAL '9 days', true, 'COMMENT_REPLY', '/projects?selectedIssue=MOBILE-2', 5),
    ('Task "Fix login page responsiveness" is overdue', NOW() - INTERVAL '5 days', false, 'TASK_UPDATED', '/projects?selectedIssue=FLOW-10', 5),
    ('2 people liked your comment', NOW() - INTERVAL '8 days', true, 'COMMENT_REACTION', '/projects?selectedIssue=MOBILE-2', 5);
