import { useMemo } from 'react';
import { isOverdue, isUpcomingDeadline, calculateDuration } from '../util/helpers';
import { computeProjectDateRange, computeProjectProgress } from '../util/projectUtils';

export function useEnrichedProjects(projects) {
    const enriched = useMemo(() => {
        const allTasks = [];
        const taskKeyToTaskMap = new Map();
        const projectKeyToProject = new Map();

        // First pass: build enriched tasks per project
        const processedProjects = projects.map(project => {
            const enrichedTasks = (project.tasks || []).map(task => {
                const progress = task.progress ?? 0;
                const delayed = isOverdue(task.dueDate, progress);
                const upcoming = !delayed && isUpcomingDeadline(task.dueDate);

                const enriched = {
                    ...task,
                    projectKey: project.projectKey,
                    projectSummary: project.summary,
                    taskKey: task.taskKey,
                    reporter: task.reporter?.email || 'N/A',
                    duration: calculateDuration(task.startDate, task.dueDate),
                    labels: Array.isArray(task.labels) ? task.labels : [],
                    dependencies: task.dependencyKeys || [],
                    progress,
                    isDelayed: delayed,
                    isUpcomingDeadline: upcoming,
                    isDelayedByDependency: false,
                };

                taskKeyToTaskMap.set(enriched.taskKey, enriched);
                return enriched;
            });

            const sortedTasks = [...enrichedTasks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

            const { projectStartDate, projectDueDate } = computeProjectDateRange(sortedTasks);
            const projectProgress = computeProjectProgress(sortedTasks);

            const processed = { ...project, tasks: sortedTasks, projectStartDate, projectDueDate, projectProgress };
            projectKeyToProject.set(project.projectKey, processed);
            return processed;
        });

        // Second pass: compute isDelayedByDependency and build allTasks sorted by id
        processedProjects.forEach(project => {
            project.tasks.forEach(task => {
                task.isDelayedByDependency = task.dependencies.some(depKey => taskKeyToTaskMap.get(depKey)?.isDelayed);
                allTasks.push(task);
            });
        });

        allTasks.sort((a, b) => a.id - b.id);

        return { allTasks, processedProjects, taskKeyToTaskMap, projectKeyToProject };
    }, [projects]);

    const projectRowOffsets = useMemo(() => {
        let offset = 0;
        return enriched.processedProjects.map(p => {
            const current = offset;
            offset += p.tasks.length;
            return current;
        });
    }, [enriched.processedProjects]);

    return { ...enriched, projectRowOffsets };
}
