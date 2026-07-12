import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Project, Task, TaskDTO, ProjectDTO } from '../types';

interface ProjectsContextValue {
    projects: Project[];
    projectsLoading: boolean;
    projectsError: string | null;
    refreshProjects: () => Promise<void>;
    createTask: (projectKey: string, taskDTO: TaskDTO, attachments?: File[]) => Promise<Task>;
    updateTask: (projectKey: string, taskKey: string, taskDTO: TaskDTO, attachments?: File[]) => Promise<Task>;
    deleteTask: (projectKey: string, taskKey: string) => Promise<void>;
    createProject: (projectDTO: ProjectDTO, attachments?: File[]) => Promise<Project>;
    updateProject: (projectKey: string, projectDTO: ProjectDTO, attachments?: File[]) => Promise<Project>;
    deleteProject: (projectKey: string) => Promise<void>;
    addUserToProject: (projectKey: string, userEmail: string) => Promise<Project>;
}

export const ProjectsContext = createContext<ProjectsContextValue | undefined>(undefined);

export const useProjects = () => {
    const context = useContext(ProjectsContext);
    if (!context) throw new Error('useProjects must be used within a ProjectsProvider');
    return context;
};

const PROJECTS_KEY = ['projects'];

export const ProjectsProvider = ({ children }: { children: React.ReactNode }) => {
    const user = useContext(AuthContext)?.user ?? null;
    const queryClient = useQueryClient();

    // Server state is owned by react-query: caching, request dedup, and background
    // refetch replace the previous manual useState/useEffect fetch. The context's
    // public shape is unchanged so consumers don't need to know.
    const { data: projects = [], isLoading: projectsLoading, error } = useQuery<Project[]>({
        queryKey: PROJECTS_KEY,
        queryFn: getProjects,
        enabled: !!user,
    });

    const projectsError = error ? getErrorMessage(error, 'Failed to load projects') : null;

    // Drop cached projects on logout so a different account can't briefly see them.
    useEffect(() => {
        if (!user) queryClient.removeQueries({ queryKey: PROJECTS_KEY });
    }, [user, queryClient]);

    const setProjectsData = useCallback(
        (updater: (old: Project[]) => Project[]) =>
            queryClient.setQueryData<Project[]>(PROJECTS_KEY, (old: Project[] = []) => updater(old)),
        [queryClient]
    );

    const invalidateProjects = useCallback(
        () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
        [queryClient]
    );

    const refreshProjects = useCallback(async () => {
        try {
            await queryClient.refetchQueries({ queryKey: PROJECTS_KEY });
        } catch (err) {
            console.error('Error refreshing projects:', err);
            showToast(getErrorMessage(err));
        }
    }, [queryClient]);

    const createTask = useCallback(async (projectKey: string, taskDTO: TaskDTO, attachments: File[] = []) => {
        const newTask = await apiCreateTask(projectKey, taskDTO, attachments);
        await invalidateProjects();
        return newTask;
    }, [invalidateProjects]);

    const updateTask = useCallback(async (projectKey: string, taskKey: string, taskDTO: TaskDTO, attachments: File[] = []) => {
        const updatedTask = await apiUpdateTask(projectKey, taskKey, taskDTO, attachments);
        await invalidateProjects();
        return updatedTask;
    }, [invalidateProjects]);

    const deleteTask = useCallback(async (projectKey: string, taskKey: string) => {
        await apiDeleteTask(projectKey, taskKey);
        await invalidateProjects();
    }, [invalidateProjects]);

    const createProject = useCallback(async (projectDTO: ProjectDTO, attachments: File[] = []) => {
        const newProject = await apiCreateProject(projectDTO, attachments);
        setProjectsData(prev => [...prev, newProject]);
        return newProject;
    }, [setProjectsData]);

    const updateProject = useCallback(async (projectKey: string, projectDTO: ProjectDTO, attachments: File[] = []) => {
        const updatedProject = await apiUpdateProject(projectKey, projectDTO, attachments);
        setProjectsData(prev => prev.map(p =>
            // Merge rather than replace: if the PUT response omits nested `tasks`,
            // keep the ones we already have so the timeline/list don't blank out.
            p.projectKey === projectKey
                ? { ...p, ...updatedProject, tasks: updatedProject.tasks ?? p.tasks }
                : p
        ));
        return updatedProject;
    }, [setProjectsData]);

    const deleteProject = useCallback(async (projectKey: string) => {
        await apiDeleteProject(projectKey);
        setProjectsData(prev => prev.filter(p => p.projectKey !== projectKey));
    }, [setProjectsData]);

    const addUserToProject = useCallback(async (projectKey: string, userEmail: string) => {
        try {
            const foundUser = await getUserByEmail(userEmail);
            if (!foundUser) throw new Error('User not found');

            const projectToUpdate = projects.find((p: Project) => p.projectKey === projectKey);
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
