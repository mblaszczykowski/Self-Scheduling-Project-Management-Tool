import { MS_PER_DAY } from './helpers';
import { EnrichedTask, ProcessedProject, TaskPriority, TaskStatus } from '../types';

// Scheduling analysis behind the dashboard's cards: resource contention, schedule health, the CPM
// slack pass, and the distributions the charts read.
//
// Like `statsCompute`, these live outside the hook layer so they stay plain, unit-testable
// functions. Two rules keep them honest:
//
//  - They take `EnrichedTask`, never `Task`. "Delayed", "due soon" and "blocked by a late
//    dependency" are decided once, in `useEnrichedProjects`, and only read here — so the dashboard
//    and the projects page cannot drift apart on what those words mean.
//  - They return no presentation values. Colours belong to the card that draws them; a bucket or a
//    status is identified here by a stable id instead.

/** Epoch millis for a date string, or null when it is absent or unparseable. */
export const timeOf = (date?: string | null): number | null => {
    if (!date) return null;
    const parsed = new Date(date).getTime();
    return Number.isNaN(parsed) ? null : parsed;
};

/**
 * How far through its planned span a task should be by `today`, in percent — the yardstick every
 * "behind schedule" judgement here uses. Negative before the start date; null when the task has no
 * span to measure against. A one-day floor on the span keeps same-day tasks finite.
 */
export const schedulePercentElapsed = (
    task: Pick<EnrichedTask, 'startDate' | 'dueDate'>,
    today: Date,
): number | null => {
    const start = timeOf(task.startDate);
    const due = timeOf(task.dueDate);
    if (start === null || due === null) return null;
    const spanDays = Math.max((due - start) / MS_PER_DAY, 1);
    return ((today.getTime() - start) / MS_PER_DAY / spanDays) * 100;
};

/* ── Resource conflicts ── */

interface ScheduleEntry {
    taskKey: string;
    start: number;
    end: number;
    isCritical: boolean;
}

export interface ResourceConflict {
    assignee: string;
    task1: string;
    task2: string;
    overlapDays: number;
    involvesCritical: boolean;
}

export interface ResourceConflicts {
    totalConflicts: number;
    criticalConflicts: number;
    conflicts: ResourceConflict[];
    affectedAssignees: string[];
}

/** Pairs of unfinished tasks that book the same assignee on overlapping days. */
export const computeResourceConflicts = (allTasks: EnrichedTask[]): ResourceConflicts => {
    const schedulePerAssignee = new Map<string, ScheduleEntry[]>();

    for (const task of allTasks) {
        const assignee = task.assignee;
        const start = timeOf(task.startDate);
        const end = timeOf(task.dueDate);
        if (!assignee || start === null || end === null || task.progress >= 100) continue;

        const entries = schedulePerAssignee.get(assignee);
        const entry: ScheduleEntry = { taskKey: task.taskKey, start, end, isCritical: task.isCritical === true };
        if (entries) entries.push(entry);
        else schedulePerAssignee.set(assignee, [entry]);
    }

    const conflicts: ResourceConflict[] = [];
    schedulePerAssignee.forEach((entries, assignee) => {
        if (entries.length < 2) return;
        entries.sort((a, b) => a.start - b.start);
        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                // Sorted by start: once entry j starts at/after entry i ends, no later entry can
                // overlap i either.
                if (entries[j].start >= entries[i].end) break;
                const overlapDays = Math.ceil(
                    (Math.min(entries[i].end, entries[j].end) - entries[j].start) / MS_PER_DAY
                );
                if (overlapDays > 0) {
                    conflicts.push({
                        assignee,
                        task1: entries[i].taskKey,
                        task2: entries[j].taskKey,
                        overlapDays,
                        involvesCritical: entries[i].isCritical || entries[j].isCritical,
                    });
                }
            }
        }
    });

    conflicts.sort((a, b) => b.overlapDays - a.overlapDays);

    return {
        totalConflicts: conflicts.length,
        criticalConflicts: conflicts.filter(c => c.involvesCritical).length,
        conflicts,
        affectedAssignees: [...new Set(conflicts.map(c => c.assignee))],
    };
};

/* ── Schedule health ── */

