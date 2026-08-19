import { dayIndex, isTaskComplete, MS_PER_DAY } from './helpers';
import { schedulePercentElapsed, timeOf } from './scheduleAnalysis';
import { EnrichedTask, ProcessedProject } from '../types';

// Pure, presentation-agnostic critical-path statistics for the dashboard. Kept out of the hook
// layer so they're plain, unit-testable functions rather than React state. The scheduling-focused
// half of the dashboard's maths lives in `scheduleAnalysis`.
//
// Everything here reads `EnrichedTask.isDelayed` instead of comparing due dates itself: whether a
// task counts as late is decided once, in `useEnrichedProjects`, for the whole app.

export interface TaskCounts {
    criticalTasks: number;
    delayedTasks: number;
}

export const computeTaskCounts = (allTasks: EnrichedTask[]): TaskCounts => ({
    criticalTasks: allTasks.filter(t => t.isCritical).length,
    delayedTasks: allTasks.filter(t => t.isDelayed).length,
});

export interface CriticalPathHealth {
    criticalTasksList: EnrichedTask[];
    criticalOnTime: number;
    criticalDelayed: EnrichedTask[];
    criticalAtRisk: EnrichedTask[];
    criticalHealthScore: number;
}

/** Progress a task with no start date is assumed to be expected at, for want of anything better. */
const ASSUMED_EXPECTED_PROGRESS = 50;

export const computeCriticalPathHealth = (allTasks: EnrichedTask[], today: Date): CriticalPathHealth => {
    const criticalTasksList = allTasks.filter(t => t.isCritical);
    const criticalDelayed = criticalTasksList.filter(t => t.isDelayed);

    // Due soon, unfinished, and already behind where its own dates say it should be.
    const criticalAtRisk = criticalTasksList.filter(t => {
        if (!t.isUpcomingDeadline || isTaskComplete(t.status, t.progress)) return false;
        const expected = schedulePercentElapsed(t, today) ?? ASSUMED_EXPECTED_PROGRESS;
        return t.progress < expected;
    });

    const criticalOnTime = criticalTasksList.length - criticalDelayed.length;
    const criticalHealthScore = criticalTasksList.length > 0
        ? Math.round((criticalOnTime / criticalTasksList.length) * 100)
        : 100;

    return {
        criticalTasksList,
        criticalOnTime,
        criticalDelayed,
        criticalAtRisk,
        criticalHealthScore,
    };
};

export interface CriticalPathProject {
    projectKey: string;
    summary: string;
    criticalPathDays: number;
    criticalTaskCount: number;
    delayedCritical: number;
    status: 'delayed' | 'ontrack';
}

export const computeCriticalPathTimeline = (projects: ProcessedProject[]): CriticalPathProject[] => {
    return projects.map((project): CriticalPathProject | null => {
        const criticalTasks = project.tasks.filter(t => t.isCritical);
        if (criticalTasks.length === 0) return null;

        const starts = criticalTasks.map(t => timeOf(t.startDate)).filter((t): t is number => t !== null);
        const dues = criticalTasks.map(t => timeOf(t.dueDate)).filter((t): t is number => t !== null);
        // Inclusive, matching calculateDuration: a critical path that starts and ends on the
        // same day is one day long, not zero.
        const criticalPathDays = starts.length > 0 && dues.length > 0
            ? Math.round((Math.max(...dues) - Math.min(...starts)) / MS_PER_DAY) + 1
            : 0;
        const delayedCritical = criticalTasks.filter(t => t.isDelayed).length;

        return {
            projectKey: project.projectKey,
            summary: project.summary,
            criticalPathDays,
            criticalTaskCount: criticalTasks.length,
            delayedCritical,
            status: delayedCritical > 0 ? 'delayed' : 'ontrack',
        };
    })
        .filter((p): p is CriticalPathProject => p !== null)
        .sort((a, b) => b.criticalPathDays - a.criticalPathDays);
};

const DEADLINE_HORIZON_DAYS = 7;

export const computeUpcomingCriticalDeadlines = (criticalTasksList: EnrichedTask[], today: Date): EnrichedTask[] => {
    // Whole calendar days: comparing a UTC-parsed due date against a local timestamp dropped
    // today's own deadlines west of Greenwich and made the window a day shorter east of it.
    const todayIndex = dayIndex(today);
    if (todayIndex === null) return [];

    return criticalTasksList
        .filter(task => {
            const due = dayIndex(task.dueDate);
            return due !== null && due >= todayIndex
                && due <= todayIndex + DEADLINE_HORIZON_DAYS
                && !isTaskComplete(task.status, task.progress);
        })
        .sort((a, b) => (timeOf(a.dueDate) ?? 0) - (timeOf(b.dueDate) ?? 0));
};

export interface BlockedTasks {
    blockedTasks: EnrichedTask[];
    blockedCriticalTasks: EnrichedTask[];
}

export const computeBlockedTasks = (allTasks: EnrichedTask[], taskByKey: Map<string, EnrichedTask>): BlockedTasks => {
    const blockedTasks = allTasks.filter(task => {
        if (isTaskComplete(task.status, task.progress)) return false;
        return task.dependencies.some(depKey => {
            const dep = taskByKey.get(depKey);
            // A cancelled or finished predecessor no longer blocks anything.
            return dep !== undefined && !isTaskComplete(dep.status, dep.progress);
        });
    });

    return { blockedTasks, blockedCriticalTasks: blockedTasks.filter(t => t.isCritical) };
};

export interface CrossProjectDependency {
    projectKey: string;
    summary: string;
    dependsOn: Array<{ key: string; summary?: string }>;
    dependencyCount: number;
}

export const computeCrossProjectDependencies = (projects: ProcessedProject[]): CrossProjectDependency[] => {
    const summaryByKey = new Map(projects.map(p => [p.projectKey, p.summary]));

    return projects
        .filter(p => p.dependencies.length > 0)
        .map(project => ({
            projectKey: project.projectKey,
            summary: project.summary,
            dependsOn: project.dependencies.map(key => ({ key, summary: summaryByKey.get(key) })),
            dependencyCount: project.dependencies.length,
        }));
};

export interface ProjectCompletion {
    projectKey: string;
    summary: string;
    completionPercentage: number;
}

export const computeProjectCompletion = (projects: ProcessedProject[]): ProjectCompletion[] => {
    return projects.map(project => ({
        projectKey: project.projectKey,
        summary: project.summary,
        completionPercentage: project.projectProgress,
    }));
};
