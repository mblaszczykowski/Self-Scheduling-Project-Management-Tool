import React, { Suspense, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ProjectsContext } from '../context/ProjectsContext';
import Header from '../components/layout/Header';
import { ChartBarIcon, ListIcon } from '../components/common/Icons';
import FilterBar from '../components/projects/FilterBar';
import TaskListView from '../components/projects/TaskListView';
import TimelineView from '../components/projects/TimelineView';
import { TaskTooltip, FilterTooltip } from '../components/projects/TimelineTooltip';
import OptimizationMetrics from '../components/projects/OptimizationMetrics';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { useTaskFiltering } from '../hooks/useTaskFiltering';
import { useTimelineResize } from '../hooks/useTimelineResize';
import { useClickOutside } from '../hooks/useClickOutside';
import { useModal } from '../hooks/useModal';
import { useLogout } from '../hooks/useLogout';
import { useProjectsPageState } from '../hooks/useProjectsPageState';
import { useEnrichedProjects } from '../hooks/useEnrichedProjects';
import { useUrlSyncedFilters } from '../hooks/useUrlSyncedFilters';
import { useScheduleOptimization } from '../hooks/useScheduleOptimization';
import { toDateString, MS_PER_DAY } from '../util/helpers';
import { showToast } from '../util/toast';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import { getSidebarWidth, TIMELINE_CONSTANTS } from '../config/timelineConstants';

// Lazy so TipTap (loaded by the modal's rich-text editor) stays out of the page bundle.
const TaskProjectModal = React.lazy(() => import('../components/modals/TaskProjectModal'));

const { DAY_WIDTH, TIMELINE_END_PADDING } = TIMELINE_CONSTANTS;

const ProjectsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useContext(AuthContext);
    const { projects, projectsError, updateTask, refreshProjects } = useContext(ProjectsContext);
    const handleLogout = useLogout();

    const {
        open: modalOpen, type: modalType, mode: modalMode,
        project: currentProject, task: currentTask,
        openModal: baseOpenModal, closeModal: baseCloseModal,
    } = useModal();

    // --- Hooks: state, enrichment, filters, optimization ---

    const { filterState, setFilterState, sortState, setSortState, viewState, setViewState } =
        useProjectsPageState();

    const { allTasks, processedProjects, taskKeyToTaskMap, projectKeyToProject, projectRowOffsets } =
        useEnrichedProjects(projects);

    const openModal = useCallback((type, mode, project = null, task = null) => {
        baseOpenModal(type, mode, project, task);
        if (type === 'task' && task) {
            navigate(`?selectedIssue=${task.taskKey}`, { replace: true });
        }
    }, [baseOpenModal, navigate]);

    const closeModal = useCallback(() => {
        baseCloseModal();
        const params = new URLSearchParams(location.search);
        params.delete('selectedIssue');
        params.delete('commentId');
        navigate(`?${params.toString()}`, { replace: true });
    }, [baseCloseModal, location.search, navigate]);

    const {
        handleFilterChange, handleProjectFilterChange, handleAssignedToMeChange,
        handleSort, clearAllFilters, projectKeyFilter, closeFilterDropdown,
    } = useUrlSyncedFilters({
        filterState, setFilterState, viewState, setViewState,
        processedProjects, navigate, location, openModal, setSortState,
    });

    const { optimization, handleOptimize, handleAcceptOptimization, handleRejectOptimization } =
        useScheduleOptimization({ processedProjects, projects, refreshProjects });

    useKeyboardShortcuts([
        { key: 'n', handler: () => openModal('task', 'create') },
        { key: 'p', handler: () => openModal('project', 'create') },
        { key: '/', handler: () => document.querySelector('[data-search-input]')?.focus() },
        { key: '1', handler: () => setViewState(prev => ({ ...prev, mode: 'timeline' })) },
        { key: '2', handler: () => setViewState(prev => ({ ...prev, mode: 'list' })) },
        { key: 'Escape', handler: () => { if (modalOpen) closeModal(); } },
    ]);

    // Auto-switch to list on mobile
    useEffect(() => {
        const checkMobile = () => {
            if (window.innerWidth < 640 && viewState.mode === 'timeline') {
                setViewState(prev => ({ ...prev, mode: 'list' }));
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [viewState.mode, setViewState]);

    // --- Local UI state ---

    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null });
    const [filterTooltip, setFilterTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });

    const sidebarWidth = getSidebarWidth(viewState.sidebarCollapsed);

    const headerRef = useRef(null);
    const timelineRef = useRef(null);
    const filterRef = useRef(null);

    useClickOutside(filterRef, closeFilterDropdown);

    // --- Task resize ---

    // Resize is optimistic: each drag step updates a local preview only (no
    // network), and a single updateTask is committed when the drag ends. This
    // replaces the previous per-step write+refetch+toast (one drag = N calls).
    const [resizePreview, setResizePreview] = useState(null);
    const resizeRef = useRef(null);

    const handleTaskResize = useCallback((taskKey, projectKey, side, deltaDays) => {
        let current = resizeRef.current;
        if (!current || current.taskKey !== taskKey) {
            const project = processedProjects.find(p => p.projectKey === projectKey);
            const task = project?.tasks.find(t => t.taskKey === taskKey);
            if (!task) return;
            current = { taskKey, projectKey, task, startDate: task.startDate, dueDate: task.dueDate };
        }

        let { startDate, dueDate } = current;
        if (side === 'left') {
            const d = new Date(startDate);
            d.setDate(d.getDate() + deltaDays);
            const next = toDateString(d);
            if (next <= dueDate) startDate = next;
        } else {
            const d = new Date(dueDate);
            d.setDate(d.getDate() + deltaDays);
            const next = toDateString(d);
            if (next >= startDate) dueDate = next;
        }

        current = { ...current, startDate, dueDate };
        resizeRef.current = current;
        setResizePreview({ taskKey, projectKey, startDate, dueDate });
    }, [processedProjects]);

    const handleTaskResizeEnd = useCallback(() => {
        const current = resizeRef.current;
        resizeRef.current = null;
        if (!current) return;

        const { task, projectKey, taskKey, startDate, dueDate } = current;
        if (startDate === task.startDate && dueDate === task.dueDate) {
            setResizePreview(null);
            return;
        }

        updateTask(projectKey, taskKey, {
            summary: task.summary, description: task.description, status: task.status,
            startDate, dueDate, assignee: task.assignee,
            labels: task.labels, dependencyKeys: task.dependencies || [],
        }).then(() => {
            showToast('Task dates updated', 'success');
        }).catch(err => {
            console.error('Error updating task:', err);
            showToast('Failed to update task dates.', 'error');
        }).finally(() => {
            // Drop the preview; the refreshed store (or the unchanged server
            // state on failure) becomes the source of truth again.
            setResizePreview(null);
        });
    }, [updateTask]);

    const { startResize, shouldPreventClick } = useTimelineResize({
        onResizeMove: handleTaskResize,
        onResizeEnd: handleTaskResizeEnd,
        dayWidth: DAY_WIDTH,
    });

    // Overlay the in-progress resize onto the rendered projects so the bar
    // follows the cursor without touching the store until the drag commits.
    const displayProjects = useMemo(() => {
        if (!resizePreview) return processedProjects;
        return processedProjects.map(p =>
            p.projectKey !== resizePreview.projectKey ? p : {
                ...p,
                tasks: p.tasks.map(t =>
                    t.taskKey === resizePreview.taskKey
                        ? { ...t, startDate: resizePreview.startDate, dueDate: resizePreview.dueDate }
                        : t
                ),
            }
        );
    }, [processedProjects, resizePreview]);

    // --- Filtering ---

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

    // --- Timeline bounds ---

    const scrollRafRef = useRef(null);
    const syncScroll = useCallback(() => {
        if (scrollRafRef.current) return;
        scrollRafRef.current = requestAnimationFrame(() => {
            if (headerRef.current && timelineRef.current) {
                headerRef.current.scrollLeft = timelineRef.current.scrollLeft;
            }
            scrollRafRef.current = null;
        });
    }, []);

    const timelineBounds = useMemo(() => {
        const today = new Date();
        const minMonths = 4;
        const allDates = processedProjects.flatMap(p =>
            (p.tasks || []).flatMap(t => [
                new Date(t.startDate).getTime(),
                new Date(t.dueDate).getTime(),
            ])
        );

        if (optimization.suggestionMap) {
            for (const s of optimization.suggestionMap.values()) {
                if (s.suggestedStartDate) allDates.push(new Date(s.suggestedStartDate).getTime());
                if (s.suggestedDueDate) allDates.push(new Date(s.suggestedDueDate).getTime());
            }
        }

        let timelineStart, timelineEnd;
        if (allDates.length === 0) {
            timelineStart = new Date(today.getFullYear(), today.getMonth(), 1);
            timelineEnd = new Date(today.getFullYear(), today.getMonth() + minMonths, 0);
        } else {
            const earliest = new Date(Math.min(...allDates));
            const latest = new Date(Math.max(...allDates));
            timelineStart = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
            timelineEnd = new Date(latest.getFullYear(), latest.getMonth() + 1, 0);
            const monthSpan =
                (timelineEnd.getFullYear() - timelineStart.getFullYear()) * 12
                + (timelineEnd.getMonth() - timelineStart.getMonth()) + 1;
            if (monthSpan < minMonths) {
                timelineEnd = new Date(
                    timelineStart.getFullYear(),
                    timelineStart.getMonth() + minMonths, 0,
                );
            }
        }

        const timelineWidth =
            Math.round((timelineEnd - timelineStart) / MS_PER_DAY) * DAY_WIDTH
            + TIMELINE_END_PADDING;

        return { timelineStart, timelineEnd, timelineWidth };
    }, [processedProjects, optimization.suggestionMap]);

    const { timelineStart, timelineEnd, timelineWidth } = timelineBounds;

    const scrollToToday = useCallback(() => {
        if (!timelineRef.current) return;
        const today = new Date();
        const daysFromStart = Math.round((today - timelineStart) / MS_PER_DAY);
        const scrollLeft = Math.max(0, daysFromStart * DAY_WIDTH - timelineRef.current.clientWidth / 2);
        timelineRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }, [timelineStart]);

    // --- Event handlers ---

    const toggleExpand = (key) => setViewState(prev => ({
        ...prev,
        expandedProjects: { ...prev.expandedProjects, [key]: !prev.expandedProjects[key] },
    }));

    const handleMouseDown = (e, taskKey, projectKey, side) => startResize(e, taskKey, projectKey, side);

    const handleTooltipShow = (e, content) => {
        setTooltip({ visible: true, x: e.clientX, y: e.clientY, content });
    };
    const handleTooltipMove = (e) => {
        setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
    };
    const handleTooltipHide = () => {
        setTooltip({ visible: false, x: 0, y: 0, content: null });
    };

    const handleFilterTooltipShow = (tooltipData) => setFilterTooltip(tooltipData);
    const handleFilterTooltipHide = () => {
        setFilterTooltip({ visible: false, x: 0, y: 0, text: '' });
    };

    // --- Render ---

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
            <Header
                onLogout={handleLogout}
                onCreateProject={() => openModal('project', 'create')}
                onCreateTask={() => openModal('task', 'create')}
            />

            <div className="flex-grow flex flex-col">
                {projectsError && (
                    <div className="mx-6 lg:mx-10 mt-3 flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <span className="text-sm text-red-700 dark:text-red-300">{projectsError}</span>
                        <button
                            type="button"
                            onClick={refreshProjects}
                            className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline shrink-0"
                        >
                            Retry
                        </button>
                    </div>
                )}
                {/* Toolbar */}
                <div className="px-6 lg:px-10 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-[fadeInSlide_0.3s_ease-out_both]">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2.5 shrink-0 mr-1">
                            <h1 className="text-sm font-semibold text-slate-900 dark:text-white">Projects</h1>
                            <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">{allTasks.length} tasks</span>
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
                        hasActiveFilters={hasActiveFilters()}
                        onFilterDropdownToggle={(field) => setFilterState(prev => ({
                            ...prev,
                            openFilterDropdown: prev.openFilterDropdown === field ? null : field,
                        }))}
                        onFilterChange={handleFilterChange}
                        onProjectFilterChange={handleProjectFilterChange}
                        onSearchInputChange={(val) => setFilterState(prev => ({
                            ...prev, searchInput: val,
                        }))}
                        onAssignedToMeChange={handleAssignedToMeChange}
                        onClearAllFilters={clearAllFilters}
                        onFilterTooltipShow={handleFilterTooltipShow}
                        onFilterTooltipHide={handleFilterTooltipHide}
                        filterRef={filterRef}
                    />

                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg shrink-0 ml-auto">
                            {['timeline', 'list'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewState(prev => ({ ...prev, mode }))}
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
                                        <span className="hidden sm:inline">{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
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
                        onAccept={handleAcceptOptimization}
                        onReject={handleRejectOptimization}
                        isApplying={optimization.applying}
                    />
                )}

                {viewState.mode === 'list' ? (
                  <ErrorBoundary level="section" resetKey={viewState.mode}>
                    <TaskListView
                        filteredTasks={filteredTasks}
                        processedProjects={processedProjects}
                        taskKeyToTaskMap={taskKeyToTaskMap}
                        projectKeyToProject={projectKeyToProject}
                        sortField={sortState.field}
                        sortOrder={sortState.order}
                        hasActiveFilters={hasActiveFilters()}
                        onSort={handleSort}
                        onTaskClick={(project, task) => openModal('task', 'edit', project, task)}
                    />
                  </ErrorBoundary>
                ) : (
                  <ErrorBoundary level="section" resetKey={viewState.mode}>
                    <TimelineView
                        processedProjects={displayProjects}
                        allTasks={allTasks}
                        filteredTasks={filteredTasks}
                        filteredTaskIds={filteredTaskIds}
                        filteredProjectKeys={filteredProjectKeys}
                        projectRowOffsets={projectRowOffsets}
                        expandedProjects={viewState.expandedProjects}
                        sidebarCollapsed={viewState.sidebarCollapsed}
                        sidebarWidth={sidebarWidth}
                        timelineStart={timelineStart}
                        timelineEnd={timelineEnd}
                        timelineWidth={timelineWidth}
                        projectKeyFilter={projectKeyFilter}
                        hasActiveFilters={hasActiveFilters()}
                        onToggleExpand={toggleExpand}
                        onOpenProjectModal={(project) => openModal('project', 'edit', project)}
                        onOpenTaskModal={(project, task) => (
                            task
                                ? openModal('task', 'edit', project, task)
                                : openModal('task', 'create', project)
                        )}
                        onTooltipShow={handleTooltipShow}
                        onTooltipMove={handleTooltipMove}
                        onTooltipHide={handleTooltipHide}
                        onSidebarToggle={() => setViewState(prev => ({
                            ...prev, sidebarCollapsed: !prev.sidebarCollapsed,
                        }))}
                        onMouseDown={handleMouseDown}
                        shouldPreventClick={shouldPreventClick}
                        headerRef={headerRef}
                        timelineRef={timelineRef}
                        syncScroll={syncScroll}
                        optimization={optimization}
                        onOptimize={handleOptimize}
                        onScrollToToday={scrollToToday}
                        onAcceptOptimization={handleAcceptOptimization}
                        onRejectOptimization={handleRejectOptimization}
                    />
                  </ErrorBoundary>
                )}

                </div>

                <TaskTooltip tooltip={tooltip} />
                <FilterTooltip filterTooltip={filterTooltip} />

                {modalOpen && (
                    <Suspense fallback={null}>
                        <TaskProjectModal
                            modalType={modalType}
                            modalMode={modalMode}
                            project={currentProject}
                            task={currentTask}
                            projects={projects}
                            projectKey={currentTask?.projectKey}
                            onClose={closeModal}
                        />
                    </Suspense>
                )}
            </div>
        </div>
    );
};

export default ProjectsPage;