export interface BehindTask {
    taskKey: string;
    progress: number;
    expected: number;
    /** Percentage points of progress the task is short of where its dates say it should be. */
    gap: number;
}

export interface ScheduleHealth {
    scheduleHealthScore: number;
    onTrack: number;
    slightlyBehind: number;
    behind: number;
    criticallyBehind: number;
    notStarted: number;
    totalActive: number;
    worstBehind: BehindTask[];
}

const SLIGHTLY_BEHIND_GAP = 15;
const BEHIND_GAP = 30;

/** Progress against time elapsed, per unfinished task with a planned span. */
export const computeScheduleHealth = (allTasks: EnrichedTask[], today: Date): ScheduleHealth => {
    let onTrack = 0, slightlyBehind = 0, behind = 0, criticallyBehind = 0, notStarted = 0, totalActive = 0;
    const behindTasks: BehindTask[] = [];

    for (const task of allTasks) {
        if (task.progress >= 100) continue;
        const elapsed = schedulePercentElapsed(task, today);
        if (elapsed === null) continue;

        totalActive++;
        if (elapsed < 0) { notStarted++; continue; }

        const expected = Math.min(Math.round(elapsed), 100);
        const gap = expected - task.progress;

        if (gap <= 0) onTrack++;
        else if (gap <= SLIGHTLY_BEHIND_GAP) slightlyBehind++;
        else {
            if (gap <= BEHIND_GAP) behind++;
            else criticallyBehind++;
            behindTasks.push({ taskKey: task.taskKey, progress: task.progress, expected, gap });
        }
    }

    // Slightly-behind work counts as partial credit; anything worse counts for nothing.
    const score = Math.round(((onTrack + notStarted + slightlyBehind * 0.7) / (totalActive || 1)) * 100);
    behindTasks.sort((a, b) => b.gap - a.gap);

    return {
        scheduleHealthScore: Math.min(score, 100),
        onTrack, slightlyBehind, behind, criticallyBehind, notStarted,
        totalActive,
        worstBehind: behindTasks.slice(0, 5),
    };
};

/* ── Dependency chains ── */

export interface Bottleneck {
    taskKey: string;
    summary: string;
    isCritical: boolean;
    progress: number;
    dependentCount: number;
}

export interface DependencyChainAnalysis {
    longestChainLength: number;
    bottlenecks: Bottleneck[];
}

/** Deepest dependency chain, plus the unfinished tasks the most other work waits on. */
export const computeDependencyChainAnalysis = (
    allTasks: EnrichedTask[],
    taskByKey: Map<string, EnrichedTask>,
): DependencyChainAnalysis => {
    const dependentCounts = new Map<string, number>();
    for (const task of allTasks) {
        for (const depKey of task.dependencies) {
            dependentCounts.set(depKey, (dependentCounts.get(depKey) ?? 0) + 1);
        }
    }

    // Memoised DFS. `onStack` is a path, not a visited set: a key has to be removed on the way back
    // up, or a diamond-shaped graph would have its second branch cut short and under-report depth.
    const depthByKey = new Map<string, number>();
    const chainDepth = (taskKey: string, onStack: Set<string>): number => {
        const memoised = depthByKey.get(taskKey);
        if (memoised !== undefined) return memoised;
        if (onStack.has(taskKey)) return 0; // cycle guard

        onStack.add(taskKey);
        let deepest = 0;
        for (const depKey of taskByKey.get(taskKey)?.dependencies ?? []) {
            deepest = Math.max(deepest, chainDepth(depKey, onStack) + 1);
        }
        onStack.delete(taskKey);

        depthByKey.set(taskKey, deepest);
        return deepest;
    };

    let longestChainLength = 0;
    for (const task of allTasks) {
        longestChainLength = Math.max(longestChainLength, chainDepth(task.taskKey, new Set()));
    }

    const bottlenecks: Bottleneck[] = [];
    dependentCounts.forEach((dependentCount, taskKey) => {
        const task = taskByKey.get(taskKey);
        if (!task || task.progress >= 100) return;
        bottlenecks.push({
            taskKey,
            summary: task.summary,
            isCritical: task.isCritical === true,
            progress: task.progress,
            dependentCount,
        });
    });
    bottlenecks.sort((a, b) => b.dependentCount - a.dependentCount);

    return { longestChainLength, bottlenecks: bottlenecks.slice(0, 5) };
};

