import React, { useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DataContext } from '../context/DataContext';
import Header from './Header';
import TaskProjectModal from './TaskProjectModal';
import { AddIcon, CollapseIcon, ExpandIcon } from './Icons';
import { logout } from '../util/api';
import {
    formatShortDate, getImageUrl, isOverdue, isUpcomingDeadline,
    calculateDuration, calculateTaskPosition, generateBezierPath,
    getStatusConfig, getPriorityConfig
} from '../util/helpers';

const STATUS_CONFIG = getStatusConfig();
const PRIORITY_CONFIG = getPriorityConfig();
const DAY_WIDTH = 25;

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
    const [searchQuery, setSearchQuery] = useState('');
    const [assignedToMe, setAssignedToMe] = useState(false);
    const [sortField, setSortField] = useState('id');
    const [sortOrder, setSortOrder] = useState('asc');
    const [expandedProjects, setExpandedProjects] = useState({});
    const [resizingTask, setResizingTask] = useState(null);

    const isResizingRef = useRef(false);
    const wasResizingRef = useRef(false);
    const headerRef = useRef(null);
    const timelineRef = useRef(null);

    const filterFields = ['status', 'assignee', 'labels', 'startDate', 'dueDate', 'priority', 'criticality', 'delayed'];

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

        // Check for dependency delays
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

    // Handle task resizing
    useEffect(() => {
        if (!resizingTask) return;

        const handleMouseMove = (e) => {
            const { taskKey, projectKey, side, startX } = resizingTask;
            const deltaDays = Math.round((e.clientX - startX) / DAY_WIDTH);
            if (deltaDays === 0) return;

            setResizingTask(prev => ({ ...prev, startX: e.clientX }));

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
        };

        const handleMouseUp = () => {
            isResizingRef.current = false;
            wasResizingRef.current = true;
            setTimeout(() => { wasResizingRef.current = false; }, 100);
            setResizingTask(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingTask, processedProjects, updateTask]);

    // Filter and sort tasks
    const getFilteredTasks = useCallback(() => {
        const params = new URLSearchParams(location.search);
        let tasks = [...allTasks];

        // URL-based filters
        const projectKey = params.get('projectKey');
        if (projectKey) tasks = tasks.filter(t => t.projectKey === projectKey);
        if (params.get('critical') === 'true') tasks = tasks.filter(t => t.isCritical);
        if (params.get('upcomingDeadline') === 'true') tasks = tasks.filter(t => t.isUpcomingDeadline);
        else if (params.get('delayedByDependency') === 'true') tasks = tasks.filter(t => t.isDelayedByDependency);
        else if (params.get('delayed') === 'true') tasks = tasks.filter(t => t.isDelayed);

        // Assigned to me filter
        if (assignedToMe && user?.email) {
            tasks = tasks.filter(t => t.assignee === user.email || t.assignee === `${user.firstname} ${user.lastname}`);
        }

        // State-based filters
        tasks = tasks.filter(task =>
            Object.entries(filters).every(([field, value]) => {
                if (!value || value === 'All') return true;
                if (field === 'labels') return task.labels?.includes(value);
                if (field === 'assignee') return task.assignee === value;
                if (field === 'startDate' || field === 'dueDate') return task[field] && new Date(task[field]).toISOString().split('T')[0] === value;
                if (field === 'priority') return task.priority === value;
                if (field === 'criticality') return value === 'Critical' ? task.isCritical : true;
                if (field === 'delayed') {
                    if (value === 'Delayed') return task.isDelayed;
                    if (value === 'On Time') return !task.isDelayed && !task.isUpcomingDeadline && !task.isDelayedByDependency;
                    if (value === 'Upcoming deadline') return task.isUpcomingDeadline;
                    if (value === 'Delayed by dependency') return task.isDelayedByDependency;
                }
                return task[field] === value;
            })
        );

        // Search filter
        if (searchQuery.trim()) {
            tasks = tasks.filter(t => t.summary.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        // Sorting
        tasks.sort((a, b) => {
            let fA = a[sortField], fB = b[sortField];
            if (['startDate', 'dueDate'].includes(sortField)) { fA = new Date(fA); fB = new Date(fB); }
            if (['progress', 'duration'].includes(sortField)) { fA = Number(fA); fB = Number(fB); }
            if (['isCritical', 'isDelayed'].includes(sortField)) { fA = fA ? 1 : 0; fB = fB ? 1 : 0; }
            if (sortField === 'priority') {
                const order = { 'LOWEST': 1, 'LOW': 2, 'MEDIUM': 3, 'HIGH': 4, 'HIGHEST': 5 };
                fA = order[fA] || 0; fB = order[fB] || 0;
            }
            return sortOrder === 'asc' ? (fA < fB ? -1 : fA > fB ? 1 : 0) : (fA > fB ? -1 : fA < fB ? 1 : 0);
        });

        return tasks;
    }, [allTasks, filters, searchQuery, assignedToMe, user, sortField, sortOrder, location.search]);

    const filteredTasks = getFilteredTasks();
    const filteredTaskIds = new Set(filteredTasks.map(t => t.id));
    const filteredProjectKeys = new Set(filteredTasks.map(t => t.projectKey));

    const hasActiveFilters = () => {
        const params = new URLSearchParams(location.search);
        return Object.values(filters).some(v => v && v !== 'All') || searchQuery.trim() || assignedToMe || params.get('projectKey');
    };

    const clearAllFilters = () => {
        setFilters({});
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

    const handleProjectFilterChange = (e) => {
        const params = new URLSearchParams(location.search);
        e.target.value === 'All' ? params.delete('projectKey') : params.set('projectKey', e.target.value);
        navigate(`?${params.toString()}`);
    };

    const handleAssignedToMeChange = (e) => {
        setAssignedToMe(e.target.checked);
        const params = new URLSearchParams(location.search);
        e.target.checked ? params.set('assignedToMe', 'true') : params.delete('assignedToMe');
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

    const handleMouseDown = (e, taskKey, projectKey, side) => {
        e.preventDefault();
        isResizingRef.current = true;
        wasResizingRef.current = false;
        setResizingTask({ taskKey, projectKey, side, startX: e.clientX });
    };

    const syncScroll = () => {
        if (headerRef.current && timelineRef.current) {
            headerRef.current.scrollLeft = timelineRef.current.scrollLeft;
        }
    };

    // Timeline calculations
    const getTimelineBounds = () => {
        const allDates = processedProjects.flatMap(p =>
            (p.tasks || []).flatMap(t => [new Date(t.startDate).getTime(), new Date(t.dueDate).getTime()])
        );
        if (allDates.length === 0) {
            const start = new Date(), end = new Date();
            end.setDate(end.getDate() + 21);
            return { timelineStart: start, timelineEnd: end };
        }
        const earliest = new Date(Math.min(...allDates));
        const latest = new Date(Math.max(...allDates));
        return {
            timelineStart: new Date(earliest.getFullYear(), earliest.getMonth(), 1),
            timelineEnd: new Date(latest.getFullYear(), latest.getMonth() + 1, 0)
        };
    };

    const { timelineStart, timelineEnd } = getTimelineBounds();
    const timelineWidth = Math.round((timelineEnd - timelineStart) / (1000 * 60 * 60 * 24)) * DAY_WIDTH + 300;

    const renderMonths = () => {
        const months = [];
        let year = timelineStart.getFullYear(), month = timelineStart.getMonth();
        const endYear = timelineEnd.getFullYear(), endMonth = timelineEnd.getMonth();
        const today = new Date();

        while (year < endYear || (year === endYear && month <= endMonth)) {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthDate = new Date(year, month, 1);

            const days = Array.from({ length: daysInMonth }, (_, i) => {
                const day = new Date(year, month, i + 1);
                const isToday = today.toDateString() === day.toDateString();
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                    <div key={`${year}-${month}-${i}`} className={`text-xs p-1 border-l border-slate-200 flex items-center justify-center ${isWeekend ? 'bg-slate-50' : ''} ${isToday ? 'bg-slate-900 text-white font-semibold' : 'text-slate-500'}`} style={{ width: `${DAY_WIDTH}px`, minWidth: `${DAY_WIDTH}px` }}>
                        {i + 1}
                    </div>
                );
            });

            months.push(
                <div key={`${year}-${month}`} className="flex flex-col text-center border-r border-slate-200" style={{ width: `${daysInMonth * DAY_WIDTH}px` }}>
                    <div className="text-xs font-semibold text-slate-700 border-b border-slate-200 p-2 bg-white">
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

    const renderPriority = (priority) => (
        <span className={`inline-flex items-center py-1 px-2.5 rounded-lg text-xs font-medium ${PRIORITY_CONFIG[priority]?.color || 'bg-slate-100 text-slate-600'}`}>
            {PRIORITY_CONFIG[priority]?.label || priority}
        </span>
    );

    const renderLabels = (labels) => {
        if (!labels?.length) return <span className="text-slate-400 text-xs">None</span>;
        return labels.map((l, i) => <span key={i} className="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded mr-1">{l}</span>);
    };

    const renderDependencies = (task) => {
        if (!task.dependencies?.length) return <span className="text-slate-400 text-xs">None</span>;
        return task.dependencies.map(depId => {
            const dep = taskIdToTaskMap.get(depId);
            return dep ? <span key={depId} className="text-slate-700 hover:text-slate-900 cursor-pointer mr-2 text-xs font-medium">{dep.projectKey}-{dep.id}</span> : <span key={depId} className="text-slate-400 mr-2 text-xs">ID: {depId}</span>;
        });
    };

    const params = new URLSearchParams(location.search);
    const projectKeyFilter = params.get('projectKey');

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <Header onLogout={handleLogout} onCreateProject={() => openModal('project', 'create')} onCreateTask={() => openModal('task', 'create')} />

            <div className="flex-grow flex flex-col px-8 lg:px-12 py-8">
                {/* Title & View Toggle */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
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

                {/* Filters */}
                <div className="mb-6 bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-slate-600 mb-1.5">Project</label>
                            <select value={projectKeyFilter || 'All'} onChange={handleProjectFilterChange} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none">
                                <option value="All">All Projects</option>
                                {projects.map(p => <option key={p.projectKey} value={p.projectKey}>{p.summary} ({p.projectKey})</option>)}
                            </select>
                        </div>

                        {filterFields.map(field => (
                            <div key={field} className="flex flex-col">
                                <label className="text-xs font-medium text-slate-600 mb-1.5">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                                {['startDate', 'dueDate'].includes(field) ? (
                                    <input type="date" value={filters[field] || ''} onChange={e => handleFilterChange(field, e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none" />
                                ) : (
                                    <select value={filters[field] || 'All'} onChange={e => handleFilterChange(field, e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none">
                                        <option value="All">All</option>
                                        {field === 'status' && Object.keys(STATUS_CONFIG).map(k => <option key={k} value={k}>{STATUS_CONFIG[k].label}</option>)}
                                        {field === 'assignee' && [...new Set(allTasks.map(t => t.assignee || 'Unassigned'))].map(v => <option key={v} value={v}>{v}</option>)}
                                        {field === 'labels' && [...new Set(allTasks.flatMap(t => t.labels))].filter(Boolean).map(v => <option key={v} value={v}>{v}</option>)}
                                        {field === 'priority' && Object.keys(PRIORITY_CONFIG).map(k => <option key={k} value={k}>{PRIORITY_CONFIG[k].label}</option>)}
                                        {field === 'criticality' && ['Critical', 'Non-Critical'].map(v => <option key={v} value={v}>{v}</option>)}
                                        {field === 'delayed' && ['Delayed', 'Delayed by dependency', 'On Time', 'Upcoming deadline'].map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                )}
                            </div>
                        ))}

                        <div className="flex flex-col">
                            <label className="text-xs font-medium text-slate-600 mb-1.5">Search</label>
                            <input type="text" placeholder="Filter by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none w-48" />
                        </div>

                        <div className="flex items-center gap-2 pb-2">
                            <input type="checkbox" id="assignedToMe" checked={assignedToMe} onChange={handleAssignedToMeChange} className="w-4 h-4 text-slate-900 bg-white border-slate-300 rounded focus:ring-slate-900" />
                            <label htmlFor="assignedToMe" className="text-sm text-slate-700 font-medium cursor-pointer">Assigned to me</label>
                        </div>

                        {hasActiveFilters() && (
                            <button onClick={clearAllFilters} className="px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {viewMode === 'list' ? (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-grow flex flex-col">
                        <div className="overflow-x-auto flex-grow">
                            <div className="inline-block min-w-full align-middle">
                                <div className="overflow-hidden">
                                    {/* Header */}
                                    <div className="bg-slate-50 border-b border-slate-200">
                                        <div className="grid grid-cols-[85px_85px_minmax(220px,1fr)_105px_145px_90px_90px_75px_110px_95px_125px_125px_85px_95px] gap-3 px-5 py-3">
                                            {[
                                                ['projectKey', 'Project'],
                                                ['taskKey', 'Task'],
                                                ['summary', 'Summary'],
                                                ['status', 'Status'],
                                                ['assignee', 'Assignee'],
                                                ['startDate', 'Start'],
                                                ['dueDate', 'Due'],
                                                ['duration', 'Days'],
                                                ['progress', 'Progress'],
                                                ['priority', 'Priority'],
                                                ['labels', 'Labels'],
                                                ['dependencies', 'Depends'],
                                                ['isCritical', 'Critical'],
                                                ['isDelayed', 'Status']
                                            ].map(([field, label]) => (
                                                <button
                                                    key={field}
                                                    onClick={() => !['labels', 'dependencies'].includes(field) && handleSort(field)}
                                                    className={`text-left text-xs font-semibold uppercase tracking-wide text-slate-600 flex items-center gap-1 ${!['labels', 'dependencies'].includes(field) ? 'hover:text-slate-900 cursor-pointer' : 'cursor-default'}`}
                                                >
                                                    {label}
                                                    {sortField === field && (
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortOrder === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                                                        </svg>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="divide-y divide-slate-100">
                                        {filteredTasks.map(task => (
                                            <div
                                                key={task.taskKey}
                                                onClick={() => openModal('task', 'edit', processedProjects.find(p => p.projectKey === task.projectKey), task)}
                                                className="grid grid-cols-[85px_85px_minmax(220px,1fr)_105px_145px_90px_90px_75px_110px_95px_125px_125px_85px_95px] gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors group"
                                            >
                                                {/* Project */}
                                                <div className="flex flex-col justify-center min-w-0">
                                                    <span className="text-[13px] font-semibold text-slate-900 truncate">{task.projectKey}</span>
                                                    <span className="text-xs text-slate-500 truncate">{task.projectSummary}</span>
                                                </div>

                                                {/* Task Key */}
                                                <div className="flex items-center">
                                                    <span className={`text-[13px] font-bold ${task.isCritical ? 'text-red-600' : 'text-slate-900'}`}>
                                                        {task.taskKey}
                                                    </span>
                                                </div>

                                                {/* Summary */}
                                                <div className="flex items-center min-w-0">
                                                    <span className="text-[13px] text-slate-700 line-clamp-2 leading-snug">{task.summary}</span>
                                                </div>

                                                {/* Status */}
                                                <div className="flex items-center">
                                                    <span className={`inline-flex items-center py-1 px-2 rounded text-[11px] font-medium ${STATUS_CONFIG[task.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                                                        {STATUS_CONFIG[task.status]?.label || task.status}
                                                    </span>
                                                </div>

                                                {/* Assignee */}
                                                <div className="flex items-center min-w-0">
                                                    <span className="text-[13px] text-slate-700 truncate">
                                                        {task.assignee || <span className="text-slate-400">Unassigned</span>}
                                                    </span>
                                                </div>

                                                {/* Start Date */}
                                                <div className="flex items-center">
                                                    <span className="text-[13px] text-slate-600">{task.startDate ? formatShortDate(task.startDate) : '—'}</span>
                                                </div>

                                                {/* Due Date */}
                                                <div className="flex items-center">
                                                    <span className="text-[13px] text-slate-600">{task.dueDate ? formatShortDate(task.dueDate) : '—'}</span>
                                                </div>

                                                {/* Duration */}
                                                <div className="flex items-center justify-center">
                                                    <span className="text-[13px] font-semibold text-slate-900">
                                                        {task.duration !== 'N/A' ? `${task.duration}` : '—'}
                                                    </span>
                                                </div>

                                                {/* Progress */}
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-slate-900 rounded-full transition-all"
                                                            style={{ width: `${task.progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[11px] font-semibold text-slate-700 w-7 text-right">{task.progress}%</span>
                                                </div>

                                                {/* Priority */}
                                                <div className="flex items-center">
                                                    <span className={`inline-flex items-center py-1 px-2 rounded text-[11px] font-medium ${PRIORITY_CONFIG[task.priority]?.color || 'bg-slate-100 text-slate-600'}`}>
                                                        {PRIORITY_CONFIG[task.priority]?.label || task.priority}
                                                    </span>
                                                </div>

                                                {/* Labels */}
                                                <div className="flex items-center flex-wrap gap-1">
                                                    {!task.labels?.length ? (
                                                        <span className="text-slate-400 text-xs">—</span>
                                                    ) : (
                                                        task.labels.slice(0, 2).map((l, i) => (
                                                            <span key={i} className="inline-block bg-slate-100 text-slate-600 text-[11px] px-1.5 py-0.5 rounded">{l}</span>
                                                        ))
                                                    )}
                                                    {task.labels?.length > 2 && (
                                                        <span className="text-[11px] text-slate-500">+{task.labels.length - 2}</span>
                                                    )}
                                                </div>

                                                {/* Dependencies */}
                                                <div className="flex items-center flex-wrap gap-1">
                                                    {!task.dependencies?.length ? (
                                                        <span className="text-slate-400 text-xs">—</span>
                                                    ) : (
                                                        task.dependencies.slice(0, 2).map(depId => {
                                                            const dep = taskIdToTaskMap.get(depId);
                                                            return dep ? (
                                                                <span key={depId} className="text-slate-700 hover:text-slate-900 cursor-pointer text-[11px] font-medium">
                                                                    {dep.projectKey}-{dep.id}
                                                                </span>
                                                            ) : (
                                                                <span key={depId} className="text-slate-400 text-[11px]">{depId}</span>
                                                            );
                                                        })
                                                    )}
                                                    {task.dependencies?.length > 2 && (
                                                        <span className="text-[11px] text-slate-500">+{task.dependencies.length - 2}</span>
                                                    )}
                                                </div>

                                                {/* Critical */}
                                                <div className="flex items-center justify-center">
                                                    <span className={`inline-flex items-center py-1 px-2 rounded text-[11px] font-medium ${task.isCritical ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                                        {task.isCritical ? 'Yes' : 'No'}
                                                    </span>
                                                </div>

                                                {/* Status Indicator */}
                                                <div className="flex items-center">
                                                    <span className={`inline-flex items-center py-1 px-2 rounded text-[11px] font-medium ${
                                                        task.isDelayed
                                                            ? 'bg-red-50 text-red-600'
                                                            : task.isUpcomingDeadline
                                                                ? 'bg-amber-50 text-amber-600'
                                                                : task.isDelayedByDependency
                                                                    ? 'bg-violet-50 text-violet-600'
                                                                    : 'bg-green-50 text-green-600'
                                                    }`}>
                                                        {task.isDelayed ? 'Delayed' : task.isUpcomingDeadline ? 'Soon' : task.isDelayedByDependency ? 'Blocked' : 'On Track'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-slate-600">
                                    <span className="font-semibold text-slate-900">{filteredTasks.length}</span> {filteredTasks.length === 1 ? 'task' : 'tasks'}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Timeline Header */}
                        <div className="flex mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white" ref={headerRef} onScroll={syncScroll}>
                            <div className="sticky left-0 z-10 min-w-[300px] flex items-center justify-center text-sm font-semibold text-slate-700 bg-white border-r border-slate-200">Projects</div>
                            <div className="flex-1 flex relative bg-white">{renderMonths()}</div>
                        </div>

                        {/* Timeline Content */}
                        <div className="space-y-3 overflow-auto flex-grow" ref={timelineRef} onScroll={syncScroll}>
                            {processedProjects.filter(p => !projectKeyFilter || p.projectKey === projectKeyFilter).filter(p => filteredProjectKeys.has(p.projectKey) || !hasActiveFilters()).map((project, projectIndex) => {
                                const projectFilteredTasks = project.tasks.filter(t => filteredTasks.some(ft => ft.taskKey === t.taskKey));
                                if (projectFilteredTasks.length === 0 && hasActiveFilters()) return null;

                                return (
                                    <div key={project.projectKey} className="relative">
                                        {/* Project Row */}
                                        <div className="flex group hover:bg-slate-50 transition-colors rounded-t-xl" style={{ width: `${timelineWidth}px` }}>
                                            <div className="sticky left-0 z-10 min-w-[300px] flex items-center justify-between p-3 bg-white border border-slate-200 rounded-t-xl">
                                                <div className="flex items-center space-x-3">
                                                    <button onClick={() => toggleExpand(project.projectKey)} className="text-slate-400 hover:text-slate-700 transition-colors">{expandedProjects[project.projectKey] ? <CollapseIcon /> : <ExpandIcon />}</button>
                                                    <div className="cursor-pointer" onClick={() => openModal('project', 'edit', project)}>
                                                        <div className="font-semibold text-sm text-slate-900 hover:text-slate-700 transition-colors">{project.projectKey}: {project.summary.length > 18 ? `${project.summary.substring(0, 21)}...` : project.summary}</div>
                                                        <div className="flex gap-2 mt-1">
                                                            <span className="text-xs font-medium bg-slate-100 text-slate-700 py-0.5 px-2 rounded">{project.projectProgress}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button onClick={() => openModal('task', 'create', project)} className="text-slate-600 hover:text-slate-900 transition-colors"><AddIcon /></button>
                                            </div>
                                            <div className="flex-1 flex items-center relative">
                                                {project.projectStartDate && project.projectDueDate && (
                                                    <div className="absolute bg-slate-900 h-4 rounded-full" style={calculateTaskPosition(project.projectStartDate, project.projectDueDate, timelineStart)} />
                                                )}
                                            </div>
                                        </div>

                                        {/* Task Rows */}
                                        {expandedProjects[project.projectKey] && (
                                            <div className="flex flex-col">
                                                {(hasActiveFilters() ? projectFilteredTasks : project.tasks).map((task, taskIndex, arr) => {
                                                    const taskPosition = calculateTaskPosition(task.startDate, task.dueDate, timelineStart);
                                                    const isLastTask = taskIndex === arr.length - 1;
                                                    const taskGlobalIndex = projectRowOffsets[projectIndex] + project.tasks.findIndex(t => t.id === task.id);
                                                    const enrichedTask = allTasks.find(t => t.taskKey === task.taskKey);

                                                    return (
                                                        <div key={task.taskKey} className={`flex relative-container group hover:bg-slate-50 transition-colors ${isLastTask ? 'rounded-b-xl' : ''}`} style={{ width: `${timelineWidth}px` }}>
                                                            <div className={`sticky left-0 z-10 w-[300px] flex items-center p-3 pl-6 cursor-pointer bg-white border-x border-b border-slate-200 ${isLastTask ? 'rounded-b-xl' : ''}`} onClick={() => { if (!isResizingRef.current && !wasResizingRef.current) openModal('task', 'edit', project, task); }}>
                                                                <span className="font-medium text-sm flex flex-wrap items-center gap-1.5">
                                                                    <span className={task.isCritical ? 'text-red-600' : 'text-slate-900'}>{task.taskKey}:</span>
                                                                    <span className="text-slate-700">{task.summary.length > 15 ? `${task.summary.substring(0, 15)}...` : task.summary}</span>
                                                                    {task.status && <span className={`text-xs py-0.5 px-2 rounded font-medium ${STATUS_CONFIG[task.status]?.color || 'bg-slate-100 text-slate-600'}`}>{STATUS_CONFIG[task.status]?.label || task.status}</span>}
                                                                    <span className="text-xs py-0.5 px-2 bg-slate-100 text-slate-600 rounded font-medium">{task.progress}%</span>
                                                                </span>
                                                            </div>
                                                            <div className="flex-1 flex items-center relative">
                                                                {/* Task Bar */}
                                                                <div className={`absolute ${task.isCritical ? 'bg-red-500' : 'bg-slate-900'} h-3 rounded-full cursor-pointer hover:opacity-90 transition-opacity`} style={{ marginLeft: `${taskPosition.marginLeft}px`, width: `${taskPosition.width}px` }} onClick={e => { if (!isResizingRef.current && !wasResizingRef.current) openModal('task', 'edit', project, task); else e.stopPropagation(); }}>
                                                                    <div className="absolute left-0 top-0 h-full w-2 cursor-w-resize" onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, task.taskKey, project.projectKey, 'left'); }} />
                                                                    <div className="absolute right-0 top-0 h-full w-2 cursor-e-resize" onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, task.taskKey, project.projectKey, 'right'); }} />
                                                                </div>

                                                                {/* Delayed Indicator */}
                                                                {enrichedTask?.isDelayed && (
                                                                    <div className="absolute flex items-center gap-1" style={{ left: taskPosition.marginLeft + taskPosition.width / 2 - 20, top: -12 }}>
                                                                        <span className="text-xs py-0.5 px-2 rounded bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                                            Delayed
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {/* Dependency Lines */}
                                                                {task.dependencies?.filter(dep => {
                                                                    const depId = typeof dep === 'object' ? dep.taskId : dep;
                                                                    if (!filteredTaskIds.has(depId)) return false;
                                                                    const depTask = allTasks.find(t => t.id === depId);
                                                                    if (!depTask) return false;
                                                                    const depProject = processedProjects.find(p => p.projectKey === depTask.projectKey);
                                                                    return depProject && expandedProjects[depProject.projectKey] && (!projectKeyFilter || depProject.projectKey === projectKeyFilter) && (filteredProjectKeys.has(depProject.projectKey) || !hasActiveFilters());
                                                                }).map(dep => {
                                                                    const depId = typeof dep === 'object' ? dep.taskId : dep;
                                                                    const depTask = allTasks.find(t => t.id === depId);
                                                                    const depProject = processedProjects.find(p => p.projectKey === depTask.projectKey);
                                                                    if (!depProject || !depTask) return null;

                                                                    const depProjectIndex = processedProjects.findIndex(p => p.projectKey === depProject.projectKey);
                                                                    const depTaskIndex = depProject.tasks.findIndex(t => t.id === depTask.id);
                                                                    let relativeDepIndex = (projectRowOffsets[depProjectIndex] + depTaskIndex) - taskGlobalIndex;
                                                                    if (depProjectIndex !== projectIndex) relativeDepIndex -= 1.4;

                                                                    const verticalSpacing = 50;
                                                                    const startY = relativeDepIndex * verticalSpacing + verticalSpacing / 2;
                                                                    const endY = verticalSpacing / 2;
                                                                    const depPosition = calculateTaskPosition(depTask.startDate, depTask.dueDate, timelineStart);
                                                                    const startX = depPosition.marginLeft + depPosition.width;
                                                                    const endX = taskPosition.marginLeft;
                                                                    const minY = Math.min(startY, endY);
                                                                    const svgHeight = Math.abs(endY - startY) + 20;

                                                                    return (
                                                                        <svg key={`dep-${depTask.id}-${task.id}`} className="absolute" style={{ top: `${minY}px`, left: 0, width: '100%', height: `${svgHeight}px`, pointerEvents: 'none', zIndex: 2 }}>
                                                                            <path d={generateBezierPath(startX, startY - minY, endX, endY - minY)} stroke="#475569" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />
                                                                            <defs><marker id="arrowhead" markerWidth="6" markerHeight="4" refX="0" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#475569" /></marker></defs>
                                                                        </svg>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {modalOpen && <TaskProjectModal modalType={modalType} modalMode={modalMode} project={currentProject} task={currentTask} projects={projects} projectKey={currentTask?.projectKey} onClose={closeModal} />}
            </div>
        </div>
    );
};

export default UnifiedView;