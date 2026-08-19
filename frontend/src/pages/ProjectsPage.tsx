import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectsContext';
import Header from '../components/layout/Header';
import { ChartBarIcon, ListIcon } from '../components/common/Icons';
import ErrorBoundary from '../components/common/ErrorBoundary';
import FilterBar from '../components/projects/FilterBar';
import TaskListView from '../components/projects/TaskListView';
import TimelineView from '../components/projects/TimelineView';
import OptimizationMetrics from '../components/projects/OptimizationMetrics';
import { FilterTooltip, TaskTooltip } from '../components/projects/TimelineTooltips';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEnrichedProjects } from '../hooks/useEnrichedProjects';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import { useLogout } from '../hooks/useLogout';
import { useModal } from '../hooks/useModal';
import { useProjectsPageState } from '../hooks/useProjectsPageState';
import { useScheduleOptimization } from '../hooks/useScheduleOptimization';
import { useTaskFiltering } from '../hooks/useTaskFiltering';
import { useTaskResizePreview } from '../hooks/useTaskResizePreview';
import { useTimelineViewport } from '../hooks/useTimelineViewport';
import { useUrlSyncedFilters } from '../hooks/useUrlSyncedFilters';
import { getSidebarWidth } from '../config/timelineConstants';
import { ModalMode, ModalType, Project, Task } from '../types';
import {
    FilterTooltipState, TimelineTooltipContent, TooltipState,
} from '../components/projects/types';

// Lazy so TipTap (loaded by the modal's rich-text editor) stays out of the page bundle.
const TaskProjectModal = React.lazy(() => import('../components/modals/TaskProjectModal'));

const ProjectsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const {
        projects, projectsError, updateTaskSchedule, retryProjects,
    } = useProjects();
    const handleLogout = useLogout();

    const {
        open: modalOpen, type: modalType, mode: modalMode,
        project: currentProject, task: currentTask,
        openModal: baseOpenModal, closeModal: baseCloseModal,
    } = useModal();

    const { filterState, setFilterState, sortState, setSortState, viewState, setViewState } =
        useProjectsPageState();

    const { allTasks, processedProjects, taskKeyToTaskMap, projectKeyToProject } =
        useEnrichedProjects(projects);

    /**
     * Opens a modal and records the selection in the URL.
     *
     * Merges into the existing query string rather than replacing it. `navigate('?selectedIssue=…')`
     * discards every other parameter, which silently dropped `commentId` before the comment thread
     * could read it (so deep-links from search never worked) and reset an active project filter
     * behind the open modal.
     */
    const openModal = useCallback((
        type: ModalType,
        mode: ModalMode,
        project: Project | null = null,
        task: Task | null = null,
    ) => {
        baseOpenModal(type, mode, project, task);
        if (type === 'task' && task) {
            const params = new URLSearchParams(location.search);
            params.set('selectedIssue', task.taskKey);
            navigate({ search: params.toString() }, { replace: true });
        }
    }, [baseOpenModal, location.search, navigate]);

    const closeModal = useCallback(() => {
        baseCloseModal();
        const params = new URLSearchParams(location.search);
        params.delete('selectedIssue');
        params.delete('commentId');
        navigate({ search: params.toString() }, { replace: true });
    }, [baseCloseModal, location.search, navigate]);

    const {
        handleFilterChange, handleProjectFilterChange, handleAssignedToMeChange,
        clearAllFilters, projectKeyFilter,
    } = useUrlSyncedFilters({
        filterState, setFilterState, setViewState,
        processedProjects, navigate, location, openModal,
    });

    const closeFilterDropdown = useCallback(
        () => setFilterState(previous => ({ ...previous, openFilterDropdown: null })),
        [setFilterState],
    );

    const handleSort = useCallback((field: string) => {
        setSortState(previous => ({
            field,
            order: previous.field === field && previous.order === 'asc' ? 'desc' : 'asc',
        }));
    }, [setSortState]);

    const { optimization, handleOptimize, handleAcceptOptimization, handleRejectOptimization } =
        useScheduleOptimization({ processedProjects, onApplied: retryProjects });

    // Escape is deliberately absent: the task/project modal owns that key and checks for unsaved
    // changes first. A second listener here closed the modal unconditionally in the same event,
    // so the confirmation never rendered and the edits were lost.
    useKeyboardShortcuts([
        { key: 'n', handler: () => openModal('task', 'create') },
        { key: 'p', handler: () => openModal('project', 'create') },
        { key: '/', handler: () => document.querySelector<HTMLElement>('[data-search-input]')?.focus() },
        { key: '1', handler: () => setViewState((previous) => ({ ...previous, mode: 'timeline' })) },
        { key: '2', handler: () => setViewState((previous) => ({ ...previous, mode: 'list' })) },
    ]);

    // The timeline is unusable on a narrow screen, so fall back to the list.
    useEffect(() => {
        const applyMobileFallback = () => {
            if (window.innerWidth < 640) {
                setViewState((previous) => (previous.mode === 'timeline'
                    ? { ...previous, mode: 'list' } : previous));
            }
        };
        applyMobileFallback();
        window.addEventListener('resize', applyMobileFallback);
        return () => window.removeEventListener('resize', applyMobileFallback);
    }, [setViewState]);

    const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: null });
    const [filterTooltip, setFilterTooltip] =
        useState<FilterTooltipState>({ visible: false, x: 0, y: 0, text: '' });

    const sidebarWidth = getSidebarWidth(viewState.sidebarCollapsed);
    const filterRef = useRef<HTMLDivElement | null>(null);
    useClickOutside(filterRef, closeFilterDropdown);

    const { displayProjects, startResize, shouldPreventClick, draggingTaskKey } =
        useTaskResizePreview({ processedProjects, updateTaskSchedule });

    const { filteredTasks, filteredTaskIds, filteredProjectKeys, hasActiveFilters } = useTaskFiltering({
        tasks: allTasks,
        filters: filterState.filters,
        searchQuery: filterState.searchQuery,
        assignedToMe: filterState.assignedToMe,
        currentUser: user,
        sortField: sortState.field,
        sortOrder: sortState.order,
        urlParams: location.search,
    });

    const {
        timelineStart, timelineEnd, timelineWidth,
        headerRef, timelineRef, syncScroll, scrollToToday,
    } = useTimelineViewport({
        processedProjects,
        suggestions: optimization.suggestionMap,
    });

    // Every handler below is memoised because the timeline tree is wrapped in React.memo. A fresh
    // function identity on each render makes those wrappers unable to bail out, and the tooltip
    // updates on every mousemove — so one hover across a bar re-rendered every project row and
    // every task bar on the board.
    const toggleExpand = useCallback((projectKey: string) => setViewState((previous) => ({
        ...previous,
        expandedProjects: {
            ...previous.expandedProjects,
            [projectKey]: !previous.expandedProjects[projectKey],
        },
    })), [setViewState]);

    const showTooltip = useCallback((event: React.MouseEvent, content: TimelineTooltipContent) => {
        setTooltip({ visible: true, x: event.clientX, y: event.clientY, content });
    }, []);
    const moveTooltip = useCallback((event: React.MouseEvent) => {
        setTooltip((previous) => (previous.visible
            ? { ...previous, x: event.clientX, y: event.clientY } : previous));
    }, []);
    const hideTooltip = useCallback(() => {
        setTooltip((previous) => (previous.visible
            ? { visible: false, x: 0, y: 0, content: null } : previous));
    }, []);

    const showFilterTooltip = useCallback((next: FilterTooltipState) => setFilterTooltip(next), []);
    const hideFilterTooltip = useCallback(
        () => setFilterTooltip({ visible: false, x: 0, y: 0, text: '' }), []);

    const toggleFilterDropdown = useCallback((field: string | null) => setFilterState((previous) => ({
        ...previous,
        openFilterDropdown: previous.openFilterDropdown === field ? null : field,
    })), [setFilterState]);

    const setSearchInput = useCallback((value: string) => setFilterState((previous) => ({
        ...previous, searchInput: value,
    })), [setFilterState]);

    const toggleSidebar = useCallback(() => setViewState((previous) => ({
        ...previous, sidebarCollapsed: !previous.sidebarCollapsed,
    })), [setViewState]);

    const setMode = useCallback((mode: 'timeline' | 'list') => setViewState((previous) => ({
        ...previous, mode,
    })), [setViewState]);

    const openCreateProject = useCallback(() => openModal('project', 'create'), [openModal]);
    const openCreateTask = useCallback(() => openModal('task', 'create'), [openModal]);
    const openEditProject = useCallback(
        (project: Project) => openModal('project', 'edit', project), [openModal]);
    const openTask = useCallback((project: Project, task: Task | null) => (task
        ? openModal('task', 'edit', project, task)
        : openModal('task', 'create', project)), [openModal]);
    const openTaskFromList = useCallback(
        // A dependency row can point at a task whose project is not on screen, so the project is
        // optional here; openModal already treats a missing one as "no project context".
        (project: Project | undefined, task: Task) =>
            openModal('task', 'edit', project ?? null, task), [openModal]);

    const viewModes = useMemo(() => ['timeline', 'list'] as const, []);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
            <Header
                onLogout={handleLogout}
                onCreateProject={openCreateProject}
                onCreateTask={openCreateTask}
            />

            <div className="flex-grow flex flex-col">
                {projectsError && (
                    <div className="mx-6 lg:mx-10 mt-3 flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <span className="text-sm text-red-700 dark:text-red-300">{projectsError}</span>
                        <button
                            type="button"
                            onClick={retryProjects}
                            className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline shrink-0"
                        >
                            Retry
                        </button>
                    </div>
                )}

                <div className="px-6 lg:px-10 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-fade-in-slide">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2.5 shrink-0 mr-1">
                            <h1 className="text-sm font-semibold text-slate-900 dark:text-white">Projects</h1>
                            <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                                {allTasks.length} tasks
                            </span>
                        </div>

                        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />

                        <FilterBar
                            projects={projects}
                            allTasks={allTasks}
                            filters={filterState.filters}
                            searchInput={filterState.searchInput}
                            assignedToMe={filterState.assignedToMe}
                            projectKeyFilter={projectKeyFilter}
                            openFilterDropdown={filterState.openFilterDropdown}
                            hasActiveFilters={hasActiveFilters}
                            onFilterDropdownToggle={toggleFilterDropdown}
                            onFilterChange={handleFilterChange}
                            onProjectFilterChange={handleProjectFilterChange}
                            onSearchInputChange={setSearchInput}
                            onAssignedToMeChange={handleAssignedToMeChange}
                            onClearAllFilters={clearAllFilters}
                            onFilterTooltipShow={showFilterTooltip}
                            onFilterTooltipHide={hideFilterTooltip}
                            filterRef={filterRef}
                        />

                        <div
                            className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg shrink-0 ml-auto"
                            role="group"
                            aria-label="View mode"
                        >
                            {viewModes.map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setMode(mode)}
                                    aria-pressed={viewState.mode === mode}
                                    className={
                                        'py-1.5 px-3 text-sm font-medium rounded-md transition-all duration-200 '
                                        + (mode === 'timeline' ? 'hidden sm:flex ' : '')
                                        + (viewState.mode === mode
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')
                                    }
                                >
                                    <span className="flex items-center gap-1.5">
                                        {mode === 'timeline' ? <ChartBarIcon /> : <ListIcon />}
                                        <span className="hidden sm:inline">
                                            {mode === 'timeline' ? 'Timeline' : 'List'}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-6 lg:px-10 pt-4 pb-6 flex-grow flex flex-col">
                    {optimization.result && viewState.mode === 'timeline' && (
                        <OptimizationMetrics
                            originalMetrics={optimization.result.originalMetrics}
                            optimizedMetrics={optimization.result.optimizedMetrics}
                            suggestions={optimization.result.suggestions}
                            suggestionsCount={optimization.suggestionMap?.size ?? 0}
                            skippedTaskKeys={optimization.result.skippedTaskKeys}
                            chosenRule={optimization.result.chosenRule}
                            onAccept={handleAcceptOptimization}
                            onReject={handleRejectOptimization}
                            isApplying={optimization.applying}
                        />
                    )}

                    {viewState.mode === 'list' ? (
                        <ErrorBoundary level="section" resetKey={viewState.mode}>
                            <TaskListView
                                filteredTasks={filteredTasks}
                                taskKeyToTaskMap={taskKeyToTaskMap}
                                projectKeyToProject={projectKeyToProject}
                                sortField={sortState.field}
                                sortOrder={sortState.order}
                                hasActiveFilters={hasActiveFilters}
                                onSort={handleSort}
                                onTaskClick={openTaskFromList}
                            />
                        </ErrorBoundary>
                    ) : (
                        <ErrorBoundary level="section" resetKey={viewState.mode}>
                            <TimelineView
                                processedProjects={displayProjects}
                                allTasks={allTasks}
                                draggingTaskKey={draggingTaskKey}
                                taskKeyMap={taskKeyToTaskMap}
                                projectKeyToProject={projectKeyToProject}
                                filteredTaskIds={filteredTaskIds}
                                filteredProjectKeys={filteredProjectKeys}
                                expandedProjects={viewState.expandedProjects}
                                sidebarCollapsed={viewState.sidebarCollapsed}
                                sidebarWidth={sidebarWidth}
                                timelineStart={timelineStart}
                                timelineEnd={timelineEnd}
                                timelineWidth={timelineWidth}
                                hasActiveFilters={hasActiveFilters}
                                onToggleExpand={toggleExpand}
                                onOpenProjectModal={openEditProject}
                                onOpenTaskModal={openTask}
                                onTooltipShow={showTooltip}
                                onTooltipMove={moveTooltip}
                                onTooltipHide={hideTooltip}
                                onSidebarToggle={toggleSidebar}
                                onMouseDown={startResize}
                                shouldPreventClick={shouldPreventClick}
                                headerRef={headerRef}
                                timelineRef={timelineRef}
                                syncScroll={syncScroll}
                                optimization={optimization}
                                onOptimize={handleOptimize}
                                onScrollToToday={scrollToToday}
                            />
                        </ErrorBoundary>
                    )}
                </div>

                <TaskTooltip tooltip={tooltip} />
                <FilterTooltip filterTooltip={filterTooltip} />

                {modalOpen && modalType && modalMode && (
                    <Suspense fallback={null}>
                        <TaskProjectModal
                            modalType={modalType}
                            modalMode={modalMode}
                            project={currentProject}
                            task={currentTask}
                            onClose={closeModal}
                        />
                    </Suspense>
                )}
            </div>
        </div>
    );
};

export default ProjectsPage;
