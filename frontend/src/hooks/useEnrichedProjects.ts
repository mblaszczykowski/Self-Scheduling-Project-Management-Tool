import { useMemo } from 'react';
import { isOverdue, isUpcomingDeadline, calculateDuration } from '../util/helpers';
import { computeProjectDateRange, computeProjectProgress } from '../util/projectUtils';
import { Project, Task, EnrichedTask, ProcessedProject } from '../types';

export function useEnrichedProjects(projects: Project[]) {
    const enriched = useMemo(() => {
        const allTasks: EnrichedTask[] = [];
        const taskKeyToTaskMap = new Map<string, EnrichedTask>();
        const projectKeyToProject = new Map<string, ProcessedProject>();

        // First pass: build enriched tasks per project
        const processedProjects: ProcessedProject[] = projects.map(project => {
            const enrichedTasks: EnrichedTask[] = (project.tasks || []).map((task: Task) => {
                const progress = task.progress ?? 0;
                const delayed = isOverdue(task.dueDate, progress);
                const upcoming = !delayed && isUpcomingDeadline(task.dueDate);

                const enriched: EnrichedTask = {
                    ...task,
                    projectKey: project.projectKey,
                    projectSummary: project.summary,
                    taskKey: task.taskKey,
                    reporter: (typeof task.reporter === 'string' ? task.reporter : task.reporter?.email) || 'N/A',
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

            const sortedTasks = [...enrichedTasks].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

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
