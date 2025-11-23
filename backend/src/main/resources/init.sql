-- Insert Projects
INSERT INTO projects (project_key, summary, description, user_id) VALUES
                                                                                            ('PROJ-1', 'Project 1', 'Description of Project 1', NULL, NULL, 1),
                                                                                            ('PROJ-2', 'Project 2', 'Description of Project 2', NULL, NULL, 1);

-- Insert Tasks for PROJ-1
INSERT INTO tasks (task_key, summary, description, status, start_date, due_date, assignee, labels, project_id) VALUES
                                                                                                                   ('TASK-11', 'Task 1', NULL, 'To Do', '2024-08-03', '2024-08-10', 'MB', NULL, (SELECT id FROM projects WHERE project_key = 'PROJ-1')),
                                                                                                                   ('TASK-13', 'Task 2', NULL, 'To Do', '2024-08-05', '2024-08-15', 'MB', NULL, (SELECT id FROM projects WHERE project_key = 'PROJ-1')),
                                                                                                                   ('TASK-14', 'Task 3', NULL, 'In Progress', '2024-09-01', '2024-09-10', 'MB', NULL, (SELECT id FROM projects WHERE project_key = 'PROJ-1')),
                                                                                                                   ('TASK-15', 'Task 4', NULL, 'Done', '2024-09-05', '2024-09-15', 'MB', NULL, (SELECT id FROM projects WHERE project_key = 'PROJ-1'));

-- Insert Tasks for PROJ-2
INSERT INTO tasks (task_key, summary, description, status, start_date, due_date, assignee, labels, project_id) VALUES
                                                                                                                   ('TASK-12', 'Task 3', NULL, 'To Do', '2024-09-07', '2024-09-20', 'MB', NULL, (SELECT id FROM projects WHERE project_key = 'PROJ-2')),
                                                                                                                   ('TASK-16', 'Task 4', NULL, 'In Progress', '2024-10-01', '2024-10-12', 'MB', NULL, (SELECT id FROM projects WHERE project_key = 'PROJ-2')),
                                                                                                                   ('TASK-17', 'Task 5', NULL, 'Done', '2024-10-05', '2024-10-18', 'MB', NULL, (SELECT id FROM projects WHERE project_key = 'PROJ-2'));

-- Insert Task Dependencies for PROJ-1
-- TASK-13 depends on TASK-11
INSERT INTO task_dependencies (task_id, dependency_id) VALUES
    (
        (SELECT id FROM tasks WHERE task_key = 'TASK-13'),
        (SELECT id FROM tasks WHERE task_key = 'TASK-11')
    );

-- TASK-14 depends on TASK-13
INSERT INTO task_dependencies (task_id, dependency_id) VALUES
    (
        (SELECT id FROM tasks WHERE task_key = 'TASK-14'),
        (SELECT id FROM tasks WHERE task_key = 'TASK-13')
    );
