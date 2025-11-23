import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DataContext } from '../context/DataContext';
import Header from './Header';
import TaskProjectModal from './TaskProjectModal';
import axios from 'axios';

const ListView = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { projects } = useContext(DataContext);

    const [allTasks, setAllTasks] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState(null);
    const [modalMode, setModalMode] = useState(null);
    const [currentTask, setCurrentTask] = useState(null);
    const [sortField, setSortField] = useState('id');
    const [sortOrder, setSortOrder] = useState('asc');
    const [filters, setFilters] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const dataContext = useContext(DataContext);

    const filterFields = [
        'status',
        'assignee',
        'labels',
        'startDate',
        'dueDate',
        'priority',
        'criticality',
        'delayed',
        'projectKey',
    ];

    // Build a map from task id to task from raw projects data
    const taskIdToTaskMap = useState(() => {
        const map = new Map();
        projects.forEach(project => {
            project.tasks?.forEach(task => {
                map.set(task.id, task);
            });
        });
        return map;
    })[0];

    // Read URL parameters into filters
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const criticalParam = params.get('critical');
        const delayedParam = params.get('delayed');
        const upcomingDeadlineParam = params.get('upcomingDeadline');
        const delayedByDependencyParam = params.get('delayedByDependency');

        if (criticalParam === 'true') {
            setFilters(prev => ({ ...prev, criticality: 'Critical' }));
        }
        if (delayedParam === 'true') {
            setFilters(prev => ({ ...prev, delayed: 'Delayed' }));
        }
        if (upcomingDeadlineParam === 'true') {
            setFilters(prev => ({ ...prev, delayed: 'Upcoming deadline' }));
        }
        if (delayedByDependencyParam === 'true') {
            setFilters(prev => ({ ...prev, delayed: 'Delayed by dependency' }));
        }
    }, [location.search]);

    // Compute tasks and enrich them with new property isDelayedByDependency
    useEffect(() => {
        let tasks = projects.flatMap(proj => {
            return proj.tasks?.map(task => {
                const startDate = task.startDate ? new Date(task.startDate) : null;
                const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                const today = new Date();
                const progress = task.progress ?? 0;
                let duration = 'N/A';
                if (startDate && dueDate) {
                    const diffTime = dueDate - startDate;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    duration = diffDays >= 0 ? diffDays : 'N/A';
                }
                const isDelayed = dueDate && dueDate < today && progress < 100;
                let isUpcomingDeadline = false;
                if (!isDelayed && dueDate) {
                    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 4 && diffDays >= 0) {
                        isUpcomingDeadline = true;
                    }
                }
                return {
                    ...task,
                    projectKey: proj.projectKey,
                    projectSummary: proj.summary,
                    taskKey: `${proj.projectKey}-${task.id}`,
                    reporter: task.reporter?.email || 'N/A',
                    duration,
                    labels: Array.isArray(task.labels) ? task.labels : [],
                    isDelayed,
                    isUpcomingDeadline,
                    // Will be computed in second pass
                    isDelayedByDependency: false,
                };
            }) || [];
        });

        // Build a map of enriched tasks for dependency checks
        const enrichedTaskMap = new Map();
        tasks.forEach(task => {
            enrichedTaskMap.set(task.id, task);
        });
        // Second pass: set isDelayedByDependency if any dependency is delayed
        tasks = tasks.map(task => {
            let isDelayedByDependency = false;
            if (task.dependencies && task.dependencies.length > 0) {
                for (let depId of task.dependencies) {
                    const depTask = enrichedTaskMap.get(depId);
                    if (depTask && depTask.isDelayed) {
                        isDelayedByDependency = true;
                        break;
                    }
                }
            }
            return { ...task, isDelayedByDependency };
        });

        tasks.sort((a, b) => a.id - b.id);
        setAllTasks(tasks);
    }, [projects]);

    const openModal = (type, mode, task = null) => {
        setModalType(type);
        setModalMode(mode);
        setCurrentTask(task);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setCurrentTask(null);
    };

    const handleSort = (field) => {
        const order = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
        setSortField(field);
        setSortOrder(order);
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        const params = new URLSearchParams(location.search);
        if (field === 'criticality') {
            if (value === 'Critical') {
                params.set('critical', 'true');
            } else {
                params.delete('critical');
            }
        }
        if (field === 'delayed') {
            if (value === 'Delayed') {
                params.set('delayed', 'true');
                params.delete('upcomingDeadline');
                params.delete('delayedByDependency');
            } else if (value === 'Upcoming deadline') {
                params.set('upcomingDeadline', 'true');
                params.delete('delayed');
                params.delete('delayedByDependency');
            } else if (value === 'Delayed by dependency') {
                params.set('delayedByDependency', 'true');
                params.delete('delayed');
                params.delete('upcomingDeadline');
            } else {
                params.delete('delayed');
                params.delete('upcomingDeadline');
                params.delete('delayedByDependency');
            }
        }
        navigate(`/list?${params.toString()}`);
    };

    const getProcessedTasks = () => {
        let tasks = [...allTasks];
        const params = new URLSearchParams(location.search);
        const projectKey = params.get('projectKey');
        const criticalParam = params.get('critical');
        const delayedParam = params.get('delayed');
        const upcomingDeadlineParam = params.get('upcomingDeadline');
        const delayedByDependencyParam = params.get('delayedByDependency');

        if (projectKey) {
            tasks = tasks.filter(task => task.projectKey === projectKey);
        }
        if (criticalParam === 'true') {
            tasks = tasks.filter(task => task.isCritical);
        }
        if (upcomingDeadlineParam === 'true') {
            tasks = tasks.filter(task => task.isUpcomingDeadline);
        } else if (delayedByDependencyParam === 'true') {
            tasks = tasks.filter(task => task.isDelayedByDependency);
        } else if (delayedParam === 'true') {
            tasks = tasks.filter(task => task.isDelayed);
        }

        tasks = tasks.filter(task =>
            Object.entries(filters).every(([field, value]) => {
                if (!value || value === 'All') return true;
                if (field === 'labels') {
                    return Array.isArray(task.labels) && task.labels.includes(value);
                }
                if (field === 'assignee') {
                    return task.assignee === value;
                }
                if (field === 'startDate' || field === 'dueDate' || field === 'created') {
                    return task[field] && new Date(task[field]).toISOString().split('T')[0] === value;
                }
                if (field === 'priority') {
                    return task.priority === value;
                }
                if (field === 'reporter') {
                    return task.reporter === value;
                }
                if (field === 'criticality') {
                    return value === 'Critical' ? task.isCritical : true;
                }
                if (field === 'delayed') {
                    if (value === 'Delayed') return task.isDelayed;
                    if (value === 'On Time')
                        return !task.isDelayed && !task.isUpcomingDeadline && !task.isDelayedByDependency;
                    if (value === 'Upcoming deadline') return task.isUpcomingDeadline;
                    if (value === 'Delayed by dependency') return task.isDelayedByDependency;
                    return true;
                }
                return task[field] === value;
            })
        );

        if (searchQuery.trim() !== '') {
            tasks = tasks.filter(task =>
                task.summary.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        tasks.sort((a, b) => {
            let fieldA = a[sortField];
            let fieldB = b[sortField];
            if (['startDate', 'dueDate', 'created'].includes(sortField)) {
                fieldA = new Date(fieldA);
                fieldB = new Date(fieldB);
            }
            if (sortField === 'progress' || sortField === 'duration') {
                fieldA = Number(fieldA);
                fieldB = Number(fieldB);
            }
            if (sortField === 'isCritical' || sortField === 'isDelayed') {
                fieldA = a[sortField] ? 1 : 0;
                fieldB = b[sortField] ? 1 : 0;
            }
            if (sortField === 'priority') {
                const priorityOrder = {
                    'Lowest': 1,
                    'Low': 2,
                    'Normal': 3,
                    'High': 4,
                    'Highest': 5,
                };
                fieldA = priorityOrder[fieldA] || 0;
                fieldB = priorityOrder[fieldB] || 0;
            }
            if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
            if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return tasks;
    };

    const handleProjectFilterChange = (e) => {
        const selectedProjectKey = e.target.value;
        const params = new URLSearchParams(location.search);
        if (selectedProjectKey === 'All') {
            params.delete('projectKey');
        } else {
            params.set('projectKey', selectedProjectKey);
        }
        navigate(`/list?${params.toString()}`);
    };

    const handleLogout = async () => {
        try {
            await axios.delete('/api/auth/logout');
            dataContext.setUser(null);
            navigate('/login');
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    const renderDependencies = (task) => {
        if (!task.dependencies || task.dependencies.length === 0) return 'None';
        return task.dependencies.map(depId => {
            const depTask = taskIdToTaskMap.get(depId);
            return depTask ? (
                <span key={depId} className="text-blue-600 cursor-pointer mr-2">
          {depTask.taskKey}
        </span>
            ) : (
                <span key={depId} className="text-gray-500 mr-2">
          ID: {depId}
        </span>
            );
        });
    };

    const renderLabels = (labels) => {
        if (!labels || labels.length === 0) return 'None';
        return labels.map((label, index) => (
            <span key={index} className="inline-block bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full mr-1">
        {label}
      </span>
        ));
    };

    const renderPriority = (priority) => {
        const priorityClasses = {
            'Lowest': 'bg-gray-200 text-gray-800',
            'Low': 'bg-blue-200 text-blue-800',
            'Normal': 'bg-yellow-200 text-yellow-800',
            'High': 'bg-orange-200 text-orange-800',
            'Highest': 'bg-red-200 text-red-800',
        };
        return (
            <span
                className={`inline-flex items-center gap-1.5 py-1 px-2 rounded-lg text-xs font-medium ${
                    priorityClasses[priority] || 'bg-gray-200 text-gray-800'
                }`}
            >
        {priority}
      </span>
        );
    };

    return (
        <div className="relative p-6 text-gray-900 flex flex-col min-h-screen">
            <div className="flex-grow rounded-3xl px-6 py-4 bg-white shadow-lg flex flex-col">
                <Header
                    onLogout={handleLogout}
                    onCreateProject={() => openModal('project', 'create')}
                    onCreateTask={() => openModal('task', 'create')}
                />
                <div className="flex justify-between items-center mb-4 ml-4">
                    <h1 className="text-2xl font-bold">All Tasks</h1>
                </div>
                <div className="flex justify-between items-center mb-4 ml-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex items-center space-x-2">
                            <label htmlFor="filter-projectKey" className="text-sm font-medium">
                                Project:
                            </label>
                            <select
                                id="filter-projectKey"
                                className="p-2 border border-gray-300 rounded-lg"
                                value={
                                    (() => {
                                        const params = new URLSearchParams(location.search);
                                        return params.get('projectKey') || 'All';
                                    })()
                                }
                                onChange={handleProjectFilterChange}
                            >
                                <option value="All">All Projects</option>
                                {projects.map(proj => (
                                    <option key={proj.projectKey} value={proj.projectKey}>
                                        {proj.summary} ({proj.projectKey})
                                    </option>
                                ))}
                            </select>
                        </div>
                        {filterFields.filter(field => field !== 'projectKey').map(field => (
                            <div key={field} className="flex items-center space-x-2">
                                <label htmlFor={`filter-${field}`} className="text-sm font-medium">
                                    {field.charAt(0).toUpperCase() + field.slice(1)}:
                                </label>
                                {field === 'labels' ? (
                                    <select
                                        id={`filter-${field}`}
                                        className="p-2 border border-gray-300 rounded-lg"
                                        value={filters[field] || 'All'}
                                        onChange={(e) => handleFilterChange(field, e.target.value)}
                                    >
                                        <option value="All">All</option>
                                        {Array.from(
                                            new Set(
                                                allTasks
                                                    .flatMap(task => task.labels)
                                                    .filter(label => label)
                                            )
                                        ).map(label => (
                                            <option key={label} value={label}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                ) : field === 'assignee' ? (
                                    <select
                                        id={`filter-${field}`}
                                        className="p-2 border border-gray-300 rounded-lg"
                                        value={filters[field] || 'All'}
                                        onChange={(e) => handleFilterChange(field, e.target.value)}
                                    >
                                        <option value="All">All</option>
                                        {Array.from(
                                            new Set(
                                                allTasks
                                                    .map(task => task.assignee || 'Unassigned')
                                                    .filter(assignee => assignee)
                                            )
                                        ).map(assignee => (
                                            <option key={assignee} value={assignee}>
                                                {assignee}
                                            </option>
                                        ))}
                                    </select>
                                ) : field === 'startDate' || field === 'dueDate' || field === 'created' ? (
                                    <input
                                        type="date"
                                        id={`filter-${field}`}
                                        className="p-2 border border-gray-300 rounded-lg"
                                        value={filters[field] || ''}
                                        onChange={(e) => handleFilterChange(field, e.target.value)}
                                    />
                                ) : field === 'criticality' ? (
                                    <select
                                        id={`filter-${field}`}
                                        className="p-2 border border-gray-300 rounded-lg"
                                        value={filters[field] || 'All'}
                                        onChange={(e) => handleFilterChange(field, e.target.value)}
                                    >
                                        <option value="All">All</option>
                                        <option value="Critical">Critical</option>
                                        <option value="Non-Critical">Non-Critical</option>
                                    </select>
                                ) : field === 'delayed' ? (
                                    <select
                                        id={`filter-${field}`}
                                        className="p-2 border border-gray-300 rounded-lg"
                                        value={filters[field] || 'All'}
                                        onChange={(e) => handleFilterChange(field, e.target.value)}
                                    >
                                        <option value="All">All</option>
                                        <option value="Delayed">Delayed</option>
                                        <option value="Delayed by dependency">Delayed by dependency</option>
                                        <option value="On Time">On Time</option>
                                        <option value="Upcoming deadline">Upcoming deadline</option>
                                    </select>
                                ) : field === 'priority' ? (
                                    <select
                                        id={`filter-${field}`}
                                        className="p-2 border border-gray-300 rounded-lg"
                                        value={filters[field] || 'All'}
                                        onChange={(e) => handleFilterChange(field, e.target.value)}
                                    >
                                        <option value="All">All</option>
                                        <option value="Lowest">Lowest</option>
                                        <option value="Low">Low</option>
                                        <option value="Normal">Normal</option>
                                        <option value="High">High</option>
                                        <option value="Highest">Highest</option>
                                    </select>
                                ) : field === 'reporter' ? (
                                    <select
                                        id={`filter-${field}`}
                                        className="p-2 border border-gray-300 rounded-lg"
                                        value={filters[field] || 'All'}
                                        onChange={(e) => handleFilterChange(field, e.target.value)}
                                    >
                                        <option value="All">All</option>
                                        {Array.from(
                                            new Set(
                                                allTasks
                                                    .map(task => task.reporter || 'N/A')
                                                    .filter(reporter => reporter)
                                            )
                                        ).map(reporter => (
                                            <option key={reporter} value={reporter}>
                                                {reporter}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <select
                                        id={`filter-${field}`}
                                        className="p-2 border border-gray-300 rounded-lg"
                                        value={filters[field] || 'All'}
                                        onChange={(e) => handleFilterChange(field, e.target.value)}
                                    >
                                        <option value="All">All</option>
                                        {Array.from(new Set(allTasks.map(task => task[field])))
                                            .filter(value => value)
                                            .map(value => (
                                                <option key={value} value={value}>
                                                    {value}
                                                </option>
                                            ))}
                                    </select>
                                )}
                            </div>
                        ))}
                    </div>
                    <div>
                        <input
                            type="text"
                            className="p-2 border border-gray-300 rounded-lg"
                            placeholder="Filter tasks by name"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="-m-1.5 overflow-x-auto">
                    <div className="p-1.5 min-w-full inline-block align-middle">
                        <div className="overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('projectKey')}
                                    >
                                        Project {sortField === 'projectKey' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('taskKey')}
                                    >
                                        Task Key {sortField === 'taskKey' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('summary')}
                                    >
                                        Summary {sortField === 'summary' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('status')}
                                    >
                                        Status {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('assignee')}
                                    >
                                        Assignee {sortField === 'assignee' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('startDate')}
                                    >
                                        Start Date {sortField === 'startDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('dueDate')}
                                    >
                                        Due Date {sortField === 'dueDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('duration')}
                                    >
                                        Duration {sortField === 'duration' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('progress')}
                                    >
                                        Progress {sortField === 'progress' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('priority')}
                                    >
                                        Priority {sortField === 'priority' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('labels')}
                                    >
                                        Labels {sortField === 'labels' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800">
                                        Dependencies
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('isCritical')}
                                    >
                                        Criticality {sortField === 'isCritical' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-800 cursor-pointer"
                                        onClick={() => handleSort('isDelayed')}
                                    >
                                        Delayed {sortField === 'isDelayed' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                {getProcessedTasks().map(task => (
                                    <tr
                                        key={task.taskKey}
                                        className={`bg-white hover:bg-gray-50 cursor-pointer ${task.isCritical ? 'text-red-600' : 'text-blue-600'}`}
                                        onClick={() => openModal('task', 'edit', task)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-800">
                                                {task.projectSummary} ({task.projectKey})
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm ">{task.taskKey}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-500">{task.summary}</div>
                                        </td>
                                        <td className="px-6 py-4">
                        <span
                            className={`inline-flex items-center gap-1.5 py-1 px-2 rounded-lg text-xs font-medium ${
                                task.status === 'To Do'
                                    ? 'bg-blue-100 text-blue-800'
                                    : task.status === 'In Progress'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-green-100 text-green-800'
                            }`}
                        >
                          {task.status}
                        </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-800">
                                                {task.assignee || 'Unassigned'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-500">
                                                {task.startDate !== 'Invalid Date'
                                                    ? new Date(task.startDate).toLocaleDateString()
                                                    : 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-500">
                                                {task.dueDate !== 'Invalid Date'
                                                    ? new Date(task.dueDate).toLocaleDateString()
                                                    : 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-800">
                                                {task.duration !== 'N/A' ? `${task.duration} days` : 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                <div
                                                    className="bg-blue-600 h-2.5 rounded-full"
                                                    style={{ width: `${task.progress}%` }}
                                                ></div>
                                            </div>
                                            <div className="text-sm text-gray-500">{task.progress}%</div>
                                        </td>
                                        <td className="px-6 py-4">{renderPriority(task.priority)}</td>
                                        <td className="px-6 py-4">{renderLabels(task.labels)}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-800">{renderDependencies(task)}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {task.isCritical ? (
                                                <span className="text-red-600">Critical</span>
                                            ) : (
                                                <span className="text-green-600">Non-critical</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {task.isDelayed ? (
                                                <span className="text-red-600">Delayed</span>
                                            ) : task.isUpcomingDeadline ? (
                                                <span className="text-yellow-600">Upcoming deadline</span>
                                            ) : task.isDelayedByDependency ? (
                                                <span className="text-purple-600">Delayed by dependency</span>
                                            ) : (
                                                <span className="text-green-600">On Time</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 flex justify-between items-center">
                            <div>
                                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-800">
                    {getProcessedTasks().length}
                  </span>{' '}
                                    results
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                {modalOpen && (
                    <TaskProjectModal
                        modalType={modalType}
                        modalMode={modalMode}
                        projects={projects}
                        projectKey={currentTask?.projectKey}
                        task={currentTask}
                        onClose={() => closeModal()}
                    />
                )}
            </div>
        </div>
    );
};

export default ListView;
