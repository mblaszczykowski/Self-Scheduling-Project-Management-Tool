import { useMemo } from 'react';
import { MS_PER_DAY } from '../util/helpers';

const flattenProjectTasks = (projects) => {
    const today = new Date();
    const taskKeyMap = {};
    const allTasks = [];

    projects.forEach(project => {
        project.tasks?.forEach(task => {
            const progress = task.progress ?? 0;
            const dependencies = task.dependencyKeys || [];

            const taskData = {
                ...task,
                projectKey: project.projectKey,
                progress,
                dependencies,
            };

            allTasks.push(taskData);
            taskKeyMap[task.taskKey] = taskData;
        });
    });

    return { allTasks, taskKeyMap, today };
};

const computeTaskCounts = (allTasks, taskKeyMap, today) => {
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

const computeCriticalPathHealth = (allTasks, today) => {
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

const computeCriticalPathTimeline = (projects, today) => {
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

const computeOverdueCriticalByProject = (projects, today) => {
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

const computeBlockedTasks = (allTasks, taskKeyMap) => {
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

const computeCriticalWorkload = (criticalTasksList, tasksPerAssignee, today) => {
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

const computeNearCriticalTasks = (allTasks, today) => {
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

const computeCrossProjectDependencies = (projects) => {
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

const computeUpcomingCriticalDeadlines = (criticalTasksList, today) => {
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    return criticalTasksList.filter(task => {
        const dueDate = new Date(task.dueDate);
        return dueDate >= today && dueDate <= nextWeek && task.progress < 100;
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
};

const computeProjectCompletion = (projects) => {
    return projects.map(project => {
        const totalTasks = project.tasks?.length || 0;
        const totalProgress = project.tasks?.reduce((sum, t) => sum + (t.progress || 0), 0) || 0;

        return {
            projectKey: project.projectKey,
            summary: project.summary,
            completionPercentage: totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0,
        };
    });
};

export const useDashboardStats = (projects) => {
    return useMemo(() => {
        const { allTasks, taskKeyMap, today } = flattenProjectTasks(projects);

        const taskCounts = computeTaskCounts(allTasks, taskKeyMap, today);
        const criticalHealth = computeCriticalPathHealth(allTasks, today);
        const criticalPathTimeline = computeCriticalPathTimeline(projects, today);
        const overdueCriticalByProject = computeOverdueCriticalByProject(projects, today);
        const { blockedTasks, blockedCriticalTasks } = computeBlockedTasks(allTasks, taskKeyMap);
        const criticalWorkload = computeCriticalWorkload(
            criticalHealth.criticalTasksList,
            taskCounts.tasksPerAssignee,
            today
        );
        const nearCriticalTasks = computeNearCriticalTasks(allTasks, today);
        const crossProjectDeps = computeCrossProjectDependencies(projects);
        const upcomingCriticalDeadlines = computeUpcomingCriticalDeadlines(
            criticalHealth.criticalTasksList,
            today
        );
        const projectCompletion = computeProjectCompletion(projects);

        return {
            totalProjects: projects.length,
            totalTasks: allTasks.length,
            ...taskCounts,
            ...criticalHealth,
            criticalPathTimeline,
            overdueCriticalByProject,
            blockedTasks,
            blockedCriticalTasks,
            criticalWorkload,
            nearCriticalTasks,
            crossProjectDeps,
            upcomingCriticalDeadlines,
            projectCompletion,
        };
    }, [projects]);
};

export default useDashboardStats;
