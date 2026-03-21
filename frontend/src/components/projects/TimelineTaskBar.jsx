import React from 'react';
import {
    formatShortDate,
    STATUS_CONFIG,
    calculateTaskPosition,
} from '../../util/helpers';
import { AlertTriangleFilledIcon } from '../common/Icons';
import DependencyArrow from './DependencyArrow';

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
                className="absolute h-3 rounded-full z-[2]"
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
    taskGlobalIndex,
    enrichedTask,
    filteredTaskIds,
    filteredProjectKeys,
    hasActiveFilters,
    expandedProjects,
    projectKeyFilter,
    projectIndex,
    projectIndexMap,
    projectKeyToProject,
    taskKeyMap,
    projectRowOffsets,
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

    const taskRowClass = `sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 border-x border-b border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${
        isLastTask ? 'rounded-b-xl' : ''
    }`;

    const filteredDeps = task.dependencies?.filter(depKey => {
        const depTask = taskKeyMap.get(depKey);
        if (!depTask || !filteredTaskIds.has(depTask.id)) return false;
        const depProject = projectKeyToProject.get(depTask.projectKey);
        return depProject &&
            expandedProjects[depProject.projectKey] &&
            (!projectKeyFilter ||
                depProject.projectKey === projectKeyFilter) &&
            (filteredProjectKeys.has(depProject.projectKey) ||
                !hasActiveFilters);
    }) || [];

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
                    <div className="p-2 pl-5">
                        <p className="text-sm text-slate-700 dark:text-slate-200 truncate mb-1">
                            {task.summary}
                        </p>
                        <div className="flex items-center gap-2">
                            <span
                                className={`text-xs font-bold ${
                                    task.isCritical
                                        ? 'text-red-600'
                                        : 'text-slate-500'
                                }`}
                            >
                                {task.taskKey}
                            </span>
                            {task.isCritical && (
                                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                            )}
                            {task.status && (
                                <span
                                    className={`text-[10px] py-0.5 px-1.5 rounded font-medium ${
                                        STATUS_CONFIG[task.status]?.color ||
                                        'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    {STATUS_CONFIG[task.status]?.label ||
                                        task.status}
                                </span>
                            )}
                            <div className="flex items-center gap-1.5 ml-auto">
                                <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-slate-500 rounded-full"
                                        style={{ width: `${task.progress}%` }}
                                    />
                                </div>
                                <span className="text-xs font-medium text-slate-500">
                                    {task.progress}%
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex-1 flex items-center relative">
                <div
                    className={`absolute ${
                        task.isCritical
                            ? 'bg-red-500 hover:bg-red-400'
                            : 'bg-slate-700 hover:bg-slate-600'
                    } h-3 rounded-full cursor-pointer transition-colors shadow-sm`}
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
                {enrichedTask?.isDelayed && (
                    <div
                        className="absolute flex items-center gap-1"
                        style={{
                            left: taskPosition.marginLeft +
                                taskPosition.width / 2 - 28,
                            top: -14
                        }}
                    >
                        <span className="text-[10px] py-0.5 px-2 rounded-full bg-amber-100 text-amber-700 font-semibold flex items-center gap-1 shadow-sm border border-amber-200">
                            <AlertTriangleFilledIcon />
                            Delayed
                        </span>
                    </div>
                )}
                {filteredDeps.map(depKey => {
                    const depTask = taskKeyMap.get(depKey);
                    const depProject = projectKeyToProject.get(depTask.projectKey);
                    if (!depProject || !depTask) return null;

                    const depProjectIndex = projectIndexMap.get(depProject.projectKey);
                    const depTaskIndex = depProject.tasks.findIndex(
                        t => t.id === depTask.id
                    );

                    return (
                        <DependencyArrow
                            key={`dep-${depTask.id}-${task.id}`}
                            depTask={depTask}
                            task={task}
                            taskPosition={taskPosition}
                            sidebarCollapsed={sidebarCollapsed}
                            timelineStart={timelineStart}
                            projectIndex={projectIndex}
                            depProjectIndex={depProjectIndex}
                            depTaskIndex={depTaskIndex}
                            taskGlobalIndex={taskGlobalIndex}
                            projectRowOffsets={projectRowOffsets}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default React.memo(TimelineTaskBar);
