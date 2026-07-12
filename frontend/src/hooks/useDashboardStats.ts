import { useMemo } from 'react';
import { MS_PER_DAY } from '../util/helpers';
import { flattenProjectTasks } from '../util/taskFlattening';
import { Project, Task } from '../types';
import {
    computeTaskCounts,
    computeCriticalPathHealth,
    computeCriticalPathTimeline,
    computeOverdueCriticalByProject,
    computeUpcomingCriticalDeadlines,
    computeNearCriticalTasks,
    computeCriticalWorkload,
    computeBlockedTasks,
    computeCrossProjectDependencies,
    computeProjectCompletion,
} from '../util/statsCompute';

type TaskMap = Record<string, Task>;

interface ScheduleEntry {
    taskKey: string;
    start: number;
    end: number;
    isCritical?: boolean;
    priority?: string;
}
interface ResourceConflict {
    assignee: string;
    task1: string;
    task2: string;
    overlapDays: number;
    involvesCritical: boolean;
}
interface CpmNode {
    duration: number;
    deps: string[];
    successors: string[];
    es: number;
    ef: number;
    ls: number;
    lf: number;
    slack: number;
}
interface OptimizationFactor {
    label: string;
    value: number;
    impact: string;
}
interface AssigneeLoad {
    assignee: string;
    total: number;
    critical: number;
    overdue: number;
    blocked: number;
    totalRemaining: number;
    conflicts?: number;
}
type BehindTask = Task & { gap: number; expected: number };

/* ── New scheduling-focused computations ── */

