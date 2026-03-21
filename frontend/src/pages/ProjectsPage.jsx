import React, { useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ProjectsContext } from '../context/ProjectsContext';
import Header from '../components/layout/Header';
import TaskProjectModal from '../components/modals/TaskProjectModal';
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

const { DAY_WIDTH, TIMELINE_END_PADDING } = TIMELINE_CONSTANTS;

const ProjectsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useContext(AuthContext);
    const { projects, updateTask, refreshProjects } = useContext(ProjectsContext);
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

    const handleTaskResize = useCallback((taskKey, projectKey, side, deltaDays) => {
        const project = processedProjects.find(p => p.projectKey === projectKey);
        const task = project?.tasks.find(t => t.taskKey === taskKey);
        if (!task) return;

        let newStartDate = task.startDate;
        let newDueDate = task.dueDate;

        if (side === 'left') {
            const newStart = new Date(task.startDate);
            newStart.setDate(newStart.getDate() + deltaDays);
            if (newStart <= new Date(task.dueDate)) {
                newStartDate = toDateString(newStart);
            }
        } else {
            const newDue = new Date(task.dueDate);
            newDue.setDate(newDue.getDate() + deltaDays);
            if (newDue >= new Date(task.startDate)) {
                newDueDate = toDateString(newDue);
            }
        }

        const previousStartDate = task.startDate;
        const previousDueDate = task.dueDate;

        updateTask(projectKey, task.taskKey, {
            summary: task.summary, description: task.description, status: task.status,
            startDate: newStartDate, dueDate: newDueDate, assignee: task.assignee,
            labels: task.labels, dependencyKeys: task.dependencies || [],
        }).catch(err => {
            console.error('Error updating task:', err);
            showToast('Failed to update task dates. Reverting changes.', 'error');
            updateTask(projectKey, task.taskKey, {
                summary: task.summary, description: task.description, status: task.status,
                startDate: previousStartDate, dueDate: previousDueDate, assignee: task.assignee,
                labels: task.labels, dependencyKeys: task.dependencies || [],
            }).catch(() => {
                showToast('Failed to revert changes. Please refresh the page.', 'error');
            });
        });
    }, [processedProjects, updateTask]);

    const { startResize, shouldPreventClick } = useTimelineResize({
        onResizeMove: handleTaskResize,
        dayWidth: DAY_WIDTH,
    });

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
                {/* Page header */}
                <div className="px-6 lg:px-10 pt-6 pb-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 animate-[fadeInSlide_0.3s_ease-out_both]">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Projects</h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                {allTasks.length} tasks across {projects.length} projects
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0">
                            {['timeline', 'list'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewState(prev => ({ ...prev, mode }))}
                                    className={
                                        'py-1.5 px-3.5 text-sm font-medium rounded-md transition-all duration-200 '
                                        + (mode === 'timeline' ? 'hidden sm:flex ' : '')
                                        + (viewState.mode === mode
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')
                                    }
                                >
                                    <span className="flex items-center gap-2">
                                        {mode === 'timeline' ? <ChartBarIcon /> : <ListIcon />}
                                        <span className="hidden sm:inline">{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
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
                </div>

                <div className="px-6 lg:px-10 pt-5 pb-6 flex-grow flex flex-col">

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
                        processedProjects={processedProjects}
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
                    <TaskProjectModal
                        modalType={modalType}
                        modalMode={modalMode}
                        project={currentProject}
                        task={currentTask}
                        projects={projects}
                        projectKey={currentTask?.projectKey}
                        onClose={closeModal}
                    />
                )}
            </div>
        </div>
    );
};

export default ProjectsPage;
