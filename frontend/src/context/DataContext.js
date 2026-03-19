import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
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
    logout,
    reactToComment as apiReactToComment,
    updateComment as apiUpdateComment,
    updateProject as apiUpdateProject,
    updateTask as apiUpdateTask,
} from '../util/api';
import { showToast } from '../util/toast';
import { getErrorMessage } from '../util/helpers';

const NOTIFICATION_POLL_MS = 30000;

export const DataContext = createContext();

export const DataProvider = ({ children, initialUser }) => {
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
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, []);

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
            showToast(getErrorMessage(err));
        }
    }, []);

    const refreshNotifications = useCallback(async () => {
        try {
            const fetchedNotifications = await getNotifications();
            setNotifications(fetchedNotifications);
        } catch (err) {
            console.error('Error refreshing notifications:', err);
        }
    }, []);

    useEffect(() => {
        if (!user) return;

        let intervalId = null;

        const startPolling = () => {
            if (intervalId) return;
            intervalId = setInterval(() => {
                refreshNotifications();
            }, NOTIFICATION_POLL_MS);
        };

        const stopPolling = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshNotifications();
                startPolling();
            } else {
                stopPolling();
            }
        };

        if (document.visibilityState === 'visible') {
            startPolling();
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, refreshNotifications]);

    const createTask = useCallback(async (projectKey, taskDTO, attachments = []) => {
        const newTask = await apiCreateTask(projectKey, taskDTO, attachments);
        setProjects(prev => prev.map(p =>
            p.projectKey === projectKey
                ? { ...p, tasks: [...(p.tasks || []), newTask] }
                : p
        ));
        refreshProjects();
        return newTask;
    }, [refreshProjects]);

    const updateTask = useCallback(async (projectKey, taskKey, taskDTO, attachments = []) => {
        const updatedTask = await apiUpdateTask(projectKey, taskKey, taskDTO, attachments);
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
        refreshProjects();
        return updatedTask;
    }, [refreshProjects]);

    const deleteTask = useCallback(async (projectKey, taskKey) => {
        await apiDeleteTask(projectKey, taskKey);
        setProjects(prev => prev.map(p =>
            p.projectKey === projectKey
                ? { ...p, tasks: (p.tasks || []).filter(t => t.taskKey !== taskKey) }
                : p
        ));
        refreshProjects();
    }, [refreshProjects]);

    const createProject = useCallback(async (projectDTO, attachments = []) => {
        const newProject = await apiCreateProject(projectDTO, attachments);
        setProjects(prev => [...prev, newProject]);
        return newProject;
    }, []);

    const updateProject = useCallback(async (projectKey, projectDTO, attachments = []) => {
        const updatedProject = await apiUpdateProject(projectKey, projectDTO, attachments);
        setProjects(prev => prev.map(p =>
            p.projectKey === projectKey ? updatedProject : p
        ));
        return updatedProject;
    }, []);

    const deleteProject = useCallback(async (projectKey) => {
        await apiDeleteProject(projectKey);
        setProjects(prev => prev.filter(p => p.projectKey !== projectKey));
    }, []);

    const getComments = useCallback((taskId) => apiGetComments(taskId), []);

    const createComment = useCallback((taskId, content, attachments, parentCommentId = null) =>
        apiCreateComment(taskId, content, attachments, parentCommentId), []);

    const updateComment = useCallback((taskId, commentId, content, attachments) =>
        apiUpdateComment(taskId, commentId, content, attachments), []);

    const deleteComment = useCallback((taskId, commentId) =>
        apiDeleteComment(taskId, commentId), []);

    const reactToComment = useCallback((taskId, commentId, reactionType) =>
        apiReactToComment(taskId, commentId, reactionType), []);

    const handleLogout = useCallback(async () => {
        try {
            await logout();
        } catch (err) {
            console.error('Logout failed', err);
        } finally {
            setUser(null);
        }
    }, []);

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
            showToast(`Failed to add user: ${message}`);
            throw err;
        }
    }, [projects, updateProject]);

    const value = useMemo(() => ({
        user,
        projects,
        notifications,
        loading,
        error,
        clearError,
        setUser,
        setNotifications,
        refreshProjects,
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
        handleLogout,
    }), [
        user, projects, notifications, loading, error,
        clearError, setUser, setNotifications,
        refreshProjects, refreshNotifications,
        createTask, updateTask, deleteTask,
        createProject, updateProject, deleteProject,
        getComments, createComment, updateComment,
        deleteComment, reactToComment,
        addUserToProject, handleLogout,
    ]);

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};
