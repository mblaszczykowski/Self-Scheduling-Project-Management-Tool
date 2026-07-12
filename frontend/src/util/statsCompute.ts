import { MS_PER_DAY } from './helpers';
import { computeProjectProgress } from './projectUtils';
import { Project, Task } from '../types';

// Pure, presentation-agnostic scheduling/statistics computations used by the
// dashboard. Kept out of the hook layer so they're plain, unit-testable
// functions rather than React state.

type TaskMap = Record<string, Task>;

/* ── Task counts / distributions ── */

export const computeTaskCounts = (allTasks: Task[], taskKeyMap: TaskMap, today: Date) => {
    const tasksPerStatus: Record<string, number> = {};
    const tasksPerAssignee: Record<string, number> = {};
    const tasksByPriority: Record<string, number> = {};

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
        const dueDate = new Date(t.dueDate as string);
        return dueDate < today && t.progress < 100;
    }).length;

    const tasksDelayedByDependency = allTasks.filter(task => {
        if (!task.dependencies?.length) return false;
        return task.dependencies.some(depKey => {
            const dep = taskKeyMap[depKey];
            return dep && new Date(dep.dueDate as string) < today && dep.progress < 100;
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

export const computeCriticalPathHealth = (allTasks: Task[], today: Date) => {
    const criticalTasksList = allTasks.filter(t => t.isCritical);
    const activeCriticalTasks = criticalTasksList.filter(t => t.progress < 100);

    const criticalOnTime = criticalTasksList.filter(t => {
        const dueDate = new Date(t.dueDate as string);
        return t.progress === 100 || dueDate >= today;
    }).length;

    const criticalDelayed = criticalTasksList.filter(t => {
        const dueDate = new Date(t.dueDate as string);
        return dueDate < today && t.progress < 100;
    });

    const criticalAtRisk = criticalTasksList.filter(t => {
        const dueDate = new Date(t.dueDate as string);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / MS_PER_DAY);
        const expectedProgress = t.startDate
            ? ((today.getTime() - new Date(t.startDate).getTime()) / (dueDate.getTime() - new Date(t.startDate).getTime())) * 100
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

export const computeCriticalPathTimeline = (projects: Project[], today: Date) => {
    return projects.map(project => {
        const projectCriticalTasks = project.tasks?.filter(t => t.isCritical) || [];
        if (projectCriticalTasks.length === 0) return null;

        const dueDates = projectCriticalTasks.map(t => new Date(t.dueDate as string).getTime());
        const startDates = projectCriticalTasks.map(t => new Date(t.startDate as string).getTime());
        const earliestStart = new Date(Math.min(...startDates));
        const latestDue = new Date(Math.max(...dueDates));
        const criticalPathDays = Math.ceil((latestDue.getTime() - earliestStart.getTime()) / MS_PER_DAY);

        const delayedCritical = projectCriticalTasks.filter(t => {
            const dueDate = new Date(t.dueDate as string);
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
    })
        .filter((p): p is NonNullable<typeof p> => p != null)
        .sort((a, b) => b.criticalPathDays - a.criticalPathDays);
};

export const computeOverdueCriticalByProject = (projects: Project[], today: Date) => {
    return projects.map(project => {
        const overdueCritical = project.tasks?.filter(task => {
            const dueDate = new Date(task.dueDate as string);
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

export const computeUpcomingCriticalDeadlines = (criticalTasksList: Task[], today: Date) => {
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    return criticalTasksList.filter(task => {
        const dueDate = new Date(task.dueDate as string);
        return dueDate >= today && dueDate <= nextWeek && task.progress < 100;
    }).sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime());
};

export const computeNearCriticalTasks = (allTasks: Task[], today: Date) => {
    // Task keys that a critical task depends on — built once (O(n)) instead of a
    // nested scan per task (O(n^2)).
    const blocksCritical = new Set<string>();
    allTasks.forEach(t => {
        if (t.isCritical) t.dependencies?.forEach(depKey => blocksCritical.add(depKey));
    });

    return allTasks.filter(task => {
        if (task.isCritical || task.progress === 100) return false;

        const dueDate = new Date(task.dueDate as string);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / MS_PER_DAY);

        return (daysUntilDue <= 5 && daysUntilDue > 0) || blocksCritical.has(task.taskKey);
    });
};

export const computeCriticalWorkload = (
    criticalTasksList: Task[],
    tasksPerAssignee: Record<string, number>,
    today: Date,
) => {
    return Object.entries(tasksPerAssignee)
        .filter(([assignee]) => assignee !== 'Unassigned')
        .map(([assignee]) => {
            const criticalAssigned = criticalTasksList.filter(t =>
                t.assignee === assignee && t.progress < 100
            );
            const criticalOverdue = criticalAssigned.filter(t => {
                const dueDate = new Date(t.dueDate as string);
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

export const computeBlockedTasks = (allTasks: Task[], taskKeyMap: TaskMap) => {
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

export const computeCrossProjectDependencies = (projects: Project[]) => {
    return projects
        .filter(p => p.dependencies && p.dependencies.length > 0)
        .map(project => ({
            projectKey: project.projectKey,
            summary: project.summary,
            dependsOn: project.dependencies?.map((dep: any) => ({
                key: dep.projectKey || dep,
                summary: projects.find(pr => pr.projectKey === dep.projectKey || pr.id === dep)?.summary,
            })) || [],
            dependencyCount: project.dependencies!.length,
        }));
};

export const computeProjectCompletion = (projects: Project[]) => {
    return projects.map(project => ({
        projectKey: project.projectKey,
        summary: project.summary,
        completionPercentage: computeProjectProgress(project.tasks),
    }));
};
