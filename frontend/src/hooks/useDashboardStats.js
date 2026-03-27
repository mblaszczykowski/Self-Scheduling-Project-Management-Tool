import { useMemo } from 'react';
import { MS_PER_DAY } from '../util/helpers';
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

/* ── New scheduling-focused computations ── */

/** Detect resource conflicts: days where an assignee has overlapping tasks */
const computeResourceConflicts = (allTasks) => {
    const assigneeSchedule = {};
    const activeTasks = allTasks.filter(t => t.startDate && t.dueDate && t.progress < 100 && t.assignee);

    activeTasks.forEach(task => {
        const key = task.assignee;
        if (!assigneeSchedule[key]) assigneeSchedule[key] = [];
        assigneeSchedule[key].push({
            taskKey: task.taskKey,
            start: new Date(task.startDate).getTime(),
            end: new Date(task.dueDate).getTime(),
            isCritical: task.isCritical,
            priority: task.priority,
        });
    });

    const conflicts = [];
    Object.entries(assigneeSchedule).forEach(([assignee, tasks]) => {
        if (tasks.length < 2) return;
        tasks.sort((a, b) => a.start - b.start);
        for (let i = 0; i < tasks.length; i++) {
            for (let j = i + 1; j < tasks.length; j++) {
                if (tasks[j].start < tasks[i].end) {
                    const overlapDays = Math.ceil(
                        (Math.min(tasks[i].end, tasks[j].end) - tasks[j].start) / MS_PER_DAY
                    );
                    if (overlapDays > 0) {
                        conflicts.push({
                            assignee,
                            task1: tasks[i].taskKey,
                            task2: tasks[j].taskKey,
                            overlapDays,
                            involvesCritical: tasks[i].isCritical || tasks[j].isCritical,
                        });
                    }
                }
            }
        }
    });

    return {
        totalConflicts: conflicts.length,
        criticalConflicts: conflicts.filter(c => c.involvesCritical).length,
        conflicts: conflicts.sort((a, b) => b.overlapDays - a.overlapDays),
        affectedAssignees: [...new Set(conflicts.map(c => c.assignee))],
    };
};

/** Schedule health: for each active task, how far behind expected progress */
const computeScheduleHealth = (allTasks, today) => {
    const active = allTasks.filter(t => t.startDate && t.dueDate && t.progress < 100);
    let onTrack = 0, slightlyBehind = 0, behind = 0, criticallyBehind = 0, notStarted = 0;
    const behindTasks = [];

    active.forEach(task => {
        const start = new Date(task.startDate);
        const due = new Date(task.dueDate);
        if (today < start) { notStarted++; return; }
        const totalDays = Math.max((due - start) / MS_PER_DAY, 1);
        const elapsed = (today - start) / MS_PER_DAY;
        const expected = Math.min(Math.round((elapsed / totalDays) * 100), 100);
        const gap = expected - task.progress;

        if (gap <= 0) onTrack++;
        else if (gap <= 15) slightlyBehind++;
        else if (gap <= 30) { behind++; behindTasks.push({ ...task, gap, expected }); }
        else { criticallyBehind++; behindTasks.push({ ...task, gap, expected }); }
    });

    const total = active.length || 1;
    const score = Math.round(((onTrack + notStarted + slightlyBehind * 0.7) / total) * 100);

    return {
        scheduleHealthScore: Math.min(score, 100),
        onTrack, slightlyBehind, behind, criticallyBehind, notStarted,
        totalActive: active.length,
        worstBehind: behindTasks.sort((a, b) => b.gap - a.gap).slice(0, 5),
    };
};

