import { useMemo } from 'react';
import { MS_PER_DAY } from '../util/helpers';
import { flattenProjectTasks } from '../util/taskFlattening';

export const computeCriticalPathHealth = (allTasks, today) => {
    const criticalTasksList = allTasks.filter(t => t.isCritical);
    const activeCriticalTasks = criticalTasksList.filter(t => t.progress < 100);

    const criticalOnTime = criticalTasksList.filter(t => {
        const dueDate = new Date(t.dueDate);
        return t.progress === 100 || dueDate >= today;
    }).length;

    const criticalDelayed = criticalTasksList.filter(t => {
        const dueDate = new Date(t.dueDate);
        return dueDate < today && t.progress < 100;
    });

    const criticalAtRisk = criticalTasksList.filter(t => {
        const dueDate = new Date(t.dueDate);
        const daysUntilDue = Math.ceil((dueDate - today) / MS_PER_DAY);
        const expectedProgress = t.startDate
            ? ((today - new Date(t.startDate)) / (dueDate - new Date(t.startDate))) * 100
            : 50;
        return daysUntilDue <= 3 && daysUntilDue > 0 && t.progress < expectedProgress && t.progress < 100;
    });

    const criticalHealthScore = criticalTasksList.length > 0
        ? Math.round((criticalOnTime / criticalTasksList.length) * 100)
        : 100;

    return {
        criticalTasksList,
        activeCriticalTasks,
        criticalOnTime,
        criticalDelayed,
        criticalAtRisk,
        criticalHealthScore,
    };
};

export const computeCriticalPathTimeline = (projects, today) => {
    return projects.map(project => {
        const projectCriticalTasks = project.tasks?.filter(t => t.isCritical) || [];
        if (projectCriticalTasks.length === 0) return null;

        const dueDates = projectCriticalTasks.map(t => new Date(t.dueDate));
        const startDates = projectCriticalTasks.map(t => new Date(t.startDate));
        const earliestStart = new Date(Math.min(...startDates));
        const latestDue = new Date(Math.max(...dueDates));
        const criticalPathDays = Math.ceil((latestDue - earliestStart) / MS_PER_DAY);

        const delayedCritical = projectCriticalTasks.filter(t => {
            const dueDate = new Date(t.dueDate);
            return dueDate < today && t.progress < 100;
        }).length;

        return {
            projectKey: project.projectKey,
            summary: project.summary,
            criticalPathDays,
            criticalTaskCount: projectCriticalTasks.length,
            delayedCritical,
            earliestStart,
            latestDue,
            status: delayedCritical > 0 ? 'delayed' : 'ontrack',
        };
    }).filter(Boolean).sort((a, b) => b.criticalPathDays - a.criticalPathDays);
};

export const computeOverdueCriticalByProject = (projects, today) => {
    return projects.map(project => {
        const overdueCritical = project.tasks?.filter(task => {
            const dueDate = new Date(task.dueDate);
            return task.isCritical && dueDate < today && task.progress < 100;
        }) || [];

        return {
            projectKey: project.projectKey,
            summary: project.summary,
            overdueCount: overdueCritical.length,
            overdueTasks: overdueCritical,
        };
    }).filter(p => p.overdueCount > 0).sort((a, b) => b.overdueCount - a.overdueCount);
};

export const computeUpcomingCriticalDeadlines = (criticalTasksList, today) => {
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    return criticalTasksList.filter(task => {
        const dueDate = new Date(task.dueDate);
        return dueDate >= today && dueDate <= nextWeek && task.progress < 100;
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
};

export const computeNearCriticalTasks = (allTasks, today) => {
    return allTasks.filter(task => {
        if (task.isCritical || task.progress === 100) return false;

        const dueDate = new Date(task.dueDate);
        const daysUntilDue = Math.ceil((dueDate - today) / MS_PER_DAY);
        const blocksCriticalTasks = allTasks.some(t =>
            t.dependencies?.includes(task.taskKey) && t.isCritical
        );

        return (daysUntilDue <= 5 && daysUntilDue > 0) || blocksCriticalTasks;
    });
};

export const computeCriticalWorkload = (criticalTasksList, tasksPerAssignee, today) => {
    return Object.entries(tasksPerAssignee)
        .filter(([assignee]) => assignee !== 'Unassigned')
        .map(([assignee]) => {
            const criticalAssigned = criticalTasksList.filter(t =>
                t.assignee === assignee && t.progress < 100
            );
            const criticalOverdue = criticalAssigned.filter(t => {
                const dueDate = new Date(t.dueDate);
                return dueDate < today;
            });

            return {
                assignee,
                criticalCount: criticalAssigned.length,
                criticalOverdue: criticalOverdue.length,
                tasks: criticalAssigned,
            };
        })
        .filter(w => w.criticalCount > 0)
        .sort((a, b) => b.criticalCount - a.criticalCount);
};

/**
 * Hook that computes all critical-path-related statistics from projects.
 * @param {Array} projects
 * @returns {Object} Critical path health, timeline, overdue, deadlines, near-critical, workload
 */
export const useCriticalPathStats = (projects) => {
    const todayStr = new Date().toDateString();
    return useMemo(() => {
        const { allTasks } = flattenProjectTasks(projects);
        const today = new Date(todayStr);

        const criticalHealth = computeCriticalPathHealth(allTasks, today);
        const criticalPathTimeline = computeCriticalPathTimeline(projects, today);
        const overdueCriticalByProject = computeOverdueCriticalByProject(projects, today);
        const nearCriticalTasks = computeNearCriticalTasks(allTasks, today);
        const upcomingCriticalDeadlines = computeUpcomingCriticalDeadlines(
            criticalHealth.criticalTasksList,
            today
        );

        // Note: criticalWorkload requires tasksPerAssignee from useTaskCounts,
        // so it's not included here when used standalone. The facade provides it.
        return {
            ...criticalHealth,
            criticalPathTimeline,
            overdueCriticalByProject,
            nearCriticalTasks,
            upcomingCriticalDeadlines,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projects, todayStr]);
};
