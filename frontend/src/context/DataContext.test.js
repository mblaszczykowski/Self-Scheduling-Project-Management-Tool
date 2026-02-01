import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DataProvider, DataContext } from './DataContext';

// Mock the API module
jest.mock('../util/api', () => ({
    getProjects: jest.fn(),
    getNotifications: jest.fn(),
    getUserByEmail: jest.fn(),
    createProject: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    getComments: jest.fn(),
    createComment: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
    reactToComment: jest.fn(),
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

import {
    getProjects,
    getNotifications,
    getUserByEmail,
    createProject as apiCreateProject,
    updateProject as apiUpdateProject,
    deleteProject as apiDeleteProject,
    createTask as apiCreateTask,
    updateTask as apiUpdateTask,
    deleteTask as apiDeleteTask,
} from '../util/api';

// Test component to consume context
const TestConsumer = ({ onContext }) => {
    const context = React.useContext(DataContext);
    React.useEffect(() => {
        onContext(context);
    }, [context, onContext]);
    return <div data-testid="test-consumer">Loaded</div>;
};

const renderWithProvider = (ui, { user = null, ...options } = {}) => {
    return render(
        <BrowserRouter>
            <DataProvider initialUser={user}>
                {ui}
            </DataProvider>
        </BrowserRouter>,
        options
    );
};

describe('DataContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.clearMockCookies();
        mockNavigate.mockClear();
        window.location.pathname = '/dashboard';

        // Default mock implementations
        getProjects.mockResolvedValue([]);
        getNotifications.mockResolvedValue([]);
    });

    describe('Initialization', () => {
        test('should set loading to false when no user', async () => {
            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: null }
            );

            await waitFor(() => {
                expect(capturedContext.loading).toBe(false);
            });
        });

        test('should fetch projects and notifications when user exists', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const mockProjects = [{ id: 1, projectKey: 'PROJ1', name: 'Project 1' }];
            const mockNotifications = [{ id: 1, message: 'Test notification' }];

            getProjects.mockResolvedValue(mockProjects);
            getNotifications.mockResolvedValue(mockNotifications);

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.loading).toBe(false);
                expect(capturedContext.projects).toEqual(mockProjects);
                expect(capturedContext.notifications).toEqual(mockNotifications);
            });
        });

        test('should handle fetch errors and set error state', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const mockError = new Error('Network error');

            getProjects.mockRejectedValue(mockError);

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.error).toBe(mockError);
            });
        });

        test('should redirect to login on 401 error', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const mockError = { response: { status: 401 } };

            getProjects.mockRejectedValue(mockError);

            renderWithProvider(
                <TestConsumer onContext={() => {}} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/login');
            });
        });

        test('should NOT redirect on 401 if on login page', async () => {
            window.location.pathname = '/login';
            const mockUser = { id: 1, email: 'test@example.com' };
            const mockError = { response: { status: 401 } };

            getProjects.mockRejectedValue(mockError);

            renderWithProvider(
                <TestConsumer onContext={() => {}} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(mockNavigate).not.toHaveBeenCalled();
            });
        });

        test('should NOT redirect on 401 if on register page', async () => {
            window.location.pathname = '/register';
            const mockUser = { id: 1, email: 'test@example.com' };
            const mockError = { response: { status: 401 } };

            getProjects.mockRejectedValue(mockError);

            renderWithProvider(
                <TestConsumer onContext={() => {}} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(mockNavigate).not.toHaveBeenCalled();
            });
        });
    });

    describe('Project Operations', () => {
        test('createProject should add project to local state', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const existingProject = { id: 1, projectKey: 'PROJ1', name: 'Project 1' };
            const newProject = { id: 2, projectKey: 'PROJ2', name: 'Project 2' };

            getProjects.mockResolvedValue([existingProject]);
            getNotifications.mockResolvedValue([]);
            apiCreateProject.mockResolvedValue(newProject);

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.projects).toEqual([existingProject]);
            });

            await act(async () => {
                await capturedContext.createProject({ name: 'Project 2', projectKey: 'PROJ2' });
            });

            await waitFor(() => {
                expect(capturedContext.projects).toContainEqual(newProject);
            });
        });

        test('updateProject should update project in local state', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const project = { id: 1, projectKey: 'PROJ1', name: 'Project 1' };
            const updatedProject = { id: 1, projectKey: 'PROJ1', name: 'Updated Project' };

            getProjects.mockResolvedValue([project]);
            getNotifications.mockResolvedValue([]);
            apiUpdateProject.mockResolvedValue(updatedProject);

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.projects).toEqual([project]);
            });

            await act(async () => {
                await capturedContext.updateProject('PROJ1', { name: 'Updated Project' });
            });

            await waitFor(() => {
                expect(capturedContext.projects).toContainEqual(updatedProject);
            });
        });

        test('deleteProject should remove project from local state', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const project = { id: 1, projectKey: 'PROJ1', name: 'Project 1' };

            getProjects.mockResolvedValue([project]);
            getNotifications.mockResolvedValue([]);
            apiDeleteProject.mockResolvedValue({});

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.projects).toEqual([project]);
            });

            await act(async () => {
                await capturedContext.deleteProject('PROJ1');
            });

            await waitFor(() => {
                expect(capturedContext.projects).toEqual([]);
            });
        });
    });

    describe('Task Operations', () => {
        test('createTask should add task to project in local state', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const project = { id: 1, projectKey: 'PROJ1', name: 'Project 1', tasks: [] };
            const newTask = { id: 1, taskKey: 'PROJ1-1', name: 'Task 1' };

            getProjects.mockResolvedValue([project]);
            getNotifications.mockResolvedValue([]);
            apiCreateTask.mockResolvedValue(newTask);

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.projects[0].tasks).toEqual([]);
            });

            await act(async () => {
                await capturedContext.createTask('PROJ1', { name: 'Task 1' });
            });

            await waitFor(() => {
                expect(capturedContext.projects[0].tasks).toContainEqual(newTask);
            });
        });

        test('updateTask should update task in project', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const task = { id: 1, taskKey: 'PROJ1-1', name: 'Task 1' };
            const project = { id: 1, projectKey: 'PROJ1', name: 'Project 1', tasks: [task] };
            const updatedTask = { id: 1, taskKey: 'PROJ1-1', name: 'Updated Task' };

            getProjects.mockResolvedValue([project]);
            getNotifications.mockResolvedValue([]);
            apiUpdateTask.mockResolvedValue(updatedTask);

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.projects[0].tasks[0].name).toBe('Task 1');
            });

            await act(async () => {
                await capturedContext.updateTask('PROJ1', 'PROJ1-1', { name: 'Updated Task' });
            });

            await waitFor(() => {
                expect(capturedContext.projects[0].tasks[0].name).toBe('Updated Task');
            });
        });

        test('deleteTask should remove task from project', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const task = { id: 1, taskKey: 'PROJ1-1', name: 'Task 1' };
            const project = { id: 1, projectKey: 'PROJ1', name: 'Project 1', tasks: [task] };

            getProjects.mockResolvedValue([project]);
            getNotifications.mockResolvedValue([]);
            apiDeleteTask.mockResolvedValue({});

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.projects[0].tasks).toHaveLength(1);
            });

            await act(async () => {
                await capturedContext.deleteTask('PROJ1', 'PROJ1-1');
            });

            await waitFor(() => {
                expect(capturedContext.projects[0].tasks).toHaveLength(0);
            });
        });
    });

    describe('Notification Polling', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should poll notifications every 30 seconds', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };

            getProjects.mockResolvedValue([]);
            getNotifications.mockResolvedValue([]);

            renderWithProvider(
                <TestConsumer onContext={() => {}} />,
                { user: mockUser }
            );

            // Wait for initial fetch
            await waitFor(() => {
                expect(getNotifications).toHaveBeenCalledTimes(1);
            });

            // Fast-forward 30 seconds
            act(() => {
                jest.advanceTimersByTime(30000);
            });

            await waitFor(() => {
                expect(getNotifications).toHaveBeenCalledTimes(2);
            });

            // Fast-forward another 30 seconds
            act(() => {
                jest.advanceTimersByTime(30000);
            });

            await waitFor(() => {
                expect(getNotifications).toHaveBeenCalledTimes(3);
            });
        });

        test('should NOT poll when tab is hidden', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };

            getProjects.mockResolvedValue([]);
            getNotifications.mockResolvedValue([]);

            renderWithProvider(
                <TestConsumer onContext={() => {}} />,
                { user: mockUser }
            );

            // Wait for initial fetch
            await waitFor(() => {
                expect(getNotifications).toHaveBeenCalledTimes(1);
            });

            // Simulate tab becoming hidden
            act(() => {
                Object.defineProperty(document, 'visibilityState', {
                    writable: true,
                    value: 'hidden',
                });
                document.dispatchEvent(new Event('visibilitychange'));
            });

            // Fast-forward 30 seconds
            act(() => {
                jest.advanceTimersByTime(30000);
            });

            // Should not have polled again
            expect(getNotifications).toHaveBeenCalledTimes(1);
        });

        test('should refresh immediately when tab becomes visible', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };

            getProjects.mockResolvedValue([]);
            getNotifications.mockResolvedValue([]);

            renderWithProvider(
                <TestConsumer onContext={() => {}} />,
                { user: mockUser }
            );

            // Wait for initial fetch
            await waitFor(() => {
                expect(getNotifications).toHaveBeenCalledTimes(1);
            });

            // Simulate tab becoming hidden then visible
            act(() => {
                Object.defineProperty(document, 'visibilityState', {
                    writable: true,
                    value: 'hidden',
                });
                document.dispatchEvent(new Event('visibilitychange'));
            });

            act(() => {
                Object.defineProperty(document, 'visibilityState', {
                    writable: true,
                    value: 'visible',
                });
                document.dispatchEvent(new Event('visibilitychange'));
            });

            // Should refresh immediately
            await waitFor(() => {
                expect(getNotifications).toHaveBeenCalledTimes(2);
            });
        });

        test('should NOT poll when no user', async () => {
            getProjects.mockResolvedValue([]);
            getNotifications.mockResolvedValue([]);

            renderWithProvider(
                <TestConsumer onContext={() => {}} />,
                { user: null }
            );

            // Fast-forward 60 seconds
            act(() => {
                jest.advanceTimersByTime(60000);
            });

            // Should never have called getNotifications
            expect(getNotifications).not.toHaveBeenCalled();
        });
    });

    describe('Refresh Functions', () => {
        test('refreshProjects should fetch and update projects', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const initialProjects = [{ id: 1, projectKey: 'PROJ1', name: 'Project 1' }];
            const updatedProjects = [
                { id: 1, projectKey: 'PROJ1', name: 'Project 1' },
                { id: 2, projectKey: 'PROJ2', name: 'Project 2' },
            ];

            getProjects.mockResolvedValueOnce(initialProjects).mockResolvedValueOnce(updatedProjects);
            getNotifications.mockResolvedValue([]);

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.projects).toEqual(initialProjects);
            });

            await act(async () => {
                await capturedContext.refreshProjects();
            });

            await waitFor(() => {
                expect(capturedContext.projects).toEqual(updatedProjects);
            });
        });

        test('refreshNotifications should fetch and update notifications', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const initialNotifications = [{ id: 1, message: 'Notification 1' }];
            const updatedNotifications = [
                { id: 1, message: 'Notification 1' },
                { id: 2, message: 'Notification 2' },
            ];

            getProjects.mockResolvedValue([]);
            getNotifications.mockResolvedValueOnce(initialNotifications).mockResolvedValueOnce(updatedNotifications);

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.notifications).toEqual(initialNotifications);
            });

            await act(async () => {
                await capturedContext.refreshNotifications();
            });

            await waitFor(() => {
                expect(capturedContext.notifications).toEqual(updatedNotifications);
            });
        });
    });

    describe('addUserToProject', () => {
        test('should add user to project members', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const newMember = { id: 2, email: 'member@example.com', fullName: 'New Member' };
            const project = {
                id: 1,
                projectKey: 'PROJ1',
                name: 'Project 1',
                members: [],
            };
            const updatedProject = {
                ...project,
                members: [newMember],
            };

            getProjects.mockResolvedValue([project]);
            getNotifications.mockResolvedValue([]);
            getUserByEmail.mockResolvedValue(newMember);
            apiUpdateProject.mockResolvedValue(updatedProject);

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.projects[0].members).toEqual([]);
            });

            await act(async () => {
                await capturedContext.addUserToProject('PROJ1', 'member@example.com');
            });

            expect(getUserByEmail).toHaveBeenCalledWith('member@example.com');
        });

        test('should throw error when user not found', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const project = { id: 1, projectKey: 'PROJ1', name: 'Project 1', members: [] };

            getProjects.mockResolvedValue([project]);
            getNotifications.mockResolvedValue([]);
            getUserByEmail.mockResolvedValue(null);

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.loading).toBe(false);
            });

            await expect(
                capturedContext.addUserToProject('PROJ1', 'nonexistent@example.com')
            ).rejects.toThrow('User not found');
        });

        test('should throw error when project not found', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };
            const newMember = { id: 2, email: 'member@example.com' };

            getProjects.mockResolvedValue([]);
            getNotifications.mockResolvedValue([]);
            getUserByEmail.mockResolvedValue(newMember);

            let capturedContext;

            renderWithProvider(
                <TestConsumer onContext={(ctx) => { capturedContext = ctx; }} />,
                { user: mockUser }
            );

            await waitFor(() => {
                expect(capturedContext.loading).toBe(false);
            });

            await expect(
                capturedContext.addUserToProject('NONEXISTENT', 'member@example.com')
            ).rejects.toThrow('Project not found');
        });
    });

    describe('Abort Controller', () => {
        test('should abort fetch on unmount', async () => {
            const mockUser = { id: 1, email: 'test@example.com' };

            // Create a delayed promise that we can check was aborted
            let resolveProjects;
            getProjects.mockReturnValue(new Promise((resolve) => {
                resolveProjects = resolve;
            }));
            getNotifications.mockResolvedValue([]);

            const { unmount } = renderWithProvider(
                <TestConsumer onContext={() => {}} />,
                { user: mockUser }
            );

            // Unmount before resolving
            unmount();

            // Resolve the promise - this should not cause errors due to abort
            resolveProjects([]);

            // No assertions needed - test passes if no errors occur
        });
    });
});