/** Longest dependency chain and bottleneck tasks (most dependents) */
const computeDependencyChainAnalysis = (allTasks, taskKeyMap) => {
    // Build dependency graph
    const dependents = {}; // taskKey -> tasks that depend on it
    allTasks.forEach(task => {
        task.dependencies?.forEach(depKey => {
            if (!dependents[depKey]) dependents[depKey] = [];
            dependents[depKey].push(task.taskKey);
        });
    });

    // Find longest chain via DFS with memoization
    const chainMemo = {};
    const getChainLength = (taskKey, visited = new Set()) => {
        if (chainMemo[taskKey] !== undefined) return chainMemo[taskKey];
        if (visited.has(taskKey)) return 0; // cycle guard
        visited.add(taskKey);
        const deps = taskKeyMap[taskKey]?.dependencies || [];
        let maxDepth = 0;
        deps.forEach(depKey => {
            maxDepth = Math.max(maxDepth, getChainLength(depKey, visited) + 1);
        });
        chainMemo[taskKey] = maxDepth;
        return maxDepth;
    };

    allTasks.forEach(t => getChainLength(t.taskKey));
    const longestChainLength = Math.max(0, ...Object.values(chainMemo));

    // Bottleneck tasks: most downstream dependents
    const bottlenecks = Object.entries(dependents)
        .map(([taskKey, deps]) => ({
            taskKey,
            task: taskKeyMap[taskKey],
            dependentCount: deps.length,
            isCritical: taskKeyMap[taskKey]?.isCritical,
            progress: taskKeyMap[taskKey]?.progress ?? 0,
        }))
        .filter(b => b.task && b.task.progress < 100)
        .sort((a, b) => b.dependentCount - a.dependentCount)
        .slice(0, 5);

    return { longestChainLength, bottlenecks };
};

/** Required velocity per project: how much daily progress is needed to finish on time */
const computeProjectVelocity = (projects, today) => {
    return projects.map(project => {
        const activeTasks = (project.tasks || []).filter(t =>
            t.startDate && t.dueDate && t.progress < 100
        );
        if (activeTasks.length === 0) return null;

        let totalRemaining = 0;
        let totalDaysLeft = 0;
        let urgentCount = 0;

        activeTasks.forEach(task => {
            const due = new Date(task.dueDate);
            const daysLeft = Math.max(0, (due - today) / MS_PER_DAY);
            const remaining = 100 - task.progress;
            totalRemaining += remaining;
            totalDaysLeft += daysLeft;
            if (daysLeft > 0 && (remaining / daysLeft) > 15) urgentCount++;
        });

        const avgVelocityNeeded = totalDaysLeft > 0
            ? Math.round(totalRemaining / totalDaysLeft)
            : 999;

        return {
            projectKey: project.projectKey,
            activeTasks: activeTasks.length,
            avgVelocityNeeded,
            urgentCount,
            status: avgVelocityNeeded <= 5 ? 'comfortable'
                : avgVelocityNeeded <= 10 ? 'moderate'
                : avgVelocityNeeded <= 20 ? 'tight'
                : 'critical',
        };
    }).filter(Boolean).sort((a, b) => b.avgVelocityNeeded - a.avgVelocityNeeded);
};

/** Assignee load: total active tasks, critical tasks, overdue, and conflict count */
const computeAssigneeLoad = (allTasks, resourceConflicts, today) => {
    const load = {};
    allTasks.filter(t => t.assignee && t.progress < 100).forEach(task => {
        const key = task.assignee;
        if (!load[key]) load[key] = { assignee: key, total: 0, critical: 0, overdue: 0, blocked: 0, totalRemaining: 0 };
        load[key].total++;
        if (task.isCritical) load[key].critical++;
        if (task.dueDate && new Date(task.dueDate) < today) load[key].overdue++;
        load[key].totalRemaining += (100 - task.progress);
    });

    // Add conflict counts
    resourceConflicts.affectedAssignees.forEach(assignee => {
        if (load[assignee]) {
            load[assignee].conflicts = resourceConflicts.conflicts.filter(c => c.assignee === assignee).length;
        }
    });

    return Object.values(load)
        .sort((a, b) => (b.critical * 10 + b.overdue * 5 + b.total) - (a.critical * 10 + a.overdue * 5 + a.total))
        .slice(0, 8);
};

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

        // New scheduling-focused stats
        const resourceConflicts = computeResourceConflicts(allTasks);
        const scheduleHealth = computeScheduleHealth(allTasks, today);
        const dependencyAnalysis = computeDependencyChainAnalysis(allTasks, taskKeyMap);
        const projectVelocity = computeProjectVelocity(projects, today);
        const assigneeLoad = computeAssigneeLoad(allTasks, resourceConflicts, today);

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
            // New
            resourceConflicts,
            scheduleHealth,
            dependencyAnalysis,
            projectVelocity,
            assigneeLoad,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projects, todayStr]);
};

export default useDashboardStats;