/* ── Required velocity ── */

export type VelocityStatus = 'comfortable' | 'moderate' | 'tight' | 'critical';

export interface ProjectVelocity {
    projectKey: string;
    activeTasks: number;
    avgVelocityNeeded: number;
    urgentCount: number;
    status: VelocityStatus;
}

/** Stands in for an infinite rate when work remains but no time does. */
const VELOCITY_OUT_OF_TIME = 999;
const URGENT_VELOCITY = 15;

/** Progress per day each project still needs in order to hit its own due dates. */
export const computeProjectVelocity = (projects: ProcessedProject[], today: Date): ProjectVelocity[] => {
    const velocities: ProjectVelocity[] = [];

    for (const project of projects) {
        let activeTasks = 0;
        let totalRemaining = 0;
        let totalDaysLeft = 0;
        let urgentCount = 0;

        for (const task of project.tasks) {
            const due = timeOf(task.dueDate);
            if (!task.startDate || due === null || task.progress >= 100) continue;

            activeTasks++;
            const daysLeft = Math.max(0, (due - today.getTime()) / MS_PER_DAY);
            const remaining = 100 - task.progress;
            totalRemaining += remaining;
            totalDaysLeft += daysLeft;
            if (daysLeft > 0 && remaining / daysLeft > URGENT_VELOCITY) urgentCount++;
        }

        if (activeTasks === 0) continue;

        const avgVelocityNeeded = totalDaysLeft > 0
            ? Math.round(totalRemaining / totalDaysLeft)
            : VELOCITY_OUT_OF_TIME;

        velocities.push({
            projectKey: project.projectKey,
            activeTasks,
            avgVelocityNeeded,
            urgentCount,
            status: avgVelocityNeeded <= 5 ? 'comfortable'
                : avgVelocityNeeded <= 10 ? 'moderate'
                : avgVelocityNeeded <= 20 ? 'tight'
                : 'critical',
        });
    }

    return velocities.sort((a, b) => b.avgVelocityNeeded - a.avgVelocityNeeded);
};

/* ── Distributions ── */

export interface StatusCount {
    status: TaskStatus;
    count: number;
}

export interface PriorityCount {
    priority: TaskPriority;
    count: number;
}

/** Tasks per status, in order of first appearance, statuses with no tasks omitted. */
export const computeStatusDistribution = (allTasks: EnrichedTask[]): StatusCount[] => {
    const counts = new Map<TaskStatus, number>();
    for (const task of allTasks) {
        counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
    }
    return [...counts].map(([status, count]) => ({ status, count }));
};

/** Lowest-to-highest, so the chart reads as a scale rather than as arbitrary slices. */
const PRIORITY_ORDER: TaskPriority[] = ['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST'];

export const computePriorityDistribution = (allTasks: EnrichedTask[]): PriorityCount[] => {
    const counts = new Map<TaskPriority, number>();
    for (const task of allTasks) {
        counts.set(task.priority, (counts.get(task.priority) ?? 0) + 1);
    }
    return PRIORITY_ORDER
        .map(priority => ({ priority, count: counts.get(priority) ?? 0 }))
        .filter(entry => entry.count > 0);
};

/* ── Completion trend ── */

export interface CompletionWeek {
    label: string;
    count: number;
}

const COMPLETED_STATUSES = new Set<TaskStatus>(['DONE', 'RELEASED']);
const TREND_WEEKS = 8;

/** Tasks completed per week over the trailing eight weeks, oldest bucket first. */
export const computeCompletionTrend = (allTasks: EnrichedTask[], today: Date): CompletionWeek[] => {
    const msPerWeek = 7 * MS_PER_DAY;

    // Anchored at end-of-day so a task updated "today" lands in the most recent bucket.
    const anchor = new Date(today);
    anchor.setHours(23, 59, 59, 999);

    const weeks = Array.from({ length: TREND_WEEKS }, (_, i) => {
        const end = new Date(anchor.getTime() - (TREND_WEEKS - 1 - i) * msPerWeek);
        return { start: end.getTime() - msPerWeek, end: end.getTime(), label: `${end.getMonth() + 1}/${end.getDate()}`, count: 0 };
    });

    for (const task of allTasks) {
        if (!COMPLETED_STATUSES.has(task.status)) continue;
        const updated = timeOf(task.updated);
        if (updated === null) continue;
        const week = weeks.find(w => updated >= w.start && updated <= w.end);
        if (week) week.count++;
    }

    return weeks.map(({ label, count }) => ({ label, count }));
};

