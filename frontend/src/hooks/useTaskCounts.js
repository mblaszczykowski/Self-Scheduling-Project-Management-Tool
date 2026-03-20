import { useMemo } from 'react';
import { flattenProjectTasks } from '../util/taskFlattening';

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

/**
 * Hook that computes task count metrics from projects.
 * @param {Array} projects
 * @returns {Object} Task count metrics including tasksPerStatus, tasksPerAssignee, etc.
 */
export const useTaskCounts = (projects) => {
    const todayStr = new Date().toDateString();
    return useMemo(() => {
        const { allTasks, taskKeyMap } = flattenProjectTasks(projects);
        const today = new Date(todayStr);
        return computeTaskCounts(allTasks, taskKeyMap, today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projects, todayStr]);
};
