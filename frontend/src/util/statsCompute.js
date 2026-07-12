import { MS_PER_DAY } from './helpers';
import { computeProjectProgress } from './projectUtils';

// Pure, presentation-agnostic scheduling/statistics computations used by the
// dashboard. Kept out of the hook layer so they're plain, unit-testable
// functions rather than React state.

/* ── Task counts / distributions ── */

export const computeTaskCounts = (allTasks, taskKeyMap, today) => {
    const tasksPerStatus = {};
    const tasksPerAssignee = {};
    const tasksByPriority = {};

    allTasks.forEach(task => {
        const status = task.status || 'Unspecified';
        const assignee = task.assignee || 'Unassigned';
        const priority = task.priority || 'MEDIUM';

        tasksPerStatus[status] = (tasksPerStatus[status] || 0) + 1;
        tasksPerAssignee[assignee] = (tasksPerAssignee[assignee] || 0) + 1;
        tasksByPriority[priority] = (tasksByPriority[priority] || 0) + 1;
    });

    const criticalTasks = allTasks.filter(t => t.isCritical).length;
    const delayedTasks = allTasks.filter(t => {
        const dueDate = new Date(t.dueDate);
        return dueDate < today && t.progress < 100;
    }).length;

    const tasksDelayedByDependency = allTasks.filter(task => {
        if (!task.dependencies?.length) return false;
        return task.dependencies.some(depKey => {
            const dep = taskKeyMap[depKey];
            return dep && new Date(dep.dueDate) < today && dep.progress < 100;
        });
    });

    return {
        tasksPerStatus,
        tasksPerAssignee,
        tasksByPriority,
        criticalTasks,
        delayedTasks,
        tasksDelayedByDependency,
    };
};

/* ── Critical path ── */

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
    // Task keys that a critical task depends on — built once (O(n)) instead of a
    // nested scan per task (O(n^2)).
    const blocksCritical = new Set();
    allTasks.forEach(t => {
        if (t.isCritical) t.dependencies?.forEach(depKey => blocksCritical.add(depKey));
    });

    return allTasks.filter(task => {
        if (task.isCritical || task.progress === 100) return false;

        const dueDate = new Date(task.dueDate);
        const daysUntilDue = Math.ceil((dueDate - today) / MS_PER_DAY);

        return (daysUntilDue <= 5 && daysUntilDue > 0) || blocksCritical.has(task.taskKey);
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

/* ── Blocked tasks / cross-project deps / completion ── */

export const computeBlockedTasks = (allTasks, taskKeyMap) => {
    const blockedTasks = allTasks.filter(task => {
        if (!task.dependencies?.length) return false;
        if (task.progress === 100) return false;

        return task.dependencies.some(depKey => {
            const dep = taskKeyMap[depKey];
            return dep && dep.progress < 100;
        });
    });

    const blockedCriticalTasks = blockedTasks.filter(t => t.isCritical);

    return { blockedTasks, blockedCriticalTasks };
};

export const computeCrossProjectDependencies = (projects) => {
    return projects
        .filter(p => p.dependencies && p.dependencies.length > 0)
        .map(project => ({
            projectKey: project.projectKey,
            summary: project.summary,
            dependsOn: project.dependencies?.map(dep => ({
                key: dep.projectKey || dep,
                summary: projects.find(pr => pr.projectKey === dep.projectKey || pr.id === dep)?.summary,
            })) || [],
            dependencyCount: project.dependencies.length,
        }));
};

export const computeProjectCompletion = (projects) => {
    return projects.map(project => ({
        projectKey: project.projectKey,
        summary: project.summary,
        completionPercentage: computeProjectProgress(project.tasks),
    }));
};