/* ── Slack distribution (CPM) ── */

export type SlackBucketId = 'none' | 'tight' | 'moderate' | 'comfortable' | 'ample';

export interface SlackBucket {
    id: SlackBucketId;
    label: string;
    count: number;
}

export interface SlackDistribution {
    buckets: SlackBucket[];
    avgSlack: number;
    zeroSlackCount: number;
    totalScheduled: number;
}

const SLACK_RANGES: Array<{ id: SlackBucketId; label: string; min: number; max: number }> = [
    { id: 'none', label: '0 days', min: 0, max: 0 },
    { id: 'tight', label: '1-2 days', min: 1, max: 2 },
    { id: 'moderate', label: '3-5 days', min: 3, max: 5 },
    { id: 'comfortable', label: '6-10 days', min: 6, max: 10 },
    { id: 'ample', label: '10+ days', min: 11, max: Infinity },
];

interface CpmNode {
    duration: number;
    deps: string[];
    successors: string[];
    earliestFinish: number;
    latestStart: number;
    slack: number;
}

const EMPTY_SLACK: SlackDistribution = { buckets: [], avgSlack: 0, zeroSlackCount: 0, totalScheduled: 0 };

/**
 * Total float per unfinished scheduled task, via a critical-path forward/backward pass.
 *
 * Dependencies on unscheduled tasks are dropped rather than treated as zero-duration predecessors:
 * a task nobody planned cannot constrain the plan. Kahn's algorithm gives the topological order and
 * silently leaves cyclic tasks out of it, which is what keeps a bad dependency graph from hanging
 * the pass — those tasks simply keep their initial slack of 0.
 */
export const computeSlackDistribution = (allTasks: EnrichedTask[]): SlackDistribution => {
    const scheduled = allTasks.filter(t => t.startDate && t.dueDate && t.progress < 100);
    if (scheduled.length === 0) return EMPTY_SLACK;

    const starts = scheduled.map(t => timeOf(t.startDate)).filter((t): t is number => t !== null);
    if (starts.length === 0) return EMPTY_SLACK;
    const epoch = Math.min(...starts);

    const scheduledKeys = new Set(scheduled.map(t => t.taskKey));
    const nodes = new Map<string, CpmNode>();
    for (const task of scheduled) {
        nodes.set(task.taskKey, {
            // `duration` is the inclusive day count `useEnrichedProjects` already derived; the floor
            // keeps a task with unparseable dates from collapsing the pass.
            duration: Math.max(task.duration, 1),
            deps: task.dependencies.filter(d => scheduledKeys.has(d)),
            successors: [],
            earliestFinish: 0,
            latestStart: 0,
            slack: 0,
        });
    }

    const inDegree = new Map<string, number>();
    nodes.forEach((node, key) => {
        inDegree.set(key, node.deps.length);
        for (const dep of node.deps) nodes.get(dep)?.successors.push(key);
    });

    // Forward pass in topological order (Kahn).
    const ready = [...nodes.keys()].filter(key => inDegree.get(key) === 0);
    const order: string[] = [];
    while (ready.length > 0) {
        const key = ready.shift();
        if (key === undefined) break;
        order.push(key);
        const node = nodes.get(key);
        if (!node) continue;
        for (const successor of node.successors) {
            const remaining = (inDegree.get(successor) ?? 0) - 1;
            inDegree.set(successor, remaining);
            if (remaining === 0) ready.push(successor);
        }
    }

    const earliestStartOf = new Map<string, number>();
    for (const key of order) {
        const node = nodes.get(key);
        if (!node) continue;
        let earliestStart = 0;
        for (const dep of node.deps) {
            earliestStart = Math.max(earliestStart, nodes.get(dep)?.earliestFinish ?? 0);
        }
        earliestStartOf.set(key, earliestStart);
        node.earliestFinish = earliestStart + node.duration;
    }

    // Backward pass over the same order, reversed.
    const projectFinish = Math.max(...[...nodes.values()].map(n => n.earliestFinish));
    for (let i = order.length - 1; i >= 0; i--) {
        const key = order[i];
        const node = nodes.get(key);
        if (!node) continue;
        const latestFinish = node.successors.length === 0
            ? projectFinish
            : Math.min(...node.successors.map(s => nodes.get(s)?.latestStart ?? projectFinish));
        node.latestStart = latestFinish - node.duration;
        node.slack = Math.max(0, node.latestStart - (earliestStartOf.get(key) ?? 0));
    }

    const slackValues = [...nodes.values()].map(n => n.slack);
    const zeroSlackCount = slackValues.filter(s => s === 0).length;
    const avgSlack = Math.round(slackValues.reduce((sum, s) => sum + s, 0) / slackValues.length);

    return {
        buckets: SLACK_RANGES.map(({ id, label, min, max }) => ({
            id,
            label,
            count: slackValues.filter(s => s >= min && s <= max).length,
        })),
        avgSlack,
        zeroSlackCount,
        totalScheduled: scheduled.length,
    };
};

