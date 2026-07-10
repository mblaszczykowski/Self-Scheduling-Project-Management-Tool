import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    createProject as apiCreateProject,
    createTask as apiCreateTask,
    deleteProject as apiDeleteProject,
    deleteTask as apiDeleteTask,
    getProjects,
    getUserByEmail,
    updateProject as apiUpdateProject,
    updateTask as apiUpdateTask,
} from '../util/api';
import { showToast } from '../util/toast';
import { getErrorMessage } from '../util/helpers';
import { AuthContext } from './AuthContext';

export const ProjectsContext = createContext();

export const useProjects = () => {
    const context = useContext(ProjectsContext);
    if (!context) throw new Error('useProjects must be used within a ProjectsProvider');
    return context;
};

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
            // Merge rather than replace: if the PUT response omits nested `tasks`,
            // keep the ones we already have so the timeline/list don't blank out.
            p.projectKey === projectKey
                ? { ...p, ...updatedProject, tasks: updatedProject.tasks ?? p.tasks }
                : p
        ));
        return updatedProject;
    }, []);

    const deleteProject = useCallback(async (projectKey) => {
        await apiDeleteProject(projectKey);
        setProjects(prev => prev.filter(p => p.projectKey !== projectKey));
    }, []);

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
        addUserToProject,
    }), [
        projects, projectsLoading, projectsError,
        refreshProjects,
        createTask, updateTask, deleteTask,
        createProject, updateProject, deleteProject,
        addUserToProject,
    ]);

    return (
        <ProjectsContext.Provider value={value}>
            {children}
        </ProjectsContext.Provider>
    );
};
