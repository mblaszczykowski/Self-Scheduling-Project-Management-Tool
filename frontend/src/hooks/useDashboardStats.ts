import { useMemo } from 'react';
import { useEnrichedProjects } from './useEnrichedProjects';
import {
    computeBlockedTasks,
    computeCriticalPathHealth,
    computeCriticalPathTimeline,
    computeCrossProjectDependencies,
    computeProjectCompletion,
    computeTaskCounts,
    computeUpcomingCriticalDeadlines,
} from '../util/statsCompute';
import {
    computeAssigneeLoad,
    computeCompletionTrend,
    computeDependencyChainAnalysis,
    computeOptimizationOpportunity,
    computePriorityDistribution,
    computeProjectVelocity,
    computeResourceConflicts,
    computeScheduleHealth,
    computeSlackDistribution,
    computeStatusDistribution,
} from '../util/scheduleAnalysis';

export type EnrichedProjects = ReturnType<typeof useEnrichedProjects>;

export const useDashboardStats = ({ processedProjects, allTasks, taskKeyToTaskMap }: EnrichedProjects) => {
    const todayStr = new Date().toDateString();

    return useMemo(() => {
        const today = new Date(todayStr);

        const criticalHealth = computeCriticalPathHealth(allTasks, today);
        const resourceConflicts = computeResourceConflicts(allTasks);
        const scheduleHealth = computeScheduleHealth(allTasks, today);

        return {
            ...computeTaskCounts(allTasks),
            criticalHealth,
            blocked: computeBlockedTasks(allTasks, taskKeyToTaskMap),
            criticalPathTimeline: computeCriticalPathTimeline(processedProjects),
            crossProjectDeps: computeCrossProjectDependencies(processedProjects),
            upcomingCriticalDeadlines: computeUpcomingCriticalDeadlines(criticalHealth.criticalTasksList, today),
            projectCompletion: computeProjectCompletion(processedProjects),
            resourceConflicts,
            scheduleHealth,
            dependencyAnalysis: computeDependencyChainAnalysis(allTasks, taskKeyToTaskMap),
            projectVelocity: computeProjectVelocity(processedProjects, today),
            assigneeLoad: computeAssigneeLoad(allTasks),
            statusDistribution: computeStatusDistribution(allTasks),
            priorityDistribution: computePriorityDistribution(allTasks),
            completionTrend: computeCompletionTrend(allTasks, today),
            slackDistribution: computeSlackDistribution(allTasks),
            optimizationOpportunity: computeOptimizationOpportunity(resourceConflicts, scheduleHealth, allTasks),
        };
    }, [processedProjects, allTasks, taskKeyToTaskMap, todayStr]);
};

export type DashboardStats = ReturnType<typeof useDashboardStats>;

export default useDashboardStats;