/* ── Optimization opportunity ── */

export type FactorImpact = 'high' | 'medium';

export interface OptimizationFactor {
    label: string;
    value: number;
    impact: FactorImpact;
}

export interface OptimizationOpportunity {
    score: number;
    factors: OptimizationFactor[];
    recommendation: string;
}

/** How much room the schedule optimizer has to improve on the current plan, as a 0-100 score. */
export const computeOptimizationOpportunity = (
    resourceConflicts: ResourceConflicts,
    scheduleHealth: ScheduleHealth,
    allTasks: EnrichedTask[],
): OptimizationOpportunity => {
    if (scheduleHealth.totalActive === 0) {
        return { score: 0, factors: [], recommendation: 'No active tasks to optimize' };
    }

    const factors: OptimizationFactor[] = [];
    let rawScore = 0;

    // Each factor contributes points up to its own cap, so no single symptom can claim the whole
    // score; the caps are what set the relative weight of the four symptoms.
    const addFactor = (label: string, value: number, perUnit: number, cap: number, highAbove: number) => {
        if (value <= 0) return;
        const points = Math.min(value * perUnit, cap);
        rawScore += points;
        factors.push({ label, value, impact: points > highAbove ? 'high' : 'medium' });
    };

    addFactor('Resource conflicts', resourceConflicts.totalConflicts, 12, 35, 20);
    addFactor('Tasks behind schedule', scheduleHealth.behind + scheduleHealth.criticallyBehind, 8, 30, 15);
    addFactor('Overdue tasks', allTasks.filter(t => t.isDelayed).length, 10, 25, 15);
    addFactor('Critical path conflicts', resourceConflicts.criticalConflicts, 15, 20, 0);

    const score = Math.min(Math.round(rawScore), 100);

    const recommendation = score >= 70 ? 'Strongly recommended — significant improvements possible'
        : score >= 40 ? 'Recommended — moderate scheduling improvements available'
        : score >= 15 ? 'Optional — minor improvements possible'
        : 'Schedule looks good — optimization not needed';

    return { score, factors, recommendation };
};

/* ── Assignee load ── */

export interface AssigneeLoad {
    assignee: string;
    total: number;
    critical: number;
    overdue: number;
}

/** The eight most loaded assignees, weighted so critical and overdue work dominates the order. */
export const computeAssigneeLoad = (allTasks: EnrichedTask[]): AssigneeLoad[] => {
    const loadByAssignee = new Map<string, AssigneeLoad>();

    for (const task of allTasks) {
        const assignee = task.assignee;
        if (!assignee || task.progress >= 100) continue;

        let load = loadByAssignee.get(assignee);
        if (!load) {
            load = { assignee, total: 0, critical: 0, overdue: 0 };
            loadByAssignee.set(assignee, load);
        }
        load.total++;
        if (task.isCritical) load.critical++;
        if (task.isDelayed) load.overdue++;
    }

    const weight = (load: AssigneeLoad) => load.critical * 10 + load.overdue * 5 + load.total;

    return [...loadByAssignee.values()]
        .sort((a, b) => weight(b) - weight(a))
        .slice(0, 8);
};
