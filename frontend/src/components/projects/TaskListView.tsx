import React, { useCallback, useMemo } from 'react';
import { formatShortDate, daysBetween, STATUS_CONFIG, PRIORITY_CONFIG, MS_PER_DAY, formatAssigneeName } from '../../util/helpers';
import { EmptyState } from '../common';
import { SortAscIcon, SortDescIcon } from '../common/Icons';
import Avatar from '../common/Avatar';
import { EnrichedTask } from '../../types';
import { TaskKeyMap, TaskListViewProps } from './types';

const TERMINAL_STATUSES = new Set(['DONE', 'RELEASED', 'WITHDRAWN']);

const relativeDue = (dueDate?: string | null, status?: string | null, progress = 0) => {
    if (!dueDate) return { text: '—', cls: 'text-slate-400' };
    if ((status && TERMINAL_STATUSES.has(status)) || progress >= 100) {
        return { text: formatShortDate(dueDate), cls: 'text-slate-500 dark:text-slate-400' };
    }
    const diff = daysBetween(new Date(), dueDate);
    if (diff < -1) return { text: `${Math.abs(diff)}d overdue`, cls: 'text-red-600 dark:text-red-400 font-semibold' };
    if (diff === -1) return { text: 'Yesterday', cls: 'text-red-600 dark:text-red-400 font-semibold' };
    if (diff === 0) return { text: 'Today', cls: 'text-amber-600 dark:text-amber-400 font-semibold' };
    if (diff === 1) return { text: 'Tomorrow', cls: 'text-amber-600 dark:text-amber-400' };
    if (diff <= 3) return { text: `in ${diff}d`, cls: 'text-amber-600 dark:text-amber-400' };
    if (diff <= 7) return { text: `in ${diff}d`, cls: 'text-slate-700 dark:text-slate-300' };
    return { text: formatShortDate(dueDate), cls: 'text-slate-500 dark:text-slate-400' };
};

const getProgressColor = (task: EnrichedTask) => {
    if (task.progress >= 100) return 'bg-green-500';
    if (task.isDelayed) return 'bg-red-400';
    if (task.isUpcomingDeadline && task.progress < 80) return 'bg-amber-400';
    if (task.progress >= 50) return 'bg-blue-500';
    return 'bg-slate-300 dark:bg-slate-600';
};

const computeScheduleHealth = (task: EnrichedTask, now: Date) => {
    if (!task.startDate || !task.dueDate || task.progress >= 100) return null;
    const start = new Date(task.startDate);
    const due = new Date(task.dueDate);
    if (now < start) return { status: 'not-started', label: 'Not started', expected: 0 };
    const totalDays = Math.max((due.getTime() - start.getTime()) / MS_PER_DAY, 1);
    const elapsed = (now.getTime() - start.getTime()) / MS_PER_DAY;
    const expected = Math.min(Math.round((elapsed / totalDays) * 100), 100);
    const gap = expected - task.progress;
    if (gap > 30) return { status: 'critical', label: `${gap}% behind`, expected };
    if (gap > 15) return { status: 'behind', label: `${gap}% behind`, expected };
    if (gap > 0) return { status: 'slight', label: `${gap}% behind`, expected };
    return { status: 'on-track', label: 'On track', expected };
};

const healthColor: Record<string, string> = {
    'critical': 'text-red-600 dark:text-red-400',
    'behind': 'text-amber-600 dark:text-amber-400',
    'slight': 'text-slate-500 dark:text-slate-400',
    'on-track': 'text-green-600 dark:text-green-400',
    'not-started': 'text-slate-400 dark:text-slate-500',
};

