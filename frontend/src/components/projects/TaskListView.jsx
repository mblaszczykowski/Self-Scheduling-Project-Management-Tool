import React from 'react';
import { formatShortDate, STATUS_CONFIG, PRIORITY_CONFIG } from '../../util/helpers';
import { EmptyState } from '../common';
import { SortAscIcon, SortDescIcon, AlertTriangleIcon } from '../common/Icons';

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
        ['taskKey', 'Task', 'min-w-[280px]'],
        ['status', 'Status', 'w-32'],
        ['priority', 'Priority', 'w-28'],
        ['assignee', 'Assignee', 'w-40'],
        ['dueDate', 'Due', 'w-28'],
        ['progress', 'Progress', 'w-32'],
        ['isDelayed', 'Health', 'w-28'],
    ];

    if (filteredTasks.length === 0) {
        const emptyTitle = hasActiveFilters ? 'No matching tasks' : 'No tasks yet';
        const emptyDescription = hasActiveFilters
            ? 'Try adjusting your filters to see more results.'
            : 'Create your first task to get started with tracking your work.';
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-grow flex flex-col">
                <EmptyState
                    variant={hasActiveFilters ? 'search' : 'table'}
                    title={emptyTitle}
                    description={emptyDescription}
                    className="flex-grow"
                />
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
                                const baseClasses = 'px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400';
                                const sortableClasses = 'hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer select-none';
                                const sortedClasses = isSorted ? 'text-slate-800 dark:text-slate-200' : '';
                                return (
                                    <th
                                        key={field}
                                        onClick={() => onSort(field)}
                                        className={`${baseClasses} ${width} ${sortableClasses} ${sortedClasses}`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {label}
                                            {isSorted && (
                                                sortOrder === 'asc'
                                                    ? <SortAscIcon className="w-3 h-3" />
                                                    : <SortDescIcon className="w-3 h-3" />
                                            )}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTasks.map((task) => {
                            const project = projectKeyToProject
                                ? projectKeyToProject.get(task.projectKey)
                                : processedProjects.find(p => p.projectKey === task.projectKey);
                            return (
                                <tr
                                    key={task.taskKey}
                                    onClick={() => onTaskClick(project, task)}
                                    className="border-b border-slate-100 dark:border-slate-700/40 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors group"
                                >
                                    {/* Task: key + name + project */}
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={`text-xs font-semibold font-mono ${
                                                        task.isCritical ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                                                    }`}>
                                                        {task.taskKey}
                                                    </span>
                                                    {task.isCritical && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                                    )}
                                                    <span className="text-xs text-slate-400 dark:text-slate-500">{task.projectKey}</span>
                                                </div>
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white">
                                                    {task.summary}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Status */}
                                    <td className="px-5 py-3.5">
                                        <span className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-medium ${
                                            STATUS_CONFIG[task.status]?.color || 'bg-slate-100 text-slate-600'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[task.status]?.dot || 'bg-slate-400'}`} />
                                            {STATUS_CONFIG[task.status]?.label || task.status}
                                        </span>
                                    </td>

                                    {/* Priority */}
                                    <td className="px-5 py-3.5">
                                        <span className={`inline-flex items-center gap-1 py-1 px-2 rounded-lg text-xs font-medium ${
                                            PRIORITY_CONFIG[task.priority]?.color || 'bg-slate-100 text-slate-600'
                                        }`}>
                                            <span className="text-xs">{PRIORITY_CONFIG[task.priority]?.icon}</span>
                                            {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                                        </span>
                                    </td>

                                    {/* Assignee */}
                                    <td className="px-5 py-3.5">
                                        {task.assignee ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                                    {task.assignee.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                                    {task.assignee}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
                                        )}
                                    </td>

                                    {/* Due date */}
                                    <td className="px-5 py-3.5">
                                        <span className={`text-sm tabular-nums ${
                                            task.isDelayed
                                                ? 'text-red-600 dark:text-red-400 font-medium'
                                                : 'text-slate-600 dark:text-slate-400'
                                        }`}>
                                            {task.dueDate ? formatShortDate(task.dueDate) : '—'}
                                        </span>
                                    </td>

                                    {/* Progress */}
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${
                                                        task.progress >= 100
                                                            ? 'bg-green-500'
                                                            : task.progress >= 50
                                                                ? 'bg-blue-500'
                                                                : 'bg-slate-400 dark:bg-slate-500'
                                                    }`}
                                                    style={{ width: `${Math.min(task.progress, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-8 text-right tabular-nums">
                                                {task.progress}%
                                            </span>
                                        </div>
                                    </td>

                                    {/* Health */}
                                    <td className="px-5 py-3.5">
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                            task.isDelayed
                                                ? 'text-red-600 dark:text-red-400'
                                                : task.isUpcomingDeadline
                                                    ? 'text-amber-600 dark:text-amber-400'
                                                    : task.isDelayedByDependency
                                                        ? 'text-blue-600 dark:text-blue-400'
                                                        : 'text-emerald-600 dark:text-emerald-400'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                task.isDelayed ? 'bg-red-500'
                                                    : task.isUpcomingDeadline ? 'bg-amber-500'
                                                        : task.isDelayedByDependency ? 'bg-blue-500'
                                                            : 'bg-emerald-500'
                                            }`} />
                                            {task.isDelayed ? 'Delayed'
                                                : task.isUpcomingDeadline ? 'Due Soon'
                                                    : task.isDelayedByDependency ? 'Blocked'
                                                        : 'On Track'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-700/50 flex items-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{filteredTasks.length}</span>{' '}
                    {filteredTasks.length === 1 ? 'task' : 'tasks'}
                    {hasActiveFilters && <span className="text-slate-400 dark:text-slate-500"> (filtered)</span>}
                </p>
            </div>
        </div>
    );
};

export default TaskListView;