/** Detect resource conflicts: days where an assignee has overlapping tasks */
const computeResourceConflicts = (allTasks: Task[]) => {
    const assigneeSchedule: Record<string, ScheduleEntry[]> = {};
    const activeTasks = allTasks.filter(t => t.startDate && t.dueDate && t.progress < 100 && t.assignee);

    activeTasks.forEach(task => {
        const key = task.assignee as string;
        if (!assigneeSchedule[key]) assigneeSchedule[key] = [];
        assigneeSchedule[key].push({
            taskKey: task.taskKey,
            start: new Date(task.startDate as string).getTime(),
            end: new Date(task.dueDate as string).getTime(),
            isCritical: task.isCritical,
            priority: task.priority,
        });
    });

    const conflicts: ResourceConflict[] = [];
    Object.entries(assigneeSchedule).forEach(([assignee, tasks]) => {
        if (tasks.length < 2) return;
        tasks.sort((a, b) => a.start - b.start);
        for (let i = 0; i < tasks.length; i++) {
            for (let j = i + 1; j < tasks.length; j++) {
                // Sorted by start: once task j starts at/after task i ends, no
                // later task can overlap i either.
                if (tasks[j].start >= tasks[i].end) break;
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
    });

    return {
        totalConflicts: conflicts.length,
        criticalConflicts: conflicts.filter(c => c.involvesCritical).length,
        conflicts: conflicts.sort((a, b) => b.overlapDays - a.overlapDays),
        affectedAssignees: [...new Set(conflicts.map(c => c.assignee))],
    };
};

/** Schedule health: for each active task, how far behind expected progress */
const computeScheduleHealth = (allTasks: Task[], today: Date) => {
    const active = allTasks.filter(t => t.startDate && t.dueDate && t.progress < 100);
    let onTrack = 0, slightlyBehind = 0, behind = 0, criticallyBehind = 0, notStarted = 0;
    const behindTasks: BehindTask[] = [];

    active.forEach(task => {
        const start = new Date(task.startDate as string);
        const due = new Date(task.dueDate as string);
        if (today < start) { notStarted++; return; }
        const totalDays = Math.max((due.getTime() - start.getTime()) / MS_PER_DAY, 1);
        const elapsed = (today.getTime() - start.getTime()) / MS_PER_DAY;
        const expected = Math.min(Math.round((elapsed / totalDays) * 100), 100);
        const gap = expected - (task.progress ?? 0);

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
const computeDependencyChainAnalysis = (allTasks: Task[], taskKeyMap: TaskMap) => {
    // Build dependency graph
    const dependents: Record<string, string[]> = {}; // taskKey -> tasks that depend on it
    allTasks.forEach(task => {
        task.dependencies?.forEach(depKey => {
            if (!dependents[depKey]) dependents[depKey] = [];
            dependents[depKey].push(task.taskKey);
        });
    });

    // Find longest chain via DFS with memoization
    const chainMemo: Record<string, number> = {};
    const getChainLength = (taskKey: string, visited: Set<string> = new Set()): number => {
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
        .filter(b => b.task && (b.task.progress ?? 0) < 100)
        .sort((a, b) => b.dependentCount - a.dependentCount)
        .slice(0, 5);

    return { longestChainLength, bottlenecks };
};

/** Required velocity per project: how much daily progress is needed to finish on time */
const computeProjectVelocity = (projects: Project[], today: Date) => {
    return projects.map(project => {
        const activeTasks = (project.tasks || []).filter(t =>
            t.startDate && t.dueDate && t.progress < 100
        );
        if (activeTasks.length === 0) return null;

        let totalRemaining = 0;
        let totalDaysLeft = 0;
        let urgentCount = 0;

        activeTasks.forEach(task => {
            const due = new Date(task.dueDate as string);
            const daysLeft = Math.max(0, (due.getTime() - today.getTime()) / MS_PER_DAY);
            const remaining = 100 - (task.progress ?? 0);
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
    })
        .filter((p): p is NonNullable<typeof p> => p != null)
        .sort((a, b) => b.avgVelocityNeeded - a.avgVelocityNeeded);
};

/** Status distribution: count tasks per status */
const computeStatusDistribution = (allTasks: Task[]) => {
    const counts: Record<string, number> = {};
    allTasks.forEach(task => {
        const status = task.status || 'BACKLOG';
        counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
};

/** Priority distribution: count tasks per priority */
const computePriorityDistribution = (allTasks: Task[]) => {
    const counts: Record<string, number> = {};
    allTasks.forEach(task => {
        const priority = task.priority || 'MEDIUM';
        counts[priority] = (counts[priority] || 0) + 1;
    });
    return counts;
};

/** Completion trend: weekly completed tasks over the past 8 weeks */
const computeCompletionTrend = (allTasks: Task[], today: Date) => {
    const weeks: Array<{ start: Date; end: Date; count: number }> = [];
    const MS_PER_WEEK = 7 * MS_PER_DAY;

    // Anchor at end-of-day so tasks updated "today" land in the most recent bucket
    const anchor = new Date(today);
    anchor.setHours(23, 59, 59, 999);

    for (let i = 7; i >= 0; i--) {
        const weekEnd = new Date(anchor.getTime() - i * MS_PER_WEEK);
        const weekStart = new Date(weekEnd.getTime() - MS_PER_WEEK);
        weeks.push({ start: weekStart, end: weekEnd, count: 0 });
    }

    const completedStatuses = new Set(['DONE', 'RELEASED']);
    allTasks.forEach(task => {
        if (!completedStatuses.has(task.status as string)) return;
        const updated = task.updated ? new Date(task.updated).getTime() : null;
        if (!updated) return;
        for (const week of weeks) {
            if (updated >= week.start.getTime() && updated <= week.end.getTime()) {
                week.count++;
                break;
            }
        }
    });

    return weeks.map(w => ({
        label: `${w.end.getMonth() + 1}/${w.end.getDate()}`,
        count: w.count,
    }));
};

/** Slack distribution: run CPM forward/backward pass to compute totalFloat per task */
const computeSlackDistribution = (allTasks: Task[], _taskKeyMap: TaskMap) => {
    const scheduled = allTasks.filter(t => t.startDate && t.dueDate && t.progress < 100);
    if (scheduled.length === 0) return { buckets: [], avgSlack: 0, zeroSlackCount: 0, totalScheduled: 0 };

    // Build graph with day offsets from earliest start
    const dates = scheduled.map(t => new Date(t.startDate as string).getTime());
    const epoch = Math.min(...dates);
    const dayOf = (d: string) => Math.round((new Date(d).getTime() - epoch) / MS_PER_DAY);

    const scheduledKeys = new Set(scheduled.map(t => t.taskKey));
    const nodes: Record<string, CpmNode> = {};
    for (const t of scheduled) {
        const start = dayOf(t.startDate as string);
        const due = dayOf(t.dueDate as string);
        nodes[t.taskKey] = {
            duration: Math.max(due - start + 1, 1),
            deps: (t.dependencies || []).filter(d => scheduledKeys.has(d)),
            successors: [] as string[],
            es: 0, ef: 0, ls: 0, lf: 0, slack: 0,
        };
    }

    // Build successor links
    for (const [key, node] of Object.entries(nodes)) {
        for (const dep of node.deps) {
            if (nodes[dep]) nodes[dep].successors.push(key);
        }
    }

    // Forward pass (topological via Kahn's)
    const inDeg: Record<string, number> = {};
    for (const [k, n] of Object.entries(nodes)) inDeg[k] = n.deps.filter((d: string) => nodes[d]).length;
    const queue = Object.keys(nodes).filter(k => inDeg[k] === 0);
    const order: string[] = [];
    while (queue.length > 0) {
        const k = queue.shift() as string;
        order.push(k);
        for (const s of nodes[k].successors) {
            inDeg[s]--;
            if (inDeg[s] === 0) queue.push(s);
        }
    }

    for (const k of order) {
        const n = nodes[k];
        let maxPredFinish = 0;
        for (const dep of n.deps) {
            if (nodes[dep]) maxPredFinish = Math.max(maxPredFinish, nodes[dep].ef);
        }
        n.es = maxPredFinish;
        n.ef = n.es + n.duration;
    }

    // Backward pass
    const projectFinish = Math.max(...Object.values(nodes).map(n => n.ef));
    for (let i = order.length - 1; i >= 0; i--) {
        const n = nodes[order[i]];
        if (n.successors.length === 0) {
            n.lf = projectFinish;
        } else {
            n.lf = Math.min(...n.successors.map((s: string) => nodes[s].ls));
        }
        n.ls = n.lf - n.duration;
        n.slack = Math.max(0, n.ls - n.es);
    }

    // Bucket into ranges
    const slackValues = Object.values(nodes).map(n => n.slack);
    const zeroSlackCount = slackValues.filter(s => s === 0).length;
    const avgSlack = slackValues.length > 0 ? Math.round(slackValues.reduce((a, b) => a + b, 0) / slackValues.length) : 0;

    const ranges = [
        { label: '0 days', min: 0, max: 0, color: '#ef4444' },
        { label: '1-2 days', min: 1, max: 2, color: '#f97316' },
        { label: '3-5 days', min: 3, max: 5, color: '#eab308' },
        { label: '6-10 days', min: 6, max: 10, color: '#22c55e' },
        { label: '10+ days', min: 11, max: Infinity, color: '#3b82f6' },
    ];

    const buckets = ranges.map(r => ({
        ...r,
        count: slackValues.filter(s => s >= r.min && s <= r.max).length,
    }));

    return { buckets, avgSlack, zeroSlackCount, totalScheduled: scheduled.length };
};

/** Optimization opportunity score: how much could the optimizer improve things */
const computeOptimizationOpportunity = (
    resourceConflicts: ReturnType<typeof computeResourceConflicts>,
    scheduleHealth: ReturnType<typeof computeScheduleHealth>,
    allTasks: Task[],
    today: Date,
) => {
    const active = allTasks.filter(t => t.startDate && t.dueDate && t.progress < 100);
    if (active.length === 0) {
        return { score: 0, factors: [] as OptimizationFactor[], recommendation: 'No active tasks to optimize' };
    }

    const factors: OptimizationFactor[] = [];
    let rawScore = 0;

    // Factor 1: Resource conflicts (big opportunity)
    const conflicts = resourceConflicts.totalConflicts;
    if (conflicts > 0) {
        const conflictScore = Math.min(conflicts * 12, 35);
        rawScore += conflictScore;
        factors.push({ label: 'Resource conflicts', value: conflicts, impact: conflictScore > 20 ? 'high' : 'medium' });
    }

    // Factor 2: Tasks behind schedule
    const behind = scheduleHealth.behind + scheduleHealth.criticallyBehind;
    if (behind > 0) {
        const behindScore = Math.min(behind * 8, 30);
        rawScore += behindScore;
        factors.push({ label: 'Tasks behind schedule', value: behind, impact: behindScore > 15 ? 'high' : 'medium' });
    }

    // Factor 3: Overdue tasks
    const overdue = active.filter(t => new Date(t.dueDate as string) < today).length;
    if (overdue > 0) {
        const overdueScore = Math.min(overdue * 10, 25);
        rawScore += overdueScore;
        factors.push({ label: 'Overdue tasks', value: overdue, impact: overdueScore > 15 ? 'high' : 'medium' });
    }

    // Factor 4: Critical conflicts specifically
    const critConflicts = resourceConflicts.criticalConflicts;
    if (critConflicts > 0) {
        const critScore = Math.min(critConflicts * 15, 20);
        rawScore += critScore;
        factors.push({ label: 'Critical path conflicts', value: critConflicts, impact: 'high' });
    }

    const score = Math.min(Math.round(rawScore), 100);

    const recommendation = score >= 70 ? 'Strongly recommended — significant improvements possible'
        : score >= 40 ? 'Recommended — moderate scheduling improvements available'
        : score >= 15 ? 'Optional — minor improvements possible'
        : 'Schedule looks good — optimization not needed';

    return { score, factors, recommendation };
};

/** Assignee load: total active tasks, critical tasks, overdue, and conflict count */
const computeAssigneeLoad = (
    allTasks: Task[],
    resourceConflicts: ReturnType<typeof computeResourceConflicts>,
    today: Date,
) => {
    const load: Record<string, AssigneeLoad> = {};
    allTasks.filter(t => t.assignee && t.progress < 100).forEach(task => {
        const key = task.assignee as string;
        if (!load[key]) load[key] = { assignee: key, total: 0, critical: 0, overdue: 0, blocked: 0, totalRemaining: 0 };
        load[key].total++;
        if (task.isCritical) load[key].critical++;
        if (task.dueDate && new Date(task.dueDate) < today) load[key].overdue++;
        load[key].totalRemaining += (100 - (task.progress ?? 0));
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

export const useDashboardStats = (projects: Project[]) => {
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
        const statusDistribution = computeStatusDistribution(allTasks);
        const priorityDistribution = computePriorityDistribution(allTasks);
        const completionTrend = computeCompletionTrend(allTasks, today);
        const slackDistribution = computeSlackDistribution(allTasks, taskKeyMap);
        const optimizationOpportunity = computeOptimizationOpportunity(resourceConflicts, scheduleHealth, allTasks, today);

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
            statusDistribution,
            priorityDistribution,
            completionTrend,
            slackDistribution,
            optimizationOpportunity,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projects, todayStr]);
};

export type DashboardStats = ReturnType<typeof useDashboardStats>;

export default useDashboardStats;
