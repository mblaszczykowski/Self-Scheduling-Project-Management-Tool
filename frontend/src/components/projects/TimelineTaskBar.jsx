import React from 'react';
import {
    formatShortDate,
    STATUS_CONFIG,
    calculateTaskPosition,
} from '../../util/helpers';
import { AlertTriangleFilledIcon } from '../common/Icons';

const GhostTaskBar = ({ task, taskPosition, suggestion, timelineStart, onTooltipShow, onTooltipMove, onTooltipHide }) => {
    const ghostPos = calculateTaskPosition(
        suggestion.suggestedStartDate,
        suggestion.suggestedDueDate,
        timelineStart
    );
    const origCenter = taskPosition.marginLeft + taskPosition.width / 2;
    const ghostCenter = ghostPos.marginLeft + ghostPos.width / 2;
    const arrowStartX = taskPosition.marginLeft + taskPosition.width;
    const arrowEndX = ghostPos.marginLeft;
    const goesRight = ghostCenter > origCenter;

    return (
        <>
            {Math.abs(arrowEndX - arrowStartX) > 8 && (
                <svg
                    className="absolute pointer-events-none"
                    style={{
                        left: 0, top: 0, width: '100%', height: '100%',
                        zIndex: 1, overflow: 'visible',
                    }}
                >
                    <line
                        x1={goesRight ? arrowStartX + 2 : taskPosition.marginLeft - 2}
                        y1="50%"
                        x2={goesRight ? arrowEndX - 2 : arrowEndX + ghostPos.width + 2}
                        y2="50%"
                        stroke="rgba(96,165,250,0.35)"
                        strokeWidth="1"
                        strokeDasharray="3 2"
                    />
                    <polygon
                        points={goesRight
                            ? `${arrowEndX - 2},${0} ${arrowEndX + 2},${0} ${arrowEndX},${0}`
                            : `${arrowEndX + ghostPos.width + 2},${0} ${arrowEndX + ghostPos.width - 2},${0} ${arrowEndX + ghostPos.width},${0}`
                        }
                        fill="rgba(96,165,250,0.4)"
                        style={{ transform: 'translateY(calc(50% - 0px))' }}
                    />
                </svg>
            )}
            <div
                className="absolute h-2.5 rounded-[3px] z-[2]"
                style={{
                    marginLeft: `${ghostPos.marginLeft}px`,
                    width: `${ghostPos.width}px`,
                    background: 'linear-gradient(90deg, rgba(96,165,250,0.15), rgba(96,165,250,0.3), rgba(96,165,250,0.15))',
                    backgroundSize: '200% 100%',
                    animation: 'optGhostShimmer 2.5s ease-in-out infinite',
                    border: '1.5px dashed rgba(96,165,250,0.6)',
                    boxShadow: '0 0 8px rgba(96,165,250,0.12)',
                }}
                onMouseEnter={(e) => onTooltipShow(e, {
                    type: 'task',
                    title: `${task.summary}`,
                    subtitle: `${task.taskKey} \u2022 optimized`,
                    status: 'Suggested schedule',
                    dates: `${formatShortDate(suggestion.suggestedStartDate)} \u2192 ${
                        formatShortDate(suggestion.suggestedDueDate)
                    }`,
                    assignee: task.assignee || 'Unassigned',
                    progress: task.progress,
                })}
                onMouseMove={onTooltipMove}
                onMouseLeave={onTooltipHide}
            />
        </>
    );
};

