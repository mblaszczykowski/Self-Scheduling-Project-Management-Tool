import React, { useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DataContext } from '../context/DataContext';
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
import { isOverdue, isUpcomingDeadline, calculateDuration, MS_PER_DAY, toDateString, getErrorMessage } from '../util/helpers';
import { computeProjectDateRange, computeProjectProgress } from '../util/projectUtils';
import { simulateOptimization, applyOptimization } from '../util/api';
import { showToast } from '../util/toast';
import { TIMELINE_CONSTANTS, getSidebarWidth } from '../config/timelineConstants';

const { DAY_WIDTH, TIMELINE_END_PADDING } = TIMELINE_CONSTANTS;

const ProjectsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { projects, updateTask, refreshProjects, user, handleLogout: contextLogout } = useContext(DataContext);

    const {
        open: modalOpen, type: modalType, mode: modalMode,
        project: currentProject, task: currentTask,
        openModal: baseOpenModal, closeModal: baseCloseModal,
    } = useModal();

    const [filterState, setFilterState] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('flowlink_filters'));
            if (saved) return { ...saved, openFilterDropdown: null, searchQuery: saved.searchInput || '' };
        } catch {}
        return { filters: {}, searchInput: '', searchQuery: '', assignedToMe: false, openFilterDropdown: null };
    });
    const [sortState, setSortState] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('flowlink_sort'));
            if (saved) return saved;
        } catch {}
        return { field: 'id', order: 'asc' };
    });
    const [viewState, setViewState] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('flowlink_view'));
            if (saved) return { ...saved, expandedProjects: saved.expandedProjects || {} };
        } catch {}
        return { mode: 'timeline', sidebarCollapsed: false, expandedProjects: {} };
    });
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null });
    const [filterTooltip, setFilterTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });
    const [optimization, setOptimization] = useState({
        loading: false, applying: false, result: null, showGhostBars: false, error: null,
        suggestionMap: null, // Map<taskKey, suggestion> for O(1) lookup in TimelineView
    });

    useEffect(() => {
        const { openFilterDropdown, searchQuery, ...toSave } = filterState;
        localStorage.setItem('flowlink_filters', JSON.stringify(toSave));
    }, [filterState]);

    useEffect(() => {
        localStorage.setItem('flowlink_sort', JSON.stringify(sortState));
    }, [sortState]);

    useEffect(() => {
        const { expandedProjects, ...toSave } = viewState;
        localStorage.setItem('flowlink_view', JSON.stringify(toSave));
    }, [viewState]);

    const sidebarWidth = getSidebarWidth(viewState.sidebarCollapsed);

    const headerRef = useRef(null);
    const timelineRef = useRef(null);
    const filterRef = useRef(null);

    const allTasks = useMemo(() => {
        const taskKeyMap = new Map();

        let tasks = projects.flatMap(proj =>
            (proj.tasks || []).map(task => {
                const progress = task.progress ?? 0;
                const delayed = isOverdue(task.dueDate, progress);
                const upcoming = !delayed && isUpcomingDeadline(task.dueDate);

                const taskData = {
                    ...task,
                    projectKey: proj.projectKey,
                    projectSummary: proj.summary,
                    taskKey: task.taskKey,
                    reporter: task.reporter?.email || 'N/A',
                    duration: calculateDuration(task.startDate, task.dueDate),
                    labels: Array.isArray(task.labels) ? task.labels : [],
                    dependencies: task.dependencyKeys || [],
                    isDelayed: delayed,
                    isUpcomingDeadline: upcoming,
                    isDelayedByDependency: false,
                };

                taskKeyMap.set(task.taskKey, taskData);
                return taskData;
            })
        );

        return tasks.map(task => ({
            ...task,
            isDelayedByDependency: task.dependencies.some(depKey => taskKeyMap.get(depKey)?.isDelayed)
        })).sort((a, b) => a.id - b.id);
    }, [projects]);

    const taskKeyToTaskMap = useMemo(() => {
        const map = new Map();
        allTasks.forEach(t => map.set(t.taskKey, t));
        return map;
    }, [allTasks]);

    const processedProjects = useMemo(() =>
            projects.map(project => {
                const tasks = (project.tasks || []).map(task => ({
                    ...task,
                    taskKey: task.taskKey,
                    reporter: task.reporter?.email || 'N/A',
                    labels: Array.isArray(task.labels) ? task.labels : [],
                    dependencies: task.dependencyKeys || [],
                    progress: task.progress ?? 0,
                })).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

                const { projectStartDate, projectDueDate } = computeProjectDateRange(tasks);
                const projectProgress = computeProjectProgress(tasks);

                return { ...project, tasks, projectStartDate, projectDueDate, projectProgress };
            })
        , [projects]);

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
            updateTask(projectKey, task.taskKey, {
                summary: task.summary, description: task.description, status: task.status,
                startDate: previousStartDate, dueDate: previousDueDate, assignee: task.assignee,
                labels: task.labels, dependencyKeys: task.dependencies || [],
            }).catch(() => {});
        });
    }, [processedProjects, updateTask]);

    const { startResize, shouldPreventClick } = useTimelineResize({
        onResizeMove: handleTaskResize,
        dayWidth: DAY_WIDTH,
    });

    const projectRowOffsets = useMemo(() => {
        let offset = 0;
        return processedProjects.map(p => {
            const current = offset;
            offset += p.tasks.length;
            return current;
        });
    }, [processedProjects]);

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

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const projectKeyFilter = params.get('projectKey');

        setViewState(prev => {
            const updated = { ...prev.expandedProjects };
            processedProjects.forEach(p => {
                if (!(p.projectKey in updated)) {
                    updated[p.projectKey] = projectKeyFilter
                        ? p.projectKey === projectKeyFilter : true;
                }
            });
            return { ...prev, expandedProjects: updated };
        });
    }, [processedProjects, location.search]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('critical') === 'true') {
            setFilterState(prev => ({
                ...prev, filters: { ...prev.filters, criticality: 'Critical' },
            }));
        }
        if (params.get('delayed') === 'true') {
            setFilterState(prev => ({
                ...prev, filters: { ...prev.filters, delayed: 'Delayed' },
            }));
        }
        if (params.get('upcomingDeadline') === 'true') {
            setFilterState(prev => ({
                ...prev, filters: { ...prev.filters, delayed: 'Upcoming deadline' },
            }));
        }
        if (params.get('delayedByDependency') === 'true') {
            setFilterState(prev => ({
                ...prev, filters: { ...prev.filters, delayed: 'Delayed by dependency' },
            }));
        }
        if (params.get('assignedToMe') === 'true') {
            setFilterState(prev => ({ ...prev, assignedToMe: true }));
        }

        const selectedIssue = params.get('selectedIssue');
        if (selectedIssue && processedProjects.length > 0) {
            for (const project of processedProjects) {
                const task = project.tasks.find(t => t.taskKey === selectedIssue);
                if (task) {
                    openModal('task', 'edit', project, task);
                    break;
                }
            }
        }
    }, [location.search, processedProjects, openModal]);

    useEffect(() => {
        const timer = setTimeout(
            () => setFilterState(prev => ({ ...prev, searchQuery: prev.searchInput })),
            300,
        );
        return () => clearTimeout(timer);
    }, [filterState.searchInput]);

    const closeFilterDropdown = useCallback(
        () => setFilterState(prev => ({ ...prev, openFilterDropdown: null })),
        [],
    );
    useClickOutside(filterRef, closeFilterDropdown);

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

    const clearAllFilters = () => {
        setFilterState({
            filters: {}, searchInput: '', searchQuery: '',
            assignedToMe: false, openFilterDropdown: null,
        });
        navigate('/projects');
    };

    const handleFilterChange = (field, value) => {
        setFilterState(prev => ({
            ...prev, filters: { ...prev.filters, [field]: value },
        }));
        const params = new URLSearchParams(location.search);
        if (field === 'criticality') {
            value === 'Critical' ? params.set('critical', 'true') : params.delete('critical');
        }
        if (field === 'delayed') {
            ['delayed', 'upcomingDeadline', 'delayedByDependency'].forEach(k => params.delete(k));
            if (value === 'Delayed') params.set('delayed', 'true');
            else if (value === 'Upcoming deadline') params.set('upcomingDeadline', 'true');
            else if (value === 'Delayed by dependency') params.set('delayedByDependency', 'true');
        }
        navigate(`?${params.toString()}`);
    };

    const handleProjectFilterChange = (value) => {
        const params = new URLSearchParams(location.search);
        value === 'All' ? params.delete('projectKey') : params.set('projectKey', value);
        navigate(`?${params.toString()}`);
    };

    const handleAssignedToMeChange = () => {
        const newValue = !filterState.assignedToMe;
        setFilterState(prev => ({ ...prev, assignedToMe: newValue }));
        const params = new URLSearchParams(location.search);
        newValue ? params.set('assignedToMe', 'true') : params.delete('assignedToMe');
        navigate(`?${params.toString()}`);
    };

    const handleSort = (field) => {
        setSortState(prev => ({
            field,
            order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
        }));
    };

    const handleLogout = useCallback(async () => {
        await contextLogout();
        navigate('/login');
    }, [contextLogout, navigate]);

    const handleOptimize = useCallback(async () => {
        setOptimization(prev => ({ ...prev, loading: true, error: null }));
        try {
            const projectKeys = processedProjects.map(p => p.projectKey);
            const result = await simulateOptimization({ projectKeys, alpha: 0.8, beta: 0.2 });

            // Pre-build Map for O(1) ghost bar lookups in TimelineView
            const suggestionMap = new Map();
            if (result?.suggestions) {
                for (const s of result.suggestions) {
                    if (s.wasShifted) suggestionMap.set(s.taskKey, s);
                }
            }

            const shiftedCount = suggestionMap.size;
            if (shiftedCount === 0) {
                showToast('Schedule is already optimal — no changes needed.', 'info');
                setOptimization(prev => ({ ...prev, loading: false }));
                return;
            }

            setOptimization({
                loading: false, applying: false, result, showGhostBars: true,
                error: null, suggestionMap,
            });
        } catch (err) {
            const msg = getErrorMessage(err);
            showToast(msg, 'error');
            setOptimization(prev => ({ ...prev, loading: false, error: msg }));
        }
    }, [processedProjects]);

    const handleAcceptOptimization = useCallback(async () => {
        if (!optimization.result?.suggestions) return;
        setOptimization(prev => ({ ...prev, applying: true }));
        try {
            await applyOptimization(optimization.result.suggestions);
            setOptimization({
                loading: false, applying: false, result: null, showGhostBars: false,
                error: null, suggestionMap: null,
            });
            refreshProjects();
            showToast('Schedule optimized successfully.', 'success');
        } catch (err) {
            const msg = getErrorMessage(err);
            showToast(msg, 'error');
            setOptimization(prev => ({ ...prev, applying: false, error: msg }));
        }
    }, [optimization.result, refreshProjects]);

    const handleRejectOptimization = useCallback(() => {
        setOptimization({
            loading: false, applying: false, result: null, showGhostBars: false,
            error: null, suggestionMap: null,
        });
    }, []);

    // Clear optimization results when underlying data changes
    useEffect(() => {
        if (optimization.result) {
            setOptimization(prev => ({
                ...prev, result: null, showGhostBars: false, suggestionMap: null,
            }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projects]);

    const toggleExpand = (key) => setViewState(prev => ({
        ...prev,
        expandedProjects: { ...prev.expandedProjects, [key]: !prev.expandedProjects[key] },
    }));

    const handleMouseDown = (e, taskKey, projectKey, side) => startResize(e, taskKey, projectKey, side);

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

    const getTimelineBounds = () => {
        const today = new Date();
        const minMonths = 4;
        const allDates = processedProjects.flatMap(p =>
            (p.tasks || []).flatMap(t => [
                new Date(t.startDate).getTime(),
                new Date(t.dueDate).getTime(),
            ])
        );

        // Include ghost bar dates so they're always visible on the timeline
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
        return { timelineStart, timelineEnd };
    };

    const { timelineStart, timelineEnd } = getTimelineBounds();
    const timelineWidth =
        Math.round((timelineEnd - timelineStart) / MS_PER_DAY) * DAY_WIDTH
        + TIMELINE_END_PADDING;

    const params = new URLSearchParams(location.search);
    const projectKeyFilter = params.get('projectKey');

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

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header
                onLogout={handleLogout}
                onCreateProject={() => openModal('project', 'create')}
                onCreateTask={() => openModal('task', 'create')}
            />

            <div className="flex-grow flex flex-col px-4 lg:px-6 py-6">
                <div className="mb-4 flex items-center gap-4">
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

                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
                        {['timeline', 'list'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewState(prev => ({ ...prev, mode }))}
                                className={
                                    'py-2 px-4 text-sm font-medium rounded-lg transition-colors '
                                    + (viewState.mode === mode
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50')
                                }
                            >
                                <span className="flex items-center gap-2">
                                    {mode === 'timeline' ? <ChartBarIcon /> : <ListIcon />}
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

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
                  <ErrorBoundary>
                    <TaskListView
                        filteredTasks={filteredTasks}
                        processedProjects={processedProjects}
                        taskKeyToTaskMap={taskKeyToTaskMap}
                        sortField={sortState.field}
                        sortOrder={sortState.order}
                        hasActiveFilters={hasActiveFilters()}
                        onSort={handleSort}
                        onTaskClick={(project, task) => openModal('task', 'edit', project, task)}
                    />
                  </ErrorBoundary>
                ) : (
                  <ErrorBoundary>
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
                        onAcceptOptimization={handleAcceptOptimization}
                        onRejectOptimization={handleRejectOptimization}
                    />
                  </ErrorBoundary>
                )}

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
