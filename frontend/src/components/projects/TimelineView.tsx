import React from 'react';
import { EmptyState } from '../common';
import TimelineHeader from './TimelineHeader';
import TimelineProjectRow from './TimelineProjectRow';
import DependencyOverlay from './DependencyOverlay';
import { TimelineViewProps } from './types';

const TimelineView = ({
    processedProjects,
    allTasks,
    draggingTaskKey,
    taskKeyMap,
    projectKeyToProject,
    filteredTaskIds,
    filteredProjectKeys,
    expandedProjects,
    sidebarCollapsed,
    sidebarWidth,
    timelineStart,
    timelineEnd,
    timelineWidth,
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
    optimization,
    onOptimize,
    onScrollToToday,
}: TimelineViewProps) => {
    // A project-key filter already narrows filteredProjectKeys, so no separate check is needed.
    const visibleProjects = processedProjects
        .filter((project) => filteredProjectKeys.has(project.projectKey) || !hasActiveFilters);

    if (visibleProjects.length === 0) {
        const emptyTitle = hasActiveFilters ? 'No matching projects' : 'No projects yet';
        const emptyDescription = hasActiveFilters
            ? 'Try adjusting your filters to see more results.'
            : 'Create your first project to see it on the timeline.';
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-grow flex flex-col">
                <EmptyState
                    variant={hasActiveFilters ? 'search' : 'timeline'}
                    title={emptyTitle}
                    description={emptyDescription}
                    className="flex-grow"
                />
            </div>
        );
    }

    return (
        <>
                <TimelineHeader
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                sidebarWidth={sidebarWidth}
                sidebarCollapsed={sidebarCollapsed}
                processedProjects={processedProjects}
                optimization={optimization}
                onOptimize={onOptimize}
                onScrollToToday={onScrollToToday}
                onSidebarToggle={onSidebarToggle}
                headerRef={headerRef}
                syncScroll={syncScroll}
            />
            <div className="space-y-3 overflow-auto flex-grow relative" ref={timelineRef} onScroll={syncScroll}>
                <DependencyOverlay
                    containerRef={timelineRef}
                    allTasks={allTasks}
                    draggingTaskKey={draggingTaskKey}
                    taskKeyMap={taskKeyMap}
                    expandedProjects={expandedProjects}
                    projectKeyToProject={projectKeyToProject}
                    filteredTaskIds={filteredTaskIds}
                    filteredProjectKeys={filteredProjectKeys}
                    hasActiveFilters={hasActiveFilters}
                />
                {visibleProjects.map((project) => (
                    <TimelineProjectRow
                        key={project.projectKey}
                        project={project}
                        isExpanded={expandedProjects[project.projectKey] ?? false}
                        sidebarCollapsed={sidebarCollapsed}
                        sidebarWidth={sidebarWidth}
                        timelineStart={timelineStart}
                        timelineWidth={timelineWidth}
                        hasActiveFilters={hasActiveFilters}
                        filteredTaskIds={filteredTaskIds}
                        onToggleExpand={onToggleExpand}
                        onOpenProjectModal={onOpenProjectModal}
                        onOpenTaskModal={onOpenTaskModal}
                        onTooltipShow={onTooltipShow}
                        onTooltipMove={onTooltipMove}
                        onTooltipHide={onTooltipHide}
                        onMouseDown={onMouseDown}
                        shouldPreventClick={shouldPreventClick}
                        optimization={optimization}
                    />
                ))}
            </div>
        </>
    );
};

export default React.memo(TimelineView);
