import { MS_PER_DAY } from './helpers';
import { schedulePercentElapsed, timeOf } from './scheduleAnalysis';
import { EnrichedTask, ProcessedProject } from '../types';

// Pure, presentation-agnostic critical-path statistics for the dashboard. Kept out of the hook
// layer so they're plain, unit-testable functions rather than React state. The scheduling-focused
// half of the dashboard's maths lives in `scheduleAnalysis`.
//
// Everything here reads `EnrichedTask.isDelayed` instead of comparing due dates itself: whether a
// task counts as late is decided once, in `useEnrichedProjects`, for the whole app.

/* ── Task counts ── */

export const computeTaskCounts = (allTasks: EnrichedTask[]) => ({
    criticalTasks: allTasks.filter(t => t.isCritical).length,
    delayedTasks: allTasks.filter(t => t.isDelayed).length,
});

/* ── Critical path ── */

/** Progress a task with no start date is assumed to be expected at, for want of anything better. */
const ASSUMED_EXPECTED_PROGRESS = 50;

export const computeCriticalPathHealth = (allTasks: EnrichedTask[], today: Date) => {
    const criticalTasksList = allTasks.filter(t => t.isCritical);
    const criticalDelayed = criticalTasksList.filter(t => t.isDelayed);

    // Due soon, unfinished, and already behind where its own dates say it should be.
    const criticalAtRisk = criticalTasksList.filter(t => {
        if (!t.isUpcomingDeadline || t.progress >= 100) return false;
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

export const computeCriticalPathTimeline = (projects: ProcessedProject[]) => {
    return projects.map(project => {
        const criticalTasks = project.tasks.filter(t => t.isCritical);
        if (criticalTasks.length === 0) return null;

        const starts = criticalTasks.map(t => timeOf(t.startDate)).filter((t): t is number => t !== null);
        const dues = criticalTasks.map(t => timeOf(t.dueDate)).filter((t): t is number => t !== null);
        const criticalPathDays = starts.length > 0 && dues.length > 0
            ? Math.ceil((Math.max(...dues) - Math.min(...starts)) / MS_PER_DAY)
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
        .filter((p): p is NonNullable<typeof p> => p != null)
        .sort((a, b) => b.criticalPathDays - a.criticalPathDays);
};

const DEADLINE_HORIZON_DAYS = 7;

export const computeUpcomingCriticalDeadlines = (criticalTasksList: EnrichedTask[], today: Date) => {
    const horizon = today.getTime() + DEADLINE_HORIZON_DAYS * MS_PER_DAY;

    return criticalTasksList
        .filter(task => {
            const due = timeOf(task.dueDate);
            return due !== null && due >= today.getTime() && due <= horizon && task.progress < 100;
        })
        .sort((a, b) => (timeOf(a.dueDate) ?? 0) - (timeOf(b.dueDate) ?? 0));
};

/* ── Blocked tasks / cross-project deps / completion ── */

export const computeBlockedTasks = (allTasks: EnrichedTask[], taskByKey: Map<string, EnrichedTask>) => {
    const blockedTasks = allTasks.filter(task => {
        if (task.progress >= 100) return false;
        return task.dependencies.some(depKey => {
            const dep = taskByKey.get(depKey);
            return dep !== undefined && dep.progress < 100;
        });
    });

    return { blockedTasks, blockedCriticalTasks: blockedTasks.filter(t => t.isCritical) };
};

export const computeCrossProjectDependencies = (projects: ProcessedProject[]) => {
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

export const computeProjectCompletion = (projects: ProcessedProject[]) => {
    return projects.map(project => ({
        projectKey: project.projectKey,
        summary: project.summary,
        completionPercentage: project.projectProgress,
    }));
};
