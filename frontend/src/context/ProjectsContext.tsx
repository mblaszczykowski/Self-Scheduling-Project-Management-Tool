import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createProject as apiCreateProject,
    createTask as apiCreateTask,
    deleteProject as apiDeleteProject,
    deleteTask as apiDeleteTask,
    getProjects,
    updateProject as apiUpdateProject,
    updateTask as apiUpdateTask,
    updateTaskSchedule as apiUpdateTaskSchedule,
} from '../util/api';
import { getErrorMessage } from '../util/helpers';
import { showToast } from '../util/toast';
import { useAuth } from './AuthContext';
import { Project, ProjectPayload, Task, TaskPayload } from '../types';

interface ProjectsContextValue {
    projects: Project[];
    projectsLoading: boolean;
    projectsError: string | null;
    /** Forces a fetch. For a user-initiated retry; ordinary mutations invalidate instead. */
    retryProjects: () => Promise<void>;
    createTask: (projectKey: string, payload: TaskPayload, attachments?: File[]) => Promise<Task>;
    updateTask: (projectKey: string, taskKey: string, payload: TaskPayload, attachments?: File[]) => Promise<Task>;
    /** Moves a task in time only — cannot clear the fields it does not send. */
    updateTaskSchedule: (projectKey: string, taskKey: string, startDate: string, dueDate: string) => Promise<Task>;
    deleteTask: (projectKey: string, taskKey: string) => Promise<void>;
    createProject: (payload: ProjectPayload, attachments?: File[]) => Promise<Project>;
    updateProject: (projectKey: string, payload: ProjectPayload, attachments?: File[]) => Promise<Project>;
    deleteProject: (projectKey: string) => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | undefined>(undefined);

export const useProjects = (): ProjectsContextValue => {
    const context = useContext(ProjectsContext);
    if (!context) throw new Error('useProjects must be used within a ProjectsProvider');
    return context;
};

export const PROJECTS_QUERY_KEY = ['projects'] as const;

/** One page big enough for a real portfolio; the server clamps it to its own maximum. */
const PROJECTS_PAGE_SIZE = 100;

export const ProjectsProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Server state is owned by react-query: caching, request dedup and background refetch replace
    // a manual useState/useEffect fetch. The context's public shape hides that from consumers.
    const { data, isLoading: projectsLoading, error } = useQuery({
        queryKey: PROJECTS_QUERY_KEY,
        queryFn: () => getProjects(0, PROJECTS_PAGE_SIZE),
        enabled: !!user,
    });

    const projects = data?.content ?? [];
    const projectsError = error ? getErrorMessage(error, 'Failed to load projects') : null;

    // Drop cached projects on logout so a different account cannot briefly see them.
    useEffect(() => {
        if (!user) queryClient.removeQueries({ queryKey: PROJECTS_QUERY_KEY });
    }, [user, queryClient]);

    const invalidateProjects = useCallback(
        () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }),
        [queryClient]
    );

    const retryProjects = useCallback(async () => {
        try {
            await queryClient.refetchQueries({ queryKey: PROJECTS_QUERY_KEY });
        } catch (err) {
            showToast(getErrorMessage(err));
        }
    }, [queryClient]);

    const createTask = useCallback(async (projectKey: string, payload: TaskPayload, attachments: File[] = []) => {
        const task = await apiCreateTask(projectKey, payload, attachments);
        await invalidateProjects();
        return task;
    }, [invalidateProjects]);

    const updateTask = useCallback(async (projectKey: string, taskKey: string, payload: TaskPayload, attachments: File[] = []) => {
        const task = await apiUpdateTask(projectKey, taskKey, payload, attachments);
        await invalidateProjects();
        return task;
    }, [invalidateProjects]);

    const updateTaskSchedule = useCallback(async (projectKey: string, taskKey: string, startDate: string, dueDate: string) => {
        const task = await apiUpdateTaskSchedule(projectKey, taskKey, startDate, dueDate);
        await invalidateProjects();
        return task;
    }, [invalidateProjects]);

    const deleteTask = useCallback(async (projectKey: string, taskKey: string) => {
        await apiDeleteTask(projectKey, taskKey);
        await invalidateProjects();
    }, [invalidateProjects]);

    const createProject = useCallback(async (payload: ProjectPayload, attachments: File[] = []) => {
        const project = await apiCreateProject(payload, attachments);
        await invalidateProjects();
        return project;
    }, [invalidateProjects]);

    const updateProject = useCallback(async (projectKey: string, payload: ProjectPayload, attachments: File[] = []) => {
        const project = await apiUpdateProject(projectKey, payload, attachments);
        await invalidateProjects();
        return project;
    }, [invalidateProjects]);

    const deleteProject = useCallback(async (projectKey: string) => {
        await apiDeleteProject(projectKey);
        await invalidateProjects();
    }, [invalidateProjects]);

    const value = useMemo(() => ({
        projects,
        projectsLoading,
        projectsError,
        retryProjects,
        createTask,
        updateTask,
        updateTaskSchedule,
        deleteTask,
        createProject,
        updateProject,
        deleteProject,
    }), [
        projects, projectsLoading, projectsError, retryProjects,
        createTask, updateTask, updateTaskSchedule, deleteTask,
        createProject, updateProject, deleteProject,
    ]);

    return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
};
