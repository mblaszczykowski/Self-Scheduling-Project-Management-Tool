import React from 'react';
import {
    formatShortDate,
    calculateTaskPosition,
} from '../../util/helpers';
import {
    ChevronRightIcon,
    PlusIcon,
} from '../common/Icons';
import TimelineTaskBar from './TimelineTaskBar';

const TimelineProjectRow = ({
    project,
    projectIndex,
    isExpanded,
    sidebarCollapsed,
    sidebarWidth,
    timelineStart,
    timelineWidth,
    hasActiveFilters,
    filteredTaskIds,
    filteredProjectKeys,
    projectRowOffsets,
    taskKeyMap,
    projectIndexMap,
    projectKeyToProject,
    expandedProjects,
    projectKeyFilter,
    onToggleExpand,
    onOpenProjectModal,
    onOpenTaskModal,
    onTooltipShow,
    onTooltipMove,
    onTooltipHide,
    onMouseDown,
    shouldPreventClick,
    optimization,
}) => {
    const projectFilteredTasks = project.tasks.filter(
        t => filteredTaskIds.has(t.id)
    );
    if (projectFilteredTasks.length === 0 && hasActiveFilters) return null;

    const projectContainerClass = isExpanded
        ? 'rounded-t-xl border-b-0'
        : 'rounded-xl';
    const sidebarBaseClass = 'sticky left-0 z-10 bg-white dark:bg-slate-800'
        + ' border border-slate-200 dark:border-slate-700 transition-all'
        + ' duration-200 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm'
        + ` ${projectContainerClass}`;

    const tasksToRender = hasActiveFilters ? projectFilteredTasks : project.tasks;

    return (
        <div className="relative">
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
                        <div className="p-3 pl-3.5">
                            <div className="flex items-center gap-2.5">
                                <button
                                    onClick={() => onToggleExpand(project.projectKey)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors flex-shrink-0"
                                    title={isExpanded ? 'Collapse tasks' : 'Expand tasks'}
                                >
                                    <ChevronRightIcon
                                        className={`w-3.5 h-3.5 transition-transform ${
                                            isExpanded ? 'rotate-90' : ''
                                        }`}
                                    />
                                </button>
                                <div
                                    className="flex-1 min-w-0 cursor-pointer group/proj"
                                    onClick={() => onOpenProjectModal(project)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 font-mono">
                                            {project.projectKey}
                                        </span>
                                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate group-hover/proj:text-blue-600 dark:group-hover/proj:text-blue-400 transition-colors">
                                            {project.summary}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-[100px]">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    project.projectProgress === 100 ? 'bg-green-500' : 'bg-slate-700 dark:bg-slate-300'
                                                }`}
                                                style={{ width: `${project.projectProgress}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                                            {project.projectProgress}%
                                        </span>
                                        <span className="text-xs text-slate-400 dark:text-slate-500">
                                            {project.tasks?.length || 0} tasks
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onOpenTaskModal(project, null)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
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
                            className="absolute h-1.5 rounded-[2px] bg-slate-300 dark:bg-slate-600 cursor-pointer hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors"
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
                    {tasksToRender.map((task, taskIndex, arr) => {
                        const isLastTask = taskIndex === arr.length - 1;
                        const taskGlobalIndex = projectRowOffsets[projectIndex] +
                            project.tasks.findIndex(t => t.id === task.id);
                        const enrichedTask = taskKeyMap.get(task.taskKey);

                        return (
                            <TimelineTaskBar
                                key={task.taskKey}
                                task={task}
                                project={project}
                                isLastTask={isLastTask}
                                sidebarCollapsed={sidebarCollapsed}
                                sidebarWidth={sidebarWidth}
                                timelineStart={timelineStart}
                                timelineWidth={timelineWidth}
                                taskGlobalIndex={taskGlobalIndex}
                                enrichedTask={enrichedTask}
                                filteredTaskIds={filteredTaskIds}
                                filteredProjectKeys={filteredProjectKeys}
                                hasActiveFilters={hasActiveFilters}
                                expandedProjects={expandedProjects}
                                projectKeyFilter={projectKeyFilter}
                                projectIndex={projectIndex}
                                projectIndexMap={projectIndexMap}
                                projectKeyToProject={projectKeyToProject}
                                taskKeyMap={taskKeyMap}
                                projectRowOffsets={projectRowOffsets}
                                onTooltipShow={onTooltipShow}
                                onTooltipMove={onTooltipMove}
                                onTooltipHide={onTooltipHide}
                                onMouseDown={onMouseDown}
                                shouldPreventClick={shouldPreventClick}
                                onOpenTaskModal={onOpenTaskModal}
                                optimization={optimization}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default React.memo(TimelineProjectRow);
