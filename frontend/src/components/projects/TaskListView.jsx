import React from 'react';
import { formatShortDate, daysBetween, STATUS_CONFIG, PRIORITY_CONFIG } from '../../util/helpers';
import { EmptyState } from '../common';
import { SortAscIcon, SortDescIcon } from '../common/Icons';

const relativeDue = (dueDate) => {
    if (!dueDate) return { text: '—', cls: 'text-slate-400' };
    const diff = daysBetween(new Date(), dueDate);
    if (diff < -1) return { text: `${Math.abs(diff)}d overdue`, cls: 'text-red-600 dark:text-red-400 font-medium' };
    if (diff === -1) return { text: 'Yesterday', cls: 'text-red-600 dark:text-red-400 font-medium' };
    if (diff === 0) return { text: 'Today', cls: 'text-amber-600 dark:text-amber-400 font-medium' };
    if (diff === 1) return { text: 'Tomorrow', cls: 'text-amber-600 dark:text-amber-400' };
    if (diff <= 3) return { text: `in ${diff}d`, cls: 'text-amber-600 dark:text-amber-400' };
    if (diff <= 7) return { text: `in ${diff}d`, cls: 'text-slate-700 dark:text-slate-300' };
    return { text: formatShortDate(dueDate), cls: 'text-slate-500 dark:text-slate-400' };
};

const getProgressColor = (task) => {
    if (task.progress >= 100) return 'bg-green-500';
    if (task.isDelayed) return 'bg-red-400';
    if (task.isUpcomingDeadline && task.progress < 80) return 'bg-amber-400';
    if (task.progress >= 50) return 'bg-blue-500';
    return 'bg-slate-300 dark:bg-slate-600';
};

const TaskListView = ({
    filteredTasks,
    processedProjects,
    taskKeyToTaskMap,
    projectKeyToProject,
    sortField,
    sortOrder,
    hasActiveFilters,
    onSort,
    onTaskClick,
}) => {
    const columns = [
        ['taskKey', 'Task', 'min-w-[260px]'],
        ['status', 'Status', 'w-32'],
        ['priority', 'Priority', 'w-24'],
        ['assignee', 'Assignee', 'w-36'],
        ['startDate', 'Schedule', 'w-48'],
        ['progress', 'Progress', 'w-32'],
        ['labels', 'Labels & Deps', 'w-44'],
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
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800">
                            {columns.map(([field, label, width]) => {
                                const isSorted = sortField === field;
                                const nonsortable = field === 'labels';
                                return (
                                    <th key={field} onClick={() => !nonsortable && onSort(field)}
                                        className={`px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 ${!nonsortable ? 'hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer' : ''} select-none ${width} ${isSorted ? 'text-slate-800 dark:text-slate-200' : ''}`}>
                                        <div className="flex items-center gap-1">
                                            {label}
                                            {isSorted && (sortOrder === 'asc' ? <SortAscIcon className="w-3 h-3" /> : <SortDescIcon className="w-3 h-3" />)}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTasks.map((task, index) => {
                            const project = projectKeyToProject?.get(task.projectKey)
                                || processedProjects.find(p => p.projectKey === task.projectKey);
                            const due = relativeDue(task.dueDate);

                            return (
                                <tr key={task.taskKey} onClick={() => onTaskClick(project, task)}
                                    className="border-b border-slate-100 dark:border-slate-700/40 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors group animate-[fadeInSlide_0.3s_ease-out_both]"
                                    style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}>

                                    {/* ── Task ── */}
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className={`text-xs font-semibold font-mono ${task.isCritical ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                {task.taskKey}
                                            </span>
                                            <span className="text-xs text-slate-300 dark:text-slate-600">{task.projectKey}</span>
                                            {task.isCritical && <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-950/40 px-1 py-px rounded">critical</span>}
                                            {task.isDelayed && <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-950/40 px-1 py-px rounded">delayed</span>}
                                            {!task.isDelayed && task.isDelayedByDependency && <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1 py-px rounded">blocked</span>}
                                            {!task.isDelayed && !task.isDelayedByDependency && task.isUpcomingDeadline && <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 py-px rounded">due soon</span>}
                                        </div>
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white">
                                            {task.summary}
                                        </p>
                                    </td>

                                    {/* ── Status ── */}
                                    <td className="px-3 py-2.5">
                                        <span className={`inline-flex items-center gap-1.5 py-0.5 px-2 rounded text-xs font-medium ${STATUS_CONFIG[task.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[task.status]?.dot || 'bg-slate-400'}`} />
                                            {STATUS_CONFIG[task.status]?.label || task.status}
                                        </span>
                                    </td>

                                    {/* ── Priority ── */}
                                    <td className="px-3 py-2.5">
                                        <span className={`inline-flex items-center gap-1 py-0.5 px-2 rounded text-xs font-medium ${PRIORITY_CONFIG[task.priority]?.color || 'bg-slate-100 text-slate-600'}`}>
                                            {PRIORITY_CONFIG[task.priority]?.icon} {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                                        </span>
                                    </td>

                                    {/* ── Assignee ── */}
                                    <td className="px-3 py-2.5">
                                        {task.assignee ? (
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                                    {task.assignee.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{task.assignee}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 dark:text-slate-500">Unassigned</span>
                                        )}
                                    </td>

                                    {/* ── Schedule: start → due + duration ── */}
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1 text-xs tabular-nums">
                                            <span className="text-slate-500 dark:text-slate-400">{task.startDate ? formatShortDate(task.startDate) : '—'}</span>
                                            <span className="text-slate-300 dark:text-slate-600">→</span>
                                            <span className={due.cls + ' text-xs'} title={task.dueDate ? formatShortDate(task.dueDate) : ''}>{due.text}</span>
                                        </div>
                                        {task.duration !== 'N/A' && (
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{task.duration} days</span>
                                        )}
                                    </td>

                                    {/* ── Progress ── */}
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${getProgressColor(task)}`}
                                                    style={{ width: `${Math.min(task.progress, 100)}%` }} />
                                            </div>
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-7 text-right tabular-nums">{task.progress}%</span>
                                        </div>
                                    </td>

                                    {/* ── Labels & Dependencies ── */}
                                    <td className="px-3 py-2.5">
                                        <div className="flex flex-wrap gap-1">
                                            {task.labels?.slice(0, 3).map((l, i) => (
                                                <span key={i} className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{l}</span>
                                            ))}
                                            {task.labels?.length > 3 && <span className="text-[10px] text-slate-400">+{task.labels.length - 3}</span>}
                                            {task.dependencies?.slice(0, 2).map(d => {
                                                const dep = taskKeyToTaskMap?.get(d);
                                                return (
                                                    <span key={d} className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                                                        {d}
                                                    </span>
                                                );
                                            })}
                                            {task.dependencies?.length > 2 && <span className="text-[10px] text-slate-400">+{task.dependencies.length - 2}</span>}
                                            {!task.labels?.length && !task.dependencies?.length && <span className="text-xs text-slate-400 dark:text-slate-500">—</span>}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{filteredTasks.length}</span> {filteredTasks.length === 1 ? 'task' : 'tasks'}
                    {hasActiveFilters && <span className="text-slate-400"> (filtered)</span>}
                </p>
            </div>
        </div>
    );
};

export default TaskListView;