const TimelineTaskBar = ({
    task,
    project,
    isLastTask,
    sidebarCollapsed,
    sidebarWidth,
    timelineStart,
    timelineWidth,
    onTooltipShow,
    onTooltipMove,
    onTooltipHide,
    onMouseDown,
    shouldPreventClick,
    onOpenTaskModal,
    optimization,
}) => {
    const taskPosition = calculateTaskPosition(
        task.startDate,
        task.dueDate,
        timelineStart
    );

    const taskRowClass = `sticky left-0 z-10 bg-white dark:bg-slate-800/80 border-x border-b border-slate-200 dark:border-slate-700 hover:bg-blue-50/40 dark:hover:bg-slate-700/40 cursor-pointer transition-colors ${
        isLastTask ? 'rounded-b-xl' : ''
    }`;

    return (
        <div
            className="flex relative-container group"
            style={{ width: `${timelineWidth}px` }}
        >
            <div
                className={taskRowClass}
                style={{
                    minWidth: `${sidebarWidth}px`,
                    width: `${sidebarWidth}px`
                }}
                onClick={() => {
                    if (!shouldPreventClick()) onOpenTaskModal(project, task);
                }}
            >
                {sidebarCollapsed ? (
                    <div className="p-2 flex items-center justify-center">
                        <span
                            className={`text-xs font-bold ${
                                task.isCritical
                                    ? 'text-red-600'
                                    : 'text-slate-500'
                            }`}
                        >
                            {task.id}
                        </span>
                    </div>
                ) : (
                    <div className="px-3 py-2.5 pl-6">
                        <p className="text-sm text-slate-800 dark:text-slate-200 truncate mb-1.5 font-medium">
                            {task.summary}
                        </p>
                        <div className="flex items-center gap-2">
                            <span
                                className={`text-xs font-semibold font-mono ${
                                    task.isCritical
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-slate-400 dark:text-slate-500'
                                }`}
                            >
                                {task.taskKey}
                            </span>
                            {task.isCritical && (
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                            )}
                            {task.status && (
                                <span
                                    className={`text-[10px] py-0.5 px-1.5 rounded-md font-medium ${
                                        STATUS_CONFIG[task.status]?.color ||
                                        'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    {STATUS_CONFIG[task.status]?.label ||
                                        task.status}
                                </span>
                            )}
                            <div className="flex items-center gap-1.5 ml-auto">
                                <div className="w-14 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${
                                            task.progress >= 100 ? 'bg-green-500' : 'bg-slate-400 dark:bg-slate-500'
                                        }`}
                                        style={{ width: `${task.progress}%` }}
                                    />
                                </div>
                                <span className="text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                                    {task.progress}%
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex-1 flex items-center relative z-[3]">
                <div
                    className={`absolute ${
                        task.isCritical
                            ? 'bg-red-500 dark:bg-red-400'
                            : task.progress >= 100
                                ? 'bg-green-500 dark:bg-green-400'
                                : 'bg-blue-500 dark:bg-blue-400'
                    } h-2.5 rounded-[3px] cursor-pointer hover:brightness-110 transition-all duration-150`}
                    data-task-key={task.taskKey}
                    style={{
                        marginLeft: `${taskPosition.marginLeft}px`,
                        width: `${taskPosition.width}px`
                    }}
                    onClick={e => {
                        if (!shouldPreventClick()) {
                            onOpenTaskModal(project, task);
                        } else {
                            e.stopPropagation();
                        }
                    }}
                    onMouseEnter={(e) => onTooltipShow(e, {
                        type: 'task',
                        title: task.summary,
                        subtitle: task.taskKey,
                        status: STATUS_CONFIG[task.status]?.label ||
                            task.status,
                        isCritical: task.isCritical,
                        dates: `${formatShortDate(task.startDate)} -> ${
                            formatShortDate(task.dueDate)
                        }`,
                        assignee: task.assignee || 'Unassigned',
                        progress: task.progress
                    })}
                    onMouseMove={onTooltipMove}
                    onMouseLeave={onTooltipHide}
                >
                    <div
                        className="absolute left-0 top-0 h-full w-2 cursor-w-resize"
                        onMouseDown={e => {
                            e.stopPropagation();
                            onMouseDown(
                                e,
                                task.taskKey,
                                project.projectKey,
                                'left'
                            );
                        }}
                    />
                    <div
                        className="absolute right-0 top-0 h-full w-2 cursor-e-resize"
                        onMouseDown={e => {
                            e.stopPropagation();
                            onMouseDown(
                                e,
                                task.taskKey,
                                project.projectKey,
                                'right'
                            );
                        }}
                    />
                </div>
                {optimization?.showGhostBars && (() => {
                    const suggestion = optimization.suggestionMap?.get(task.taskKey);
                    if (!suggestion) return null;
                    return (
                        <GhostTaskBar
                            task={task}
                            taskPosition={taskPosition}
                            suggestion={suggestion}
                            timelineStart={timelineStart}
                            onTooltipShow={onTooltipShow}
                            onTooltipMove={onTooltipMove}
                            onTooltipHide={onTooltipHide}
                        />
                    );
                })()}
                {task.isDelayed && (
                    <div
                        className="absolute flex items-center gap-1"
                        style={{
                            left: taskPosition.marginLeft +
                                taskPosition.width / 2 - 28,
                            top: -14
                        }}
                    >
                        <span className="text-[10px] py-0.5 px-1.5 rounded bg-amber-50 text-amber-600 font-medium flex items-center gap-0.5 border border-amber-200/60">
                            <AlertTriangleFilledIcon />
                            delayed
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(TimelineTaskBar);