const getBlockingInfo = (task: EnrichedTask, taskKeyToTaskMap: TaskKeyMap, now: Date) => {
    if (task.dependencies.length === 0) return null;
    const blockers = task.dependencies
        .map((dependencyKey) => taskKeyToTaskMap.get(dependencyKey))
        .filter((dependency): dependency is EnrichedTask =>
            !!dependency && dependency.progress < 100);
    if (blockers.length === 0) return null;

    // Most overdue first, then least complete; the task key keeps the order total.
    const NO_DUE_DATE = Number.MAX_SAFE_INTEGER;
    blockers.sort((a, b) => {
        const aDue = a.dueDate ? daysBetween(now, a.dueDate) : NO_DUE_DATE;
        const bDue = b.dueDate ? daysBetween(now, b.dueDate) : NO_DUE_DATE;
        return aDue - bDue || a.progress - b.progress || a.taskKey.localeCompare(b.taskKey);
    });
    return { blockers, worst: blockers[0], count: blockers.length };
};

/** Mini timeline showing elapsed vs remaining */
const ScheduleBar = ({ startDate, dueDate, progress }: { startDate?: string | null; dueDate?: string | null; progress: number }) => {
    if (!startDate || !dueDate) return null;
    const now = new Date();
    const start = new Date(startDate);
    const due = new Date(dueDate);
    const total = due.getTime() - start.getTime();
    if (total <= 0) return null;
    const elapsed = Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / total));
    const overdue = now > due;
    return (
        <div className="h-[3px] rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mt-1.5" title={`${Math.round(elapsed * 100)}% of time elapsed, ${progress}% done`}>
            <div
                className={`h-full rounded-full transition-all duration-300 ${overdue ? 'bg-red-400' : progress >= elapsed * 100 ? 'bg-green-400' : 'bg-amber-400'}`}
                style={{ width: `${elapsed * 100}%` }}
            />
        </div>
    );
};

