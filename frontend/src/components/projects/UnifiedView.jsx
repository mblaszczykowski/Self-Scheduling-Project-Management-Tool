import React, { useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DataContext } from '../../context/DataContext';
import Header from '../layout/Header';
import TaskProjectModal from '../modals/TaskProjectModal';
import { logout } from '../../util/api';
import { isOverdue, isUpcomingDeadline, calculateDuration } from '../../util/helpers';
import { useTaskFiltering } from '../../hooks/useTaskFiltering';
import { useTimelineResize } from '../../hooks/useTimelineResize';
import { useClickOutside } from '../../hooks/useClickOutside';
import { TIMELINE_CONSTANTS, getSidebarWidth } from '../../hooks/timelineConstants';
import FilterBar from './FilterBar';
import TaskListView from './TaskListView';
import TimelineView from './TimelineView';
import { TaskTooltip, FilterTooltip } from './TimelineTooltip';

const { DAY_WIDTH, TIMELINE_END_PADDING } = TIMELINE_CONSTANTS;

const UnifiedView = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { projects, updateTask, user, setUser } = useContext(DataContext);

    const [viewMode, setViewMode] = useState('timeline');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState(null);
    const [modalMode, setModalMode] = useState(null);
    const [currentProject, setCurrentProject] = useState(null);
    const [currentTask, setCurrentTask] = useState(null);
    const [filters, setFilters] = useState({});
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [assignedToMe, setAssignedToMe] = useState(false);
    const [sortField, setSortField] = useState('id');
    const [sortOrder, setSortOrder] = useState('asc');
    const [expandedProjects, setExpandedProjects] = useState({});
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null });
    const [openFilterDropdown, setOpenFilterDropdown] = useState(null);
    const [filterTooltip, setFilterTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });

    const sidebarWidth = getSidebarWidth(sidebarCollapsed);

    const headerRef = useRef(null);
    const timelineRef = useRef(null);
    const filterRef = useRef(null);

    // Process all tasks with computed properties
    const allTasks = useMemo(() => {
        const taskMap = new Map();

        let tasks = projects.flatMap(proj =>
            (proj.tasks || []).map(task => {
                const progress = task.progress ?? 0;
                const delayed = isOverdue(task.dueDate, progress);
                const upcoming = !delayed && isUpcomingDeadline(task.dueDate);

                const taskData = {
                    ...task,
                    projectKey: proj.projectKey,
                    projectSummary: proj.summary,
                    taskKey: `${proj.projectKey}-${task.id}`,
                    reporter: task.reporter?.email || 'N/A',
                    duration: calculateDuration(task.startDate, task.dueDate),
                    labels: Array.isArray(task.labels) ? task.labels : [],
                    dependencies: task.dependencyKeys?.map(d => parseInt(d, 10)) || [],
                    isDelayed: delayed,
                    isUpcomingDeadline: upcoming,
                    isDelayedByDependency: false,
                };

                taskMap.set(task.id, taskData);
                return taskData;
            })
        );

        return tasks.map(task => ({
            ...task,
            isDelayedByDependency: task.dependencies.some(depId => taskMap.get(depId)?.isDelayed)
        })).sort((a, b) => a.id - b.id);
    }, [projects]);

    // Task lookup map
    const taskIdToTaskMap = useMemo(() => {
        const map = new Map();
        allTasks.forEach(t => map.set(t.id, t));
        return map;
    }, [allTasks]);

    // Process projects with computed dates
    const processedProjects = useMemo(() =>
            projects.map(project => {
                const tasks = (project.tasks || []).map(task => ({
                    ...task,
                    taskKey: task.taskKey || `${project.projectKey}-${task.id}`,
                    reporter: task.reporter?.email || 'N/A',
                    labels: Array.isArray(task.labels) ? task.labels : [],
                    dependencies: task.dependencyKeys?.map(d => parseInt(d, 10)) || [],
                    progress: task.progress ?? 0,
                })).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

                let projectStartDate = null, projectDueDate = null;
                if (tasks.length > 0) {
                    projectStartDate = new Date(Math.min(...tasks.map(t => new Date(t.startDate)))).toISOString().split('T')[0];
                    projectDueDate = new Date(Math.max(...tasks.map(t => new Date(t.dueDate)))).toISOString().split('T')[0];
                }

                const totalProgress = tasks.reduce((acc, t) => acc + t.progress, 0);
                const projectProgress = tasks.length > 0 ? Math.round(totalProgress / tasks.length) : 0;

                return { ...project, tasks, projectStartDate, projectDueDate, projectProgress };
            })
        , [projects]);

    // Handle task resize via drag
    const handleTaskResize = useCallback((taskKey, projectKey, side, deltaDays) => {
        const project = processedProjects.find(p => p.projectKey === projectKey);
        const task = project?.tasks.find(t => t.taskKey === taskKey);
        if (!task) return;

        let newStart = new Date(task.startDate);
        let newDue = new Date(task.dueDate);

        if (side === 'left') {
            newStart.setDate(newStart.getDate() + deltaDays);
            if (newStart <= new Date(task.dueDate)) task.startDate = newStart.toISOString().split('T')[0];
        } else {
            newDue.setDate(newDue.getDate() + deltaDays);
            if (newDue >= new Date(task.startDate)) task.dueDate = newDue.toISOString().split('T')[0];
        }

        updateTask(projectKey, task.taskKey, {
            summary: task.summary, description: task.description, status: task.status,
            startDate: task.startDate, dueDate: task.dueDate, assignee: task.assignee,
            labels: task.labels, dependencyKeys: task.dependencies?.map(String) || [],
        }).catch(err => console.error('Error updating task:', err));
    }, [processedProjects, updateTask]);

    const { startResize, shouldPreventClick } = useTimelineResize({
        onResizeMove: handleTaskResize,
        dayWidth: DAY_WIDTH,
    });

    // Project row offsets for dependency lines
    const projectRowOffsets = useMemo(() => {
        let offset = 0;
        return processedProjects.map(p => {
            const current = offset;
            offset += p.tasks.length;
            return current;
        });
    }, [processedProjects]);

    // Initialize expanded projects
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const projectKeyFilter = params.get('projectKey');

        setExpandedProjects(prev => {
            const updated = { ...prev };
            processedProjects.forEach(p => {
                if (!(p.projectKey in updated)) {
                    updated[p.projectKey] = projectKeyFilter ? p.projectKey === projectKeyFilter : true;
                }
            });
            return updated;
        });
    }, [processedProjects, location.search]);

    // Parse URL params for filters
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('critical') === 'true') setFilters(prev => ({ ...prev, criticality: 'Critical' }));
        if (params.get('delayed') === 'true') setFilters(prev => ({ ...prev, delayed: 'Delayed' }));
        if (params.get('upcomingDeadline') === 'true') setFilters(prev => ({ ...prev, delayed: 'Upcoming deadline' }));
        if (params.get('delayedByDependency') === 'true') setFilters(prev => ({ ...prev, delayed: 'Delayed by dependency' }));
        if (params.get('assignedToMe') === 'true') setAssignedToMe(true);

        const selectedIssue = params.get('selectedIssue');
        if (selectedIssue && processedProjects.length > 0) {
            const [projectKey, taskId] = selectedIssue.split('-');
            const project = processedProjects.find(p => p.projectKey === projectKey);
            const task = project?.tasks.find(t => t.id === parseInt(taskId, 10));
            if (project && task) openModal('task', 'edit', project, task);
        }
    }, [location.search, processedProjects]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => setSearchQuery(searchInput), 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const closeFilterDropdown = useCallback(() => setOpenFilterDropdown(null), []);
    useClickOutside(filterRef, closeFilterDropdown);

    // Filter and sort tasks
    const { filteredTasks, filteredTaskIds, filteredProjectKeys, hasActiveFilters } = useTaskFiltering({
        tasks: allTasks,
        filters,
        searchQuery,
        assignedToMe,
        currentUser: user,
        sortField,
        sortOrder,
        urlParams: location.search,
    });

    const clearAllFilters = () => {
        setFilters({});
        setSearchInput('');
        setSearchQuery('');
        setAssignedToMe(false);
        navigate('/projects');
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
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
        const newValue = !assignedToMe;
        setAssignedToMe(newValue);
        const params = new URLSearchParams(location.search);
        newValue ? params.set('assignedToMe', 'true') : params.delete('assignedToMe');
        navigate(`?${params.toString()}`);
    };

    const handleSort = (field) => {
        setSortOrder(sortField === field && sortOrder === 'asc' ? 'desc' : 'asc');
        setSortField(field);
    };

    const handleLogout = async () => {
        try { await logout(); } catch (e) { console.error('Logout failed', e); }
        finally { setUser(null); navigate('/login'); }
    };

    const openModal = (type, mode, project = null, task = null) => {
        setModalType(type); setModalMode(mode); setCurrentProject(project); setCurrentTask(task); setModalOpen(true);
        if (type === 'task' && task) navigate(`?selectedIssue=${task.taskKey}`, { replace: true });
    };

    const closeModal = () => {
        setModalOpen(false); setCurrentProject(null); setCurrentTask(null);
        const params = new URLSearchParams(location.search);
        params.delete('selectedIssue');
        navigate(`?${params.toString()}`, { replace: true });
    };

    const toggleExpand = (key) => setExpandedProjects(prev => ({ ...prev, [key]: !prev[key] }));

    const handleMouseDown = (e, taskKey, projectKey, side) => startResize(e, taskKey, projectKey, side);

    const syncScroll = () => {
        if (headerRef.current && timelineRef.current) {
            headerRef.current.scrollLeft = timelineRef.current.scrollLeft;
        }
    };

    // Timeline calculations - ensure minimum 4 months to fill screen
    const getTimelineBounds = () => {
        const today = new Date();
        const minMonths = 4; // Minimum months to display to fill screen

        const allDates = processedProjects.flatMap(p =>
            (p.tasks || []).flatMap(t => [new Date(t.startDate).getTime(), new Date(t.dueDate).getTime()])
        );

        let timelineStart, timelineEnd;

        if (allDates.length === 0) {
            // No tasks: show current month + next 3 months
            timelineStart = new Date(today.getFullYear(), today.getMonth(), 1);
            timelineEnd = new Date(today.getFullYear(), today.getMonth() + minMonths, 0);
        } else {
            const earliest = new Date(Math.min(...allDates));
            const latest = new Date(Math.max(...allDates));
            timelineStart = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
            timelineEnd = new Date(latest.getFullYear(), latest.getMonth() + 1, 0);

            // Ensure minimum span of minMonths
            const monthSpan = (timelineEnd.getFullYear() - timelineStart.getFullYear()) * 12 +
                              (timelineEnd.getMonth() - timelineStart.getMonth()) + 1;
            if (monthSpan < minMonths) {
                timelineEnd = new Date(timelineStart.getFullYear(), timelineStart.getMonth() + minMonths, 0);
            }
        }

        return { timelineStart, timelineEnd };
    };

    const { timelineStart, timelineEnd } = getTimelineBounds();
    const timelineWidth = Math.round((timelineEnd - timelineStart) / (1000 * 60 * 60 * 24)) * DAY_WIDTH + TIMELINE_END_PADDING;

    const params = new URLSearchParams(location.search);
    const projectKeyFilter = params.get('projectKey');

    // Tooltip handlers for TimelineView
    const handleTooltipShow = (e, content) => {
        setTooltip({ visible: true, x: e.clientX, y: e.clientY, content });
    };
    const handleTooltipMove = (e) => {
        setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
    };
    const handleTooltipHide = () => {
        setTooltip({ visible: false, x: 0, y: 0, content: null });
    };

    // Filter tooltip handlers
    const handleFilterTooltipShow = (tooltipData) => setFilterTooltip(tooltipData);
    const handleFilterTooltipHide = () => setFilterTooltip({ visible: false, x: 0, y: 0, text: '' });

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header onLogout={handleLogout} onCreateProject={() => openModal('project', 'create')} onCreateTask={() => openModal('task', 'create')} />

            <div className="flex-grow flex flex-col px-4 lg:px-6 py-6">
                {/* Filters & View Toggle Row */}
                <div className="mb-4 flex items-center gap-4">
                    <FilterBar
                        projects={projects}
                        allTasks={allTasks}
                        filters={filters}
                        searchInput={searchInput}
                        assignedToMe={assignedToMe}
                        projectKeyFilter={projectKeyFilter}
                        openFilterDropdown={openFilterDropdown}
                        hasActiveFilters={hasActiveFilters()}
                        onFilterDropdownToggle={(field) => setOpenFilterDropdown(openFilterDropdown === field ? null : field)}
                        onFilterChange={handleFilterChange}
                        onProjectFilterChange={handleProjectFilterChange}
                        onSearchInputChange={setSearchInput}
                        onAssignedToMeChange={handleAssignedToMeChange}
                        onClearAllFilters={clearAllFilters}
                        onFilterTooltipShow={handleFilterTooltipShow}
                        onFilterTooltipHide={handleFilterTooltipHide}
                        filterRef={filterRef}
                    />

                    {/* View Toggle */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
                        {['timeline', 'list'].map(mode => (
                            <button key={mode} onClick={() => setViewMode(mode)} className={`py-2 px-4 text-sm font-medium rounded-lg transition-colors ${viewMode === mode ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
                                <span className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mode === 'timeline' ? "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" : "M4 6h16M4 10h16M4 14h16M4 18h16"} />
                                    </svg>
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                {viewMode === 'list' ? (
                    <TaskListView
                        filteredTasks={filteredTasks}
                        processedProjects={processedProjects}
                        taskIdToTaskMap={taskIdToTaskMap}
                        sortField={sortField}
                        sortOrder={sortOrder}
                        hasActiveFilters={hasActiveFilters()}
                        onSort={handleSort}
                        onTaskClick={(project, task) => openModal('task', 'edit', project, task)}
                    />
                ) : (
                    <TimelineView
                        processedProjects={processedProjects}
                        allTasks={allTasks}
                        filteredTasks={filteredTasks}
                        filteredTaskIds={filteredTaskIds}
                        filteredProjectKeys={filteredProjectKeys}
                        projectRowOffsets={projectRowOffsets}
                        expandedProjects={expandedProjects}
                        sidebarCollapsed={sidebarCollapsed}
                        sidebarWidth={sidebarWidth}
                        timelineStart={timelineStart}
                        timelineEnd={timelineEnd}
                        timelineWidth={timelineWidth}
                        projectKeyFilter={projectKeyFilter}
                        hasActiveFilters={hasActiveFilters()}
                        onToggleExpand={toggleExpand}
                        onOpenProjectModal={(project) => openModal('project', 'edit', project)}
                        onOpenTaskModal={(project, task) => task ? openModal('task', 'edit', project, task) : openModal('task', 'create', project)}
                        onTooltipShow={handleTooltipShow}
                        onTooltipMove={handleTooltipMove}
                        onTooltipHide={handleTooltipHide}
                        onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                        onMouseDown={handleMouseDown}
                        shouldPreventClick={shouldPreventClick}
                        headerRef={headerRef}
                        timelineRef={timelineRef}
                        syncScroll={syncScroll}
                    />
                )}

                {/* Tooltips */}
                <TaskTooltip tooltip={tooltip} />
                <FilterTooltip filterTooltip={filterTooltip} />

                {modalOpen && <TaskProjectModal modalType={modalType} modalMode={modalMode} project={currentProject} task={currentTask} projects={projects} projectKey={currentTask?.projectKey} onClose={closeModal} />}
            </div>
        </div>
    );
};

export default UnifiedView;