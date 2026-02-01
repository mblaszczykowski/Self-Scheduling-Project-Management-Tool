import React from 'react';
import { formatShortDate, STATUS_CONFIG, PRIORITY_CONFIG } from '../../util/helpers';

const TaskListView = ({
    filteredTasks,
    processedProjects,
    taskIdToTaskMap,
    sortField,
    sortOrder,
    hasActiveFilters,
    onSort,
    onTaskClick,
}) => {
    const columns = [
        ['projectKey', 'Project', 'w-24'],
        ['taskKey', 'Key', 'w-20'],
        ['summary', 'Summary', 'min-w-[200px]'],
        ['status', 'Status', 'w-28'],
        ['assignee', 'Assignee', 'w-36'],
        ['startDate', 'Start', 'w-24'],
        ['dueDate', 'Due', 'w-24'],
        ['duration', 'Days', 'w-16 text-center'],
        ['progress', 'Progress', 'w-28'],
        ['priority', 'Priority', 'w-24'],
        ['labels', 'Labels', 'w-32'],
        ['dependencies', 'Depends', 'w-28'],
        ['isCritical', 'Critical', 'w-20 text-center'],
        ['isDelayed', 'Health', 'w-24']
    ];

    const renderDependencies = (task) => {
        if (!task.dependencies?.length) return <span className="text-slate-400 text-xs">-</span>;
        return (
            <>
                {task.dependencies.slice(0, 2).map(depId => {
                    const dep = taskIdToTaskMap.get(depId);
                    return dep ? (
                        <span key={depId} className="inline-flex items-center bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            {dep.projectKey}-{dep.id}
                        </span>
                    ) : (
                        <span key={depId} className="text-slate-400 text-xs">{depId}</span>
                    );
                })}
                {task.dependencies.length > 2 && (
                    <span className="text-xs text-slate-500 font-medium">+{task.dependencies.length - 2}</span>
                )}
            </>
        );
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-grow flex flex-col">
            <div className="overflow-x-auto flex-grow">
                <table className="min-w-full">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr className="border-b border-slate-200">
                            {columns.map(([field, label, width]) => (
                                <th
                                    key={field}
                                    onClick={() => !['labels', 'dependencies'].includes(field) && onSort(field)}
                                    className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 ${width} ${!['labels', 'dependencies'].includes(field) ? 'hover:text-slate-800 cursor-pointer select-none' : ''} ${sortField === field ? 'text-slate-800 bg-slate-100/50' : ''}`}
                                >
                                    <div className={`flex items-center gap-1.5 ${width.includes('text-center') ? 'justify-center' : ''}`}>
                                        {label}
                                        {sortField === field && (
                                            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortOrder === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                                            </svg>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredTasks.map((task, index) => (
                            <tr
                                key={task.taskKey}
                                onClick={() => onTaskClick(processedProjects.find(p => p.projectKey === task.projectKey), task)}
                                className={`hover:bg-blue-50/50 cursor-pointer transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                            >
                                {/* Project */}
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-800 truncate">{task.projectKey}</span>
                                        <span className="text-xs text-slate-500 truncate max-w-[80px]">{task.projectSummary}</span>
                                    </div>
                                </td>
                                {/* Task Key */}
                                <td className="px-4 py-3">
                                    <span className={`text-sm font-bold ${task.isCritical ? 'text-red-600' : 'text-slate-700'}`}>{task.taskKey}</span>
                                </td>
                                {/* Summary */}
                                <td className="px-4 py-3">
                                    <span className="text-sm text-slate-700 line-clamp-2 leading-snug group-hover:text-slate-900">{task.summary}</span>
                                </td>
                                {/* Status */}
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center py-1 px-2.5 rounded-full text-xs font-medium ${STATUS_CONFIG[task.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                                        {STATUS_CONFIG[task.status]?.label || task.status}
                                    </span>
                                </td>
                                {/* Assignee */}
                                <td className="px-4 py-3">
                                    {task.assignee ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                                {task.assignee.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-sm text-slate-700 truncate">{task.assignee}</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-slate-400 italic">Unassigned</span>
                                    )}
                                </td>
                                {/* Start Date */}
                                <td className="px-4 py-3">
                                    <span className="text-sm text-slate-600 tabular-nums">{task.startDate ? formatShortDate(task.startDate) : '-'}</span>
                                </td>
                                {/* Due Date */}
                                <td className="px-4 py-3">
                                    <span className={`text-sm tabular-nums ${task.isDelayed ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                                        {task.dueDate ? formatShortDate(task.dueDate) : '-'}
                                    </span>
                                </td>
                                {/* Duration */}
                                <td className="px-4 py-3 text-center">
                                    <span className="text-sm font-medium text-slate-700 tabular-nums">{task.duration !== 'N/A' ? task.duration : '-'}</span>
                                </td>
                                {/* Progress */}
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${task.progress >= 100 ? 'bg-emerald-500' : task.progress >= 50 ? 'bg-blue-500' : 'bg-slate-400'}`}
                                                style={{ width: `${Math.min(task.progress, 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-semibold text-slate-600 w-8 text-right tabular-nums">{task.progress}%</span>
                                    </div>
                                </td>
                                {/* Priority */}
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center py-1 px-2.5 rounded-full text-xs font-medium ${PRIORITY_CONFIG[task.priority]?.color || 'bg-slate-100 text-slate-600'}`}>
                                        {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                                    </span>
                                </td>
                                {/* Labels */}
                                <td className="px-4 py-3">
                                    <div className="flex items-center flex-wrap gap-1">
                                        {!task.labels?.length ? (
                                            <span className="text-slate-400 text-xs">-</span>
                                        ) : (
                                            <>
                                                {task.labels.slice(0, 2).map((l, i) => (
                                                    <span key={i} className="inline-flex items-center bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-medium">{l}</span>
                                                ))}
                                                {task.labels.length > 2 && <span className="text-xs text-slate-500 font-medium">+{task.labels.length - 2}</span>}
                                            </>
                                        )}
                                    </div>
                                </td>
                                {/* Dependencies */}
                                <td className="px-4 py-3">
                                    <div className="flex items-center flex-wrap gap-1">{renderDependencies(task)}</div>
                                </td>
                                {/* Critical */}
                                <td className="px-4 py-3 text-center">
                                    {task.isCritical ? (
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">-</span>
                                    )}
                                </td>
                                {/* Health Status */}
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 py-1 px-2.5 rounded-full text-xs font-medium ${
                                        task.isDelayed ? 'bg-red-100 text-red-700' : task.isUpcomingDeadline ? 'bg-amber-100 text-amber-700' : task.isDelayedByDependency ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${task.isDelayed ? 'bg-red-500' : task.isUpcomingDeadline ? 'bg-amber-500' : task.isDelayedByDependency ? 'bg-violet-500' : 'bg-emerald-500'}`} />
                                        {task.isDelayed ? 'Delayed' : task.isUpcomingDeadline ? 'Due Soon' : task.isDelayedByDependency ? 'Blocked' : 'On Track'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                        Showing <span className="font-semibold text-slate-900">{filteredTasks.length}</span> {filteredTasks.length === 1 ? 'task' : 'tasks'}
                        {hasActiveFilters && <span className="text-slate-500"> (filtered)</span>}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TaskListView;
