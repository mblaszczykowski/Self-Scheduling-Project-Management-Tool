import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    createComment as apiCreateComment,
    createProject as apiCreateProject,
    createTask as apiCreateTask,
    deleteComment as apiDeleteComment,
    deleteProject as apiDeleteProject,
    deleteTask as apiDeleteTask,
    getComments as apiGetComments,
    getProjects,
    getUserByEmail,
    reactToComment as apiReactToComment,
    updateComment as apiUpdateComment,
    updateProject as apiUpdateProject,
    updateTask as apiUpdateTask,
} from '../util/api';
import { showToast } from '../util/toast';
import { getErrorMessage } from '../util/helpers';
import { AuthContext } from './AuthContext';

export const ProjectsContext = createContext();

export const ProjectsProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState(null);

    useEffect(() => {
        if (!user) {
            setProjects([]);
            setProjectsLoading(false);
            setProjectsError(null);
            return;
        }

        let cancelled = false;
        const fetchProjects = async () => {
            try {
                setProjectsError(null);
                const data = await getProjects();
                if (!cancelled) setProjects(data);
            } catch (err) {
                if (!cancelled) {
                    console.error('Error fetching projects:', err);
                    setProjectsError(getErrorMessage(err, 'Failed to load projects'));
                }
            } finally {
                if (!cancelled) setProjectsLoading(false);
            }
        };
        fetchProjects();
        return () => { cancelled = true; };
    }, [user]);

    const refreshProjects = useCallback(async () => {
        try {
            const fetchedProjects = await getProjects();
            setProjects(fetchedProjects);
        } catch (err) {
            console.error('Error refreshing projects:', err);
            showToast(getErrorMessage(err));
        }
    }, []);

    const createTask = useCallback(async (projectKey, taskDTO, attachments = []) => {
        const newTask = await apiCreateTask(projectKey, taskDTO, attachments);
        await refreshProjects();
        return newTask;
    }, [refreshProjects]);

    const updateTask = useCallback(async (projectKey, taskKey, taskDTO, attachments = []) => {
        const updatedTask = await apiUpdateTask(projectKey, taskKey, taskDTO, attachments);
        await refreshProjects();
        return updatedTask;
    }, [refreshProjects]);

    const deleteTask = useCallback(async (projectKey, taskKey) => {
        await apiDeleteTask(projectKey, taskKey);
        await refreshProjects();
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

    const addUserToProject = useCallback(async (projectKey, userEmail) => {
        try {
            const foundUser = await getUserByEmail(userEmail);
            if (!foundUser) throw new Error('User not found');

            const projectToUpdate = projects.find(p => p.projectKey === projectKey);
            if (!projectToUpdate) throw new Error('Project not found');

            const updatedProjectDTO = {
                ...projectToUpdate,
                members: [...projectToUpdate.members, foundUser],
            };
            return await updateProject(projectKey, updatedProjectDTO);
        } catch (err) {
            const message = getErrorMessage(err);
            showToast(`Failed to add user: ${message}`);
            throw err;
        }
    }, [projects, updateProject]);

    const value = useMemo(() => ({
        projects,
        projectsLoading,
        projectsError,
        refreshProjects,
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
    }), [
        projects, projectsLoading, projectsError,
        refreshProjects,
        createTask, updateTask, deleteTask,
        createProject, updateProject, deleteProject,
        getComments, createComment, updateComment,
        deleteComment, reactToComment,
        addUserToProject,
    ]);

    return (
        <ProjectsContext.Provider value={value}>
            {children}
        </ProjectsContext.Provider>
    );
};
