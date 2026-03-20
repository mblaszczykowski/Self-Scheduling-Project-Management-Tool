import { useMemo } from 'react';
import { flattenProjectTasks } from '../util/taskFlattening';
import { computeTaskCounts } from './useTaskCounts';
import {
    computeCriticalPathHealth,
    computeCriticalPathTimeline,
    computeOverdueCriticalByProject,
    computeUpcomingCriticalDeadlines,
    computeNearCriticalTasks,
    computeCriticalWorkload,
} from './useCriticalPathStats';
import {
    computeBlockedTasks,
    computeCrossProjectDependencies,
    computeProjectCompletion,
} from './useBlockedTaskStats';

export const useDashboardStats = (projects) => {
    const todayStr = new Date().toDateString();
    return useMemo(() => {
        const { allTasks, taskKeyMap } = flattenProjectTasks(projects);
        const today = new Date(todayStr);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projects, todayStr]);
};

export default useDashboardStats;
