import React from 'react';
import {
    formatShortDate,
    STATUS_CONFIG,
    calculateTaskPosition,
    generateBezierPath
} from '../../util/helpers';
import { TIMELINE_CONSTANTS, getTaskRowHeight } from '../../config/timelineConstants';
import { EmptyState } from '../common';
import {
    ChevronRightIcon,
    PlusIcon,
    AlertTriangleFilledIcon,
    ChevronsLeftIcon
} from '../common/Icons';
const { DAY_WIDTH, CROSS_PROJECT_DEPENDENCY_OFFSET } = TIMELINE_CONSTANTS;

const TimelineView = ({
    processedProjects,
    allTasks,
    filteredTasks,
    filteredTaskIds,
    filteredProjectKeys,
    projectRowOffsets,
    expandedProjects,
    sidebarCollapsed,
    sidebarWidth,
    timelineStart,
    timelineEnd,
    timelineWidth,
    projectKeyFilter,
    hasActiveFilters,
    onToggleExpand,
    onOpenProjectModal,
    onOpenTaskModal,
    onTooltipShow,
    onTooltipMove,
    onTooltipHide,
    onSidebarToggle,
    onMouseDown,
    shouldPreventClick,
    headerRef,
    timelineRef,
    syncScroll,
}) => {
    const renderMonths = () => {
        const months = [];
        let year = timelineStart.getFullYear(), month = timelineStart.getMonth();
        const endYear = timelineEnd.getFullYear(), endMonth = timelineEnd.getMonth();
        const today = new Date();

        while (year < endYear || (year === endYear && month <= endMonth)) {
            const currentYear = year;
            const currentMonth = month;
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const monthDate = new Date(currentYear, currentMonth, 1);

            const days = Array.from({ length: daysInMonth }, (_, i) => {
                const day = new Date(currentYear, currentMonth, i + 1);
                const isToday = today.toDateString() === day.toDateString();
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const weekendClass = isWeekend ? 'bg-slate-50' : '';
                const todayClass = isToday
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-500';
                const dayClassName = `text-xs p-1 border-l border-slate-200 flex items-center justify-center ${
                    weekendClass
                } ${todayClass}`;
                return (
                    <div
                        key={`${currentYear}-${currentMonth}-${i}`}
                        className={dayClassName}
                        style={{ width: `${DAY_WIDTH}px`, minWidth: `${DAY_WIDTH}px` }}
                    >
                        {i + 1}
                    </div>
                );
            });

            const monthHeaderClass = 'text-xs font-semibold text-slate-700 border-b border-slate-200 p-2 bg-white';
            months.push(
                <div
                    key={`${year}-${month}`}
                    className="flex flex-col text-center border-r border-slate-200"
                    style={{ width: `${daysInMonth * DAY_WIDTH}px` }}
                >
                    <div className={monthHeaderClass}>
                        {monthDate.toLocaleDateString('default', { month: 'short' }).toUpperCase()} {year}
                    </div>
                    <div className="flex">{days}</div>
                </div>
            );

            month++;
            if (month > 11) { month = 0; year++; }
        }
        return months;
    };

    const renderProjectRow = (project, projectIndex) => {
        const projectFilteredTasks = project.tasks.filter(
            t => filteredTasks.some(ft => ft.taskKey === t.taskKey)
        );
        if (projectFilteredTasks.length === 0 && hasActiveFilters) return null;
        const isExpanded = expandedProjects[project.projectKey];

        const projectContainerClass = isExpanded
            ? 'rounded-t-lg border-b-0'
            : 'rounded-lg';
        const sidebarBaseClass = 'sticky left-0 z-10 bg-white'
            + ' border border-slate-200 transition-all'
            + ' duration-200 hover:border-slate-300'
            + ` ${projectContainerClass}`;

        return (
            <div key={project.projectKey} className="relative">
                <div className="flex group" style={{ width: `${timelineWidth}px` }}>
                    <div
                        className={sidebarBaseClass}
                        style={{ minWidth: `${sidebarWidth}px`, width: `${sidebarWidth}px` }}
                    >
                        {sidebarCollapsed ? (
                            <div className="p-2 flex flex-col items-center justify-center h-full">
                                <button
                                    onClick={() => onToggleExpand(project.projectKey)}
                                    className={
                                        'w-9 h-9 flex items-center justify-center'
                                        + ' rounded-lg bg-slate-100 hover:bg-slate-200'
                                        + ' text-xs font-bold text-slate-700'
                                    }
                                    title={project.summary}
                                >
                                    {project.projectKey.substring(0, 3)}
                                </button>
                            </div>
                        ) : (
                            <div className="p-3">
                                <div className="flex items-center gap-2.5">
                                    <button
                                        onClick={() => onToggleExpand(project.projectKey)}
                                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex-shrink-0"
                                        title={isExpanded ? 'Collapse tasks' : 'Expand tasks'}
                                    >
                                        <ChevronRightIcon
                                            className={`w-3.5 h-3.5 transition-transform ${
                                                isExpanded ? 'rotate-90' : ''
                                            }`}
                                        />
                                    </button>
                                    <div
                                        className="flex-1 min-w-0 cursor-pointer"
                                        onClick={() => onOpenProjectModal(project)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-500">
                                                {project.projectKey}
                                            </span>
                                            <span className="text-sm font-medium text-slate-800 truncate">
                                                {project.summary}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                                                <div
                                                    className="h-full bg-slate-700 rounded-full"
                                                    style={{ width: `${project.projectProgress}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-slate-500">
                                                {project.projectProgress}%
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                - {project.tasks?.length || 0} tasks
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onOpenTaskModal(project, null)}
                                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors flex-shrink-0"
                                        title="Add task"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 flex items-center relative">
                        {project.projectStartDate && project.projectDueDate && (
                            <div
                                className="absolute bg-slate-800 h-4 rounded cursor-pointer hover:bg-slate-700 transition-colors"
                                style={calculateTaskPosition(
                                    project.projectStartDate,
                                    project.projectDueDate,
                                    timelineStart
                                )}
                                onMouseEnter={(e) => onTooltipShow(e, {
                                    type: 'project',
                                    title: project.summary,
                                    subtitle: project.projectKey,
                                    dates: `${formatShortDate(project.projectStartDate)} -> ${
                                        formatShortDate(project.projectDueDate)
                                    }`,
                                    progress: project.projectProgress,
                                    extra: `${project.tasks?.length || 0} tasks`
                                })}
                                onMouseMove={onTooltipMove}
                                onMouseLeave={onTooltipHide}
                            />
                        )}
                    </div>
                </div>

                {isExpanded && (
                    <div className="flex flex-col">
                        {(hasActiveFilters ? projectFilteredTasks : project.tasks).map(
                            (task, taskIndex, arr) => {
                                const taskPosition = calculateTaskPosition(
                                    task.startDate,
                                    task.dueDate,
                                    timelineStart
                                );
                                const isLastTask = taskIndex === arr.length - 1;
                                const taskGlobalIndex = projectRowOffsets[projectIndex] +
                                    project.tasks.findIndex(t => t.id === task.id);
                                const enrichedTask = allTasks.find(t => t.taskKey === task.taskKey);

                                const taskRowClass = `sticky left-0 z-10 bg-slate-50 border-x border-b border-slate-200 hover:bg-slate-100 cursor-pointer transition-all duration-200 ${
                                    isLastTask ? 'rounded-b-lg' : ''
                                }`;

                                return (
                                    <div
                                        key={task.taskKey}
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
                                                    <p className="text-sm text-slate-700 truncate mb-1">
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
                                            {task.dependencies?.filter(depKey => {
                                                const depTask = allTasks.find(t => t.taskKey === depKey);
                                                if (!depTask || !filteredTaskIds.has(depTask.id)) return false;
                                                const depProject = processedProjects.find(
                                                    p => p.projectKey === depTask.projectKey
                                                );
                                                return depProject &&
                                                    expandedProjects[depProject.projectKey] &&
                                                    (!projectKeyFilter ||
                                                        depProject.projectKey === projectKeyFilter) &&
                                                    (filteredProjectKeys.has(depProject.projectKey) ||
                                                        !hasActiveFilters);
                                            }).map(depKey => {
                                                const depTask = allTasks.find(t => t.taskKey === depKey);
                                                const depProject = processedProjects.find(
                                                    p => p.projectKey === depTask.projectKey
                                                );
                                                if (!depProject || !depTask) return null;

                                                const depProjectIndex = processedProjects.findIndex(
                                                    p => p.projectKey === depProject.projectKey
                                                );
                                                const depTaskIndex = depProject.tasks.findIndex(
                                                    t => t.id === depTask.id
                                                );
                                                let relativeDepIndex = (
                                                    projectRowOffsets[depProjectIndex] + depTaskIndex
                                                ) - taskGlobalIndex;
                                                if (depProjectIndex !== projectIndex) {
                                                    relativeDepIndex -= CROSS_PROJECT_DEPENDENCY_OFFSET;
                                                }

                                                const verticalSpacing = getTaskRowHeight(
                                                    sidebarCollapsed
                                                );
                                                const startY = relativeDepIndex * verticalSpacing +
                                                    verticalSpacing / 2;
                                                const endY = verticalSpacing / 2;
                                                const depPosition = calculateTaskPosition(
                                                    depTask.startDate,
                                                    depTask.dueDate,
                                                    timelineStart
                                                );
                                                const startX = depPosition.marginLeft +
                                                    depPosition.width;
                                                const endX = taskPosition.marginLeft;
                                                const minY = Math.min(startY, endY);
                                                const svgHeight = Math.abs(endY - startY) + 20;

                                                return (
                                                    <svg
                                                        key={`dep-${depTask.id}-${task.id}`}
                                                        className="absolute"
                                                        style={{
                                                            top: `${minY}px`,
                                                            left: 0,
                                                            width: '100%',
                                                            height: `${svgHeight}px`,
                                                            pointerEvents: 'none',
                                                            zIndex: 2
                                                        }}
                                                    >
                                                        <path
                                                            d={generateBezierPath(
                                                                startX,
                                                                startY - minY,
                                                                endX,
                                                                endY - minY
                                                            )}
                                                            stroke="#94a3b8"
                                                            strokeWidth="1.5"
                                                            fill="none"
                                                            strokeDasharray="4 2"
                                                            markerEnd="url(#arrowhead)"
                                                        />
                                                        <defs>
                                                            <marker
                                                                id="arrowhead"
                                                                markerWidth="6"
                                                                markerHeight="4"
                                                                refX="0"
                                                                refY="2"
                                                                orient="auto"
                                                            >
                                                                <polygon
                                                                    points="0 0, 6 2, 0 4"
                                                                    fill="#94a3b8"
                                                                />
                                                            </marker>
                                                        </defs>
                                                    </svg>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            }
                        )}
                    </div>
                )}
            </div>
        );
    };

    const visibleProjects = processedProjects
        .filter(p => !projectKeyFilter || p.projectKey === projectKeyFilter)
        .filter(p => filteredProjectKeys.has(p.projectKey) || !hasActiveFilters);

    if (visibleProjects.length === 0) {
        const emptyTitle = hasActiveFilters ? 'No matching projects' : 'No projects yet';
        const emptyDescription = hasActiveFilters
            ? 'Try adjusting your filters to see more results.'
            : 'Create your first project to see it on the timeline.';
        return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-grow flex flex-col">
                <EmptyState
                    variant={hasActiveFilters ? 'search' : 'timeline'}
                    title={emptyTitle}
                    description={emptyDescription}
                    className="flex-grow"
                />
            </div>
        );
    }

    const headerSidebarClass = 'sticky left-0 z-10 flex items-center justify-between bg-white border-r border-slate-200 transition-all duration-200';

    return (
        <>
            <div
                className="flex mb-3 overflow-hidden rounded-lg border border-slate-200 bg-white"
                ref={headerRef}
                onScroll={syncScroll}
            >
                <div
                    className={headerSidebarClass}
                    style={{ minWidth: `${sidebarWidth}px`, width: `${sidebarWidth}px` }}
                >
                    <button
                        onClick={onSidebarToggle}
                        className="p-2 ml-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <ChevronsLeftIcon
                            className={`w-4 h-4 transition-transform ${
                                sidebarCollapsed ? 'rotate-180' : ''
                            }`}
                        />
                    </button>
                    {!sidebarCollapsed && (
                        <span className="text-xs text-slate-500 pr-3">
                            {processedProjects.length} projects
                        </span>
                    )}
                </div>
                <div className="flex-1 flex relative bg-white">{renderMonths()}</div>
            </div>
            <div className="space-y-2 overflow-auto flex-grow" ref={timelineRef} onScroll={syncScroll}>
                {visibleProjects.map((project) =>
                    renderProjectRow(project, processedProjects.indexOf(project))
                )}
            </div>
        </>
    );
};

export default TimelineView;