const DepChip = ({ dep, onClick, overdue }: { dep: EnrichedTask; onClick: (dep: EnrichedTask) => void; overdue?: boolean }) => (
    <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(dep); }}
        className={`inline-flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded transition-all hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
            overdue
                ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 ring-1 ring-red-200 dark:ring-red-800 hover:bg-red-100 dark:hover:bg-red-950/60'
                : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-200 dark:ring-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/60'
        }`}
        title={`${dep.taskKey}: ${dep.summary} — ${dep.progress}% done${overdue ? ' (OVERDUE)' : ''}\nClick to open`}
    >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dep.progress >= 100 ? 'bg-green-500' : overdue ? 'bg-red-500' : 'bg-blue-500'}`} />
        {dep.taskKey}
        <span className="font-sans text-[10px] opacity-60">{dep.progress}%</span>
    </button>
);

interface TaskInsight {
    blocking: ReturnType<typeof getBlockingInfo>;
    dependents: number;
    health: ReturnType<typeof computeScheduleHealth>;
}

const TaskListView = ({
    filteredTasks,
    taskKeyToTaskMap,
    projectKeyToProject,
    sortField,
    sortOrder,
    hasActiveFilters,
    onSort,
    onTaskClick,
}: TaskListViewProps) => {
    const taskInsights = useMemo(() => {
        // One pass over every known task to count dependents per key, rather than scanning them
        // all again for each rendered row.
        const dependentsCount = new Map<string, number>();
        taskKeyToTaskMap.forEach((task) => {
            task.dependencies.forEach((dependencyKey) => {
                dependentsCount.set(dependencyKey, (dependentsCount.get(dependencyKey) ?? 0) + 1);
            });
        });

        // "Now" is read once per recomputation rather than per row per helper.
        const now = new Date();
        const insights = new Map<string, TaskInsight>();
        filteredTasks.forEach((task) => {
            insights.set(task.taskKey, {
                blocking: getBlockingInfo(task, taskKeyToTaskMap, now),
                dependents: dependentsCount.get(task.taskKey) ?? 0,
                health: computeScheduleHealth(task, now),
            });
        });
        return insights;
    }, [filteredTasks, taskKeyToTaskMap]);

    const handleDepClick = useCallback((dependency: EnrichedTask) => {
        const project = projectKeyToProject.get(dependency.projectKey);
        if (project) onTaskClick(project, dependency);
    }, [projectKeyToProject, onTaskClick]);

    const columns = [
        ['taskKey', 'Task', 'min-w-[280px]'],
        ['status', 'Status', 'w-28'],
        ['priority', 'Pri', 'w-14'],
        ['assignee', 'Assignee', 'w-40'],
        ['startDate', 'Schedule', 'w-56'],
        ['progress', 'Progress', 'w-44'],
        ['dependencies', 'Dependencies', 'min-w-[240px]'],
    ];

    if (filteredTasks.length === 0) {
        const emptyTitle = hasActiveFilters ? 'No matching tasks' : 'No tasks yet';
        const emptyDescription = hasActiveFilters
            ? 'Try adjusting your filters to see more results.'
            : 'Create your first task to get started with tracking your work.';
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-grow flex flex-col">
                <EmptyState variant={hasActiveFilters ? 'search' : 'table'} title={emptyTitle} description={emptyDescription} className="flex-grow" />
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-grow flex flex-col">
            <div className="overflow-x-auto flex-grow">
                <table className="min-w-full">
                    <thead className="sticky top-0 z-10">
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/90 backdrop-blur-sm">
                            {columns.map(([field, label, width]) => {
                                const isSorted = sortField === field;
                                const nonsortable = field === 'dependencies';
                                const heading = (
                                    <>
                                        {label}
                                        {isSorted && (sortOrder === 'asc' ? <SortAscIcon className="w-3 h-3" /> : <SortDescIcon className="w-3 h-3" />)}
                                    </>
                                );
                                return (
                                    // aria-sort tells assistive tech which column the order is keyed on and in
                                    // which direction; only the sortable columns advertise it.
                                    <th key={field}
                                        aria-sort={nonsortable ? undefined : isSorted ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        className={`text-left text-[11px] font-semibold uppercase tracking-wider ${nonsortable ? 'px-4 py-2.5' : ''} select-none ${width} ${isSorted ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'} transition-colors`}>
                                        {nonsortable ? (
                                            <div className="flex items-center gap-1">{heading}</div>
                                        ) : (
                                            // A real button rather than a handler on the <th>, so sorting is
                                            // reachable by keyboard; it carries the cell padding so the mouse
                                            // target stays the whole header cell.
                                            // `uppercase` is repeated here on purpose: Tailwind's preflight
                                            // sets `button { text-transform: none }`, and an explicit
                                            // declaration beats the value inherited from the <th>, so the
                                            // sortable headings dropped to title case while the plain one
                                            // stayed upper.
                                            <button type="button" onClick={() => onSort(field)}
                                                className="w-full px-4 py-2.5 flex items-center gap-1 uppercase cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                                                {heading}
                                            </button>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTasks.map((task) => {
                            const project = projectKeyToProject.get(task.projectKey);
                            const due = relativeDue(task.dueDate, task.status, task.progress);
                            const insights = taskInsights.get(task.taskKey)
                                ?? { blocking: null, dependents: 0, health: null };
                            const { blocking, dependents, health } = insights;
                            const assigneeMember = project?.members
                                .find((member) => member.email === task.assignee);

                            return (
                                // The row stays a table row rather than taking role="button": overriding the
                                // role would drop it out of the table's row/rowgroup structure and break table
                                // navigation. tabIndex + aria-label + Enter/Space give it the keyboard path.
                                <tr key={task.taskKey}
                                    tabIndex={0}
                                    aria-label={`Open task ${task.taskKey}: ${task.summary}`}
                                    onClick={() => onTaskClick(project, task)}
                                    onKeyDown={(e) => {
                                        // The dependency chips inside the row are focusable too and their Enter
                                        // press bubbles up here; only act when the row itself holds focus, so
                                        // opening a chip does not also open this task.
                                        if (e.target !== e.currentTarget) return;
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault(); // Space would otherwise scroll the page
                                            onTaskClick(project, task);
                                        }
                                    }}
                                    className={`border-b border-slate-100 dark:border-slate-700/40 hover:bg-blue-50/40 dark:hover:bg-slate-700/30 cursor-pointer transition-colors group ${task.isCritical && task.isDelayed ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>

                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className={`text-xs font-bold font-mono ${task.isCritical ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                {task.taskKey}
                                            </span>
                                            <span className="text-[10px] text-slate-300 dark:text-slate-600 font-medium">{task.projectKey}</span>

                                            {task.isCritical && (
                                                <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-px rounded-full ring-1 ring-red-200/60 dark:ring-red-800/60"
                                                    title="On the critical path — any delay here delays the project">CRITICAL</span>
                                            )}
                                            {dependents > 0 && (
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500" title={`${dependents} task${dependents > 1 ? 's' : ''} depend on this`}>
                                                    {dependents} downstream
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                            {task.summary}
                                        </p>
                                    </td>

                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1.5 py-[3px] px-2 rounded-md text-[11px] font-semibold ${STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG]?.color || 'bg-slate-100 text-slate-600'}`}>
                                            <span className={`w-[6px] h-[6px] rounded-full ${STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG]?.dot || 'bg-slate-400'}`} />
                                            {STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG]?.label || task.status}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold ${PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.color || 'bg-slate-100 text-slate-600'}`}
                                            title={PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.label || task.priority}>
                                            {PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.icon}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3">
                                        {task.assignee ? (
                                            <div className="flex items-center gap-2">
                                                {assigneeMember ? (
                                                    <Avatar user={assigneeMember} size="xs" />
                                                ) : (
                                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                                        {task.assignee.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{formatAssigneeName(task.assignee)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-300 dark:text-slate-600">Unassigned</span>
                                        )}
                                    </td>

                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5 text-xs tabular-nums">
                                            <span className="text-slate-500 dark:text-slate-400">{task.startDate ? formatShortDate(task.startDate) : '—'}</span>
                                            <span className="text-slate-300 dark:text-slate-600">→</span>
                                            <span className={due.cls} title={task.dueDate ? formatShortDate(task.dueDate) : ''}>{due.text}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {task.duration > 0 && (
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500">{task.duration}d span</span>
                                            )}
                                            {task.startDate && task.dueDate && task.progress < 100 && (() => {
                                                const daysLeft = daysBetween(new Date(), task.dueDate);
                                                const remaining = 100 - task.progress;
                                                if (daysLeft > 0 && remaining > 0) {
                                                    const velocity = Math.round(remaining / daysLeft);
                                                    return (
                                                        <span className={`text-[10px] ${velocity > 15 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}
                                                            title={`Need ${velocity}% progress per day to finish on time`}>
                                                            {velocity}%/day needed
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <ScheduleBar startDate={task.startDate} dueDate={task.dueDate} progress={task.progress} />
                                    </td>

                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex-1 h-[6px] bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
                                                {health && health.expected > 0 && task.progress < 100 && (
                                                    <div className="absolute top-0 h-full w-[2px] bg-slate-400/40 dark:bg-slate-500/40 z-10 rounded"
                                                        style={{ left: `${Math.min(health.expected, 100)}%` }}
                                                        title={`Expected: ${health.expected}%`} />
                                                )}
                                                <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(task)}`}
                                                    style={{ width: `${Math.min(task.progress, 100)}%` }} />
                                            </div>
                                            <span className={`text-xs font-semibold tabular-nums w-8 text-right ${
                                                task.progress >= 100 ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-300'
                                            }`}>{task.progress}%</span>
                                        </div>
                                        {health && health.status !== 'on-track' && health.status !== 'not-started' && (
                                            <div className={`text-[10px] mt-1 font-medium ${healthColor[health.status]}`}>
                                                {health.label}
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-4 py-3">
                                        <div className="space-y-1.5">
                                            {blocking && (
                                                <div>
                                                    <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 mr-1.5">Blocked by</span>
                                                    <div className="inline-flex flex-wrap gap-1 mt-0.5">
                                                        {blocking.blockers.slice(0, 3).map(dep => (
                                                            <DepChip
                                                                key={dep.taskKey}
                                                                dep={dep}
                                                                onClick={handleDepClick}
                                                                overdue={!!dep.dueDate && daysBetween(new Date(), dep.dueDate) < 0}
                                                            />
                                                        ))}
                                                        {blocking.count > 3 && (
                                                            <span className="text-[10px] text-slate-400 self-center">+{blocking.count - 3} more</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {!blocking && task.dependencies?.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Deps cleared</span>
                                                    {task.dependencies.slice(0, 2).map(d => {
                                                        const depTask = taskKeyToTaskMap?.get(d);
                                                        return depTask ? (
                                                            <DepChip key={d} dep={depTask} onClick={handleDepClick} overdue={false} />
                                                        ) : (
                                                            <span key={d} className="text-[10px] font-mono text-green-600 dark:text-green-400">{d}</span>
                                                        );
                                                    })}
                                                    {task.dependencies.length > 2 && <span className="text-[10px] text-slate-400">+{task.dependencies.length - 2}</span>}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {task.isDelayed && (
                                                    <span className="text-[10px] font-semibold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-px rounded-full">
                                                        {Math.abs(daysBetween(new Date(), task.dueDate))}d late
                                                    </span>
                                                )}
                                                {!task.isDelayed && task.isDelayedByDependency && !blocking && (
                                                    <span className="text-[10px] font-medium text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-px rounded-full">
                                                        blocked
                                                    </span>
                                                )}
                                                {!task.isDelayed && !task.isDelayedByDependency && task.isUpcomingDeadline && (
                                                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-px rounded-full">
                                                        due soon
                                                    </span>
                                                )}

                                                {task.labels?.length > 0 && task.labels.slice(0, 3).map((l, i) => (
                                                    <span key={i} className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-px rounded-full">{l}</span>
                                                ))}
                                                {task.labels?.length > 3 && <span className="text-[10px] text-slate-400">+{task.labels.length - 3}</span>}
                                            </div>

                                            {!task.dependencies?.length && !task.labels?.length && !task.isDelayed && !task.isUpcomingDeadline && (
                                                <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap items-center gap-x-4 gap-y-1 bg-slate-50/50 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredTasks.length}</span> {filteredTasks.length === 1 ? 'task' : 'tasks'}
                    {hasActiveFilters && <span className="text-slate-400"> (filtered)</span>}
                </p>
                <FooterStats tasks={filteredTasks} />
            </div>
        </div>
    );
};

const FooterStats = React.memo(({ tasks }: { tasks: EnrichedTask[] }) => {
    const stats = useMemo(() => {
        const critical = tasks.filter(t => t.isCritical).length;
        const overdue = tasks.filter(t => t.isDelayed).length;
        const blocked = tasks.filter(t => t.isDelayedByDependency && !t.isDelayed).length;
        const done = tasks.filter(t => t.progress >= 100).length;
        const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
        const unassigned = tasks.filter(t => !t.assignee && t.progress < 100).length;
        const avgProgress = tasks.length > 0 ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length) : 0;
        return { critical, overdue, blocked, done, inProgress, unassigned, avgProgress };
    }, [tasks]);

    const items = [
        stats.critical > 0 && { label: `${stats.critical} critical`, cls: 'text-red-600 dark:text-red-400' },
        stats.overdue > 0 && { label: `${stats.overdue} overdue`, cls: 'text-red-500 dark:text-red-400' },
        stats.blocked > 0 && { label: `${stats.blocked} blocked`, cls: 'text-orange-600 dark:text-orange-400' },
        stats.inProgress > 0 && { label: `${stats.inProgress} active`, cls: 'text-blue-600 dark:text-blue-400' },
        stats.done > 0 && { label: `${stats.done} done`, cls: 'text-green-600 dark:text-green-400' },
        stats.unassigned > 0 && { label: `${stats.unassigned} unassigned`, cls: 'text-slate-400' },
        { label: `${stats.avgProgress}% avg`, cls: 'text-slate-500 dark:text-slate-400' },
    ].filter(Boolean) as { label: string; cls: string }[];

    return (
        <>
            {items.map((item, i) => (
                <span key={i} className={`text-[10px] font-medium ${item.cls}`}>
                    {i > 0 && <span className="text-slate-200 dark:text-slate-700 mr-1">·</span>}
                    {item.label}
                </span>
            ))}
        </>
    );
});

export default TaskListView;