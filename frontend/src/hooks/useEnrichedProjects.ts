import { useMemo } from 'react';
import { calculateDuration, isOverdue, isUpcomingDeadline } from '../util/helpers';
import { computeProjectDateRange, computeProjectProgress } from '../util/projectUtils';
import { EnrichedTask, ProcessedProject, Project } from '../types';

/** Epoch millis for a date string, or +Infinity when there is no date, so sorts stay total. */
const startOrder = (date?: string | null): number => {
    if (!date) return Number.POSITIVE_INFINITY;
    const parsed = new Date(date).getTime();
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
};

/**
 * Derives the display fields the timeline, list and dashboard all read from.
 *
 * <p>Both sorts here are guarded against missing and unparseable dates. A comparator that returns
 * NaN — which `new Date(undefined).getTime() - ...` does — leaves the sort order
 * implementation-defined rather than throwing, so the bug shows up as a list that is quietly in the
 * wrong order.
 */
export function useEnrichedProjects(projects: Project[]) {
    return useMemo(() => {
        const allTasks: EnrichedTask[] = [];
        const taskKeyToTaskMap = new Map<string, EnrichedTask>();
        const projectKeyToProject = new Map<string, ProcessedProject>();

        const processedProjects: ProcessedProject[] = projects.map((project) => {
            const enrichedTasks: EnrichedTask[] = (project.tasks ?? []).map((task) => {
                const progress = task.progress ?? 0;
                const delayed = isOverdue(task.dueDate, progress);

                const enriched: EnrichedTask = {
                    ...task,
                    projectKey: project.projectKey,
                    projectSummary: project.summary,
                    duration: calculateDuration(task.startDate, task.dueDate),
                    labels: task.labels ?? [],
                    dependencies: task.dependencyKeys ?? [],
                    progress,
                    isDelayed: delayed,
                    isUpcomingDeadline: !delayed && isUpcomingDeadline(task.dueDate),
                    isDelayedByDependency: false,
                };

                taskKeyToTaskMap.set(enriched.taskKey, enriched);
                return enriched;
            });

            const sortedTasks = [...enrichedTasks]
                .sort((a, b) => startOrder(a.startDate) - startOrder(b.startDate)
                    || a.taskKey.localeCompare(b.taskKey));

            const { projectStartDate, projectDueDate } = computeProjectDateRange(sortedTasks);

            const processed: ProcessedProject = {
                ...project,
                tasks: sortedTasks,
                projectStartDate,
                projectDueDate,
                projectProgress: computeProjectProgress(sortedTasks),
            };
            projectKeyToProject.set(project.projectKey, processed);
            return processed;
        });

        // Second pass: a task is blocked-by-a-late-dependency only once every task is known.
        processedProjects.forEach((project) => {
            project.tasks.forEach((task) => {
                task.isDelayedByDependency = task.dependencies
                    .some((dependencyKey) => taskKeyToTaskMap.get(dependencyKey)?.isDelayed === true);
                allTasks.push(task);
            });
        });

        allTasks.sort((a, b) => a.id - b.id);

        return { allTasks, processedProjects, taskKeyToTaskMap, projectKeyToProject };
    }, [projects]);
}
