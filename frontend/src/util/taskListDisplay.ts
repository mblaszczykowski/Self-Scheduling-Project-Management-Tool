import { daysBetween, formatShortDate, isTaskComplete } from './helpers';
import { BEHIND_GAP, schedulePercentElapsed, SLIGHTLY_BEHIND_GAP } from './scheduleAnalysis';
import { EnrichedTask, TaskStatus } from '../types';

export interface RelativeDue {
    text: string;
    cls: string;
}

export const relativeDue = (
    dueDate: string | null | undefined,
    status: TaskStatus | null | undefined,
    progress: number,
    today: Date,
): RelativeDue => {
    if (!dueDate) return { text: '—', cls: 'text-slate-400' };
    if (isTaskComplete(status, progress)) {
        return { text: formatShortDate(dueDate), cls: 'text-slate-500 dark:text-slate-400' };
    }
    const diff = daysBetween(today, dueDate);
    if (diff < -1) return { text: `${Math.abs(diff)}d overdue`, cls: 'text-red-600 dark:text-red-400 font-semibold' };
    if (diff === -1) return { text: 'Yesterday', cls: 'text-red-600 dark:text-red-400 font-semibold' };
    if (diff === 0) return { text: 'Today', cls: 'text-amber-600 dark:text-amber-400 font-semibold' };
    if (diff === 1) return { text: 'Tomorrow', cls: 'text-amber-600 dark:text-amber-400' };
    if (diff <= 3) return { text: `in ${diff}d`, cls: 'text-amber-600 dark:text-amber-400' };
    if (diff <= 7) return { text: `in ${diff}d`, cls: 'text-slate-700 dark:text-slate-300' };
    return { text: formatShortDate(dueDate), cls: 'text-slate-500 dark:text-slate-400' };
};

export const getProgressColor = (task: EnrichedTask): string => {
    if (isTaskComplete(task.status, task.progress)) return 'bg-green-500';
    if (task.isDelayed) return 'bg-red-400';
    if (task.isUpcomingDeadline && task.progress < 80) return 'bg-amber-400';
    if (task.progress >= 50) return 'bg-blue-500';
    return 'bg-slate-300 dark:bg-slate-600';
};

export type ScheduleHealthStatus = 'not-started' | 'critical' | 'behind' | 'slight' | 'on-track';

export interface ScheduleHealth {
    status: ScheduleHealthStatus;
    label: string;
    expected: number;
}

export const computeScheduleHealth = (task: EnrichedTask, today: Date): ScheduleHealth | null => {
    if (!task.startDate || !task.dueDate || isTaskComplete(task.status, task.progress)) return null;
    const elapsedPercent = schedulePercentElapsed(task, today);
    if (elapsedPercent === null) return null;
    if (elapsedPercent < 0) return { status: 'not-started', label: 'Not started', expected: 0 };
    const expected = Math.min(Math.round(elapsedPercent), 100);
    const gap = expected - task.progress;
    if (gap > BEHIND_GAP) return { status: 'critical', label: `${gap}% behind`, expected };
    if (gap > SLIGHTLY_BEHIND_GAP) return { status: 'behind', label: `${gap}% behind`, expected };
    if (gap > 0) return { status: 'slight', label: `${gap}% behind`, expected };
    return { status: 'on-track', label: 'On track', expected };
};

export interface BlockingInfo {
    blockers: EnrichedTask[];
    worst: EnrichedTask;
    count: number;
}

const NO_DUE_DATE = Number.MAX_SAFE_INTEGER;

export const getBlockingInfo = (
    task: EnrichedTask,
    taskKeyToTaskMap: Map<string, EnrichedTask>,
    today: Date,
): BlockingInfo | null => {
    if (task.dependencies.length === 0) return null;
    const blockers = task.dependencies
        .map((dependencyKey) => taskKeyToTaskMap.get(dependencyKey))
        .filter((dependency): dependency is EnrichedTask =>
            !!dependency && !isTaskComplete(dependency.status, dependency.progress));
    if (blockers.length === 0) return null;

    blockers.sort((a, b) => {
        const aDue = a.dueDate ? daysBetween(today, a.dueDate) : NO_DUE_DATE;
        const bDue = b.dueDate ? daysBetween(today, b.dueDate) : NO_DUE_DATE;
        return aDue - bDue || a.progress - b.progress || a.taskKey.localeCompare(b.taskKey);
    });
    return { blockers, worst: blockers[0], count: blockers.length };
};

export const computeVelocityNeeded = (
    task: Pick<EnrichedTask, 'startDate' | 'dueDate' | 'progress' | 'status'>,
    today: Date,
): number | null => {
    if (!task.startDate || !task.dueDate || isTaskComplete(task.status, task.progress)) return null;
    const daysLeft = daysBetween(today, task.dueDate);
    if (daysLeft <= 0) return null;
    const remaining = 100 - task.progress;
    return Math.round(remaining / daysLeft);
};
