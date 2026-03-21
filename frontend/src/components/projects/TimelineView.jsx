import React, { useMemo } from 'react';
import { EmptyState } from '../common';
import TimelineHeader from './TimelineHeader';
import TimelineProjectRow from './TimelineProjectRow';

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
    optimization,
    onOptimize,
    onScrollToToday,
    onAcceptOptimization,
    onRejectOptimization,
}) => {
    const projectIndexMap = useMemo(() => {
        const map = new Map();
        processedProjects.forEach((p, i) => map.set(p.projectKey, i));
        return map;
    }, [processedProjects]);

    const projectKeyToProject = useMemo(() => {
        const map = new Map();
        for (const p of processedProjects) map.set(p.projectKey, p);
        return map;
    }, [processedProjects]);

    const taskKeyMap = useMemo(() => {
        const map = new Map();
        for (const t of allTasks) map.set(t.taskKey, t);
        return map;
    }, [allTasks]);

    const visibleProjects = processedProjects
        .filter(p => !projectKeyFilter || p.projectKey === projectKeyFilter)
        .filter(p => filteredProjectKeys.has(p.projectKey) || !hasActiveFilters);

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
            {optimization?.showGhostBars && (
                <style>{`
                    @keyframes optGhostShimmer {
                        0%, 100% { background-position: 200% 0; }
                        50% { background-position: -200% 0; }
                    }
                `}</style>
            )}
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
            <div className="space-y-3 overflow-auto flex-grow" ref={timelineRef} onScroll={syncScroll}>
                {visibleProjects.map((project) => (
                    <TimelineProjectRow
                        key={project.projectKey}
                        project={project}
                        projectIndex={projectIndexMap.get(project.projectKey)}
                        isExpanded={expandedProjects[project.projectKey]}
                        sidebarCollapsed={sidebarCollapsed}
                        sidebarWidth={sidebarWidth}
                        timelineStart={timelineStart}
                        timelineWidth={timelineWidth}
                        hasActiveFilters={hasActiveFilters}
                        filteredTaskIds={filteredTaskIds}
                        filteredProjectKeys={filteredProjectKeys}
                        projectRowOffsets={projectRowOffsets}
                        taskKeyMap={taskKeyMap}
                        projectIndexMap={projectIndexMap}
                        projectKeyToProject={projectKeyToProject}
                        expandedProjects={expandedProjects}
                        projectKeyFilter={projectKeyFilter}
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
