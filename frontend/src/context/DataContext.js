import React, { createContext, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
    createComment as apiCreateComment,
    createProject as apiCreateProject,
    createTask as apiCreateTask,
    deleteComment as apiDeleteComment,
    deleteProject as apiDeleteProject,
    deleteTask as apiDeleteTask,
    getComments as apiGetComments,
    getNotifications,
    getProjects,
    getUserByEmail,
    reactToComment as apiReactToComment,
    updateComment as apiUpdateComment,
    updateProject as apiUpdateProject,
    updateTask as apiUpdateTask,
} from '../util/api';
import { useNavigate } from 'react-router-dom';

// Helper to extract user-friendly error message
const getErrorMessage = (err) => {
    if (err.response?.data?.message) return err.response.data.message;
    if (err.response?.data?.error) return err.response.data.error;
    if (err.message === 'Network Error') return 'Unable to connect to server';
    if (err.code === 'ECONNABORTED') return 'Request timed out';
    return err.message || 'An unexpected error occurred';
};

export const DataContext = createContext();

export const DataProvider = ({ children, initialUser }) => {
    const navigate = useNavigate();
    const [user, setUser] = useState(initialUser);
    const [projects, setProjects] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchUserData = useCallback(async (signal) => {
        try {
            const [fetchedProjects, fetchedNotifications] = await Promise.all([
                getProjects(),
                getNotifications()
            ]);

            if (signal?.aborted) return;

            setProjects(fetchedProjects);
            setNotifications(fetchedNotifications);
            setError(null);
        } catch (err) {
            if (signal?.aborted) return;

            setError(err);
            if (err.response?.status === 401) {
                const publicPaths = ['/login', '/register', '/'];
                if (!publicPaths.includes(window.location.pathname)) {
                    navigate('/login');
                }
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [navigate]);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const abortController = new AbortController();
        fetchUserData(abortController.signal);

        return () => abortController.abort();
    }, [user, fetchUserData]);

    const clearError = useCallback(() => setError(null), []);

    const refreshProjects = useCallback(async () => {
        try {
            const fetchedProjects = await getProjects();
            setProjects(fetchedProjects);
        } catch (err) {
            console.error('Error refreshing projects:', err);
            toast.error(getErrorMessage(err));
        }
    }, []);

    const refreshNotifications = useCallback(async () => {
        try {
            const fetchedNotifications = await getNotifications();
            setNotifications(fetchedNotifications);
        } catch (err) {
            console.error('Error refreshing notifications:', err);
            // Don't show toast for notification refresh failures - too noisy
        }
    }, []);

    // Poll notifications every 30 seconds (only when tab is visible)
    useEffect(() => {
        if (!user) return;

        let intervalId = null;

        const startPolling = () => {
            if (intervalId) return;
            intervalId = setInterval(() => {
                refreshNotifications();
            }, 30000);
        };

        const stopPolling = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshNotifications(); // Refresh immediately when tab becomes visible
                startPolling();
            } else {
                stopPolling();
            }
        };

        // Start polling if tab is visible
        if (document.visibilityState === 'visible') {
            startPolling();
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, refreshNotifications]);

    // Task operations - update local state instead of refetching all projects
    const createTask = useCallback(async (projectKey, taskDTO, attachments = []) => {
        const newTask = await apiCreateTask(projectKey, taskDTO, attachments);
        // Update local state with new task
        setProjects(prev => prev.map(p =>
            p.projectKey === projectKey
                ? { ...p, tasks: [...(p.tasks || []), newTask] }
                : p
        ));
        return newTask;
    }, []);

    const updateTask = useCallback(async (projectKey, taskKey, taskDTO, attachments = []) => {
        const updatedTask = await apiUpdateTask(projectKey, taskKey, taskDTO, attachments);
        // Update local state with updated task
        setProjects(prev => prev.map(p =>
            p.projectKey === projectKey
                ? {
                    ...p,
                    tasks: (p.tasks || []).map(t =>
                        t.taskKey === taskKey ? updatedTask : t
                    )
                }
                : p
        ));
        return updatedTask;
    }, []);

    const deleteTask = useCallback(async (projectKey, taskKey) => {
        await apiDeleteTask(projectKey, taskKey);
        // Remove task from local state
        setProjects(prev => prev.map(p =>
            p.projectKey === projectKey
                ? { ...p, tasks: (p.tasks || []).filter(t => t.taskKey !== taskKey) }
                : p
        ));
    }, []);

    // Project operations - update local state instead of refetching all projects
    const createProject = useCallback(async (projectDTO, attachments = []) => {
        const newProject = await apiCreateProject(projectDTO, attachments);
        // Add new project to local state
        setProjects(prev => [...prev, newProject]);
        return newProject;
    }, []);

    const updateProject = useCallback(async (projectKey, projectDTO, attachments = []) => {
        const updatedProject = await apiUpdateProject(projectKey, projectDTO, attachments);
        // Update project in local state
        setProjects(prev => prev.map(p =>
            p.projectKey === projectKey ? updatedProject : p
        ));
        return updatedProject;
    }, []);

    const deleteProject = useCallback(async (projectKey) => {
        await apiDeleteProject(projectKey);
        // Remove project from local state
        setProjects(prev => prev.filter(p => p.projectKey !== projectKey));
    }, []);

    // Comment operations
    const getComments = useCallback((taskId) => apiGetComments(taskId), []);

    const createComment = useCallback((taskId, content, attachments, parentCommentId = null) =>
        apiCreateComment(taskId, content, attachments, parentCommentId), []);

    const updateComment = useCallback((taskId, commentId, content, attachments) =>
        apiUpdateComment(taskId, commentId, content, attachments), []);

    const deleteComment = useCallback((taskId, commentId) =>
        apiDeleteComment(taskId, commentId), []);

    const reactToComment = useCallback((taskId, commentId, reactionType) =>
        apiReactToComment(taskId, commentId, reactionType), []);

    // User operations
    const addUserToProject = useCallback(async (projectKey, userEmail) => {
        try {
            const foundUser = await getUserByEmail(userEmail);
            if (!foundUser) throw new Error('User not found');

            const projectToUpdate = projects.find(p => p.projectKey === projectKey);
            if (!projectToUpdate) throw new Error('Project not found');

            const updatedProject = {
                ...projectToUpdate,
                members: [...projectToUpdate.members, foundUser],
            };
            const result = await updateProject(projectKey, updatedProject);
            return result;
        } catch (err) {
            const message = getErrorMessage(err);
            toast.error(`Failed to add user: ${message}`);
            throw err;
        }
    }, [projects, updateProject]);

    const value = {
        user,
        projects,
        notifications,
        loading,
        error,
        clearError,
        setUser,
        setNotifications,
        refreshProjects,
        refreshUserTasks: refreshProjects, // Alias for compatibility
        refreshNotifications,
        createTask,
        updateTask,
        deleteTask,
        createProject,
        updateProject,
        deleteProject,
        getComments,
        createComment,
        updateComment,
        deleteComment,
        reactToComment,
        addUserToProject,
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};