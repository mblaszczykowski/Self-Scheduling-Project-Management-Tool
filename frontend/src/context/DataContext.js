import React, { createContext, useCallback, useEffect, useState } from 'react';
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

    const refreshProjects = useCallback(async () => {
        try {
            const fetchedProjects = await getProjects();
            setProjects(fetchedProjects);
        } catch (err) {
            console.error('Error refreshing projects:', err);
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

    // Task operations
    const createTask = useCallback(async (projectKey, taskDTO, attachments = []) => {
        const response = await apiCreateTask(projectKey, taskDTO, attachments);
        await refreshProjects();
        return response;
    }, [refreshProjects]);

    const updateTask = useCallback(async (projectKey, taskKey, taskDTO, attachments = []) => {
        const response = await apiUpdateTask(projectKey, taskKey, taskDTO, attachments);
        await refreshProjects();
        return response;
    }, [refreshProjects]);

    const deleteTask = useCallback(async (projectKey, taskKey) => {
        const response = await apiDeleteTask(projectKey, taskKey);
        await refreshProjects();
        return response;
    }, [refreshProjects]);

    // Project operations
    const createProject = useCallback(async (projectDTO, attachments = []) => {
        const response = await apiCreateProject(projectDTO, attachments);
        await refreshProjects();
        return response;
    }, [refreshProjects]);

    const updateProject = useCallback(async (projectKey, projectDTO, attachments = []) => {
        const response = await apiUpdateProject(projectKey, projectDTO, attachments);
        await refreshProjects();
        return response;
    }, [refreshProjects]);

    const deleteProject = useCallback(async (projectKey) => {
        const response = await apiDeleteProject(projectKey);
        await refreshProjects();
        return response;
    }, [refreshProjects]);

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
        const foundUser = await getUserByEmail(userEmail);
        if (!foundUser) throw new Error('User not found');

        const projectToUpdate = projects.find(p => p.projectKey === projectKey);
        if (!projectToUpdate) throw new Error('Project not found');

        const updatedProject = {
            ...projectToUpdate,
            members: [...projectToUpdate.members, foundUser],
        };
        await updateProject(projectKey, updatedProject);
        return updatedProject;
    }, [projects, updateProject]);

    const value = {
        user,
        projects,
        notifications,
        loading,
        error,
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