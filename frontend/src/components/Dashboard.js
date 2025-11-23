import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, Pie } from 'react-chartjs-2';
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    TimeScale,
    Title,
    Tooltip,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import Header from './Header';
import { DataContext } from '../context/DataContext';
import TaskProjectModal from './TaskProjectModal';
import axios from "axios";

ChartJS.register(
    TimeScale,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

const Dashboard = () => {
    const navigate = useNavigate();
    const { user, projects, userTasks, loading, error, refreshProjects, refreshUserTasks } = useContext(DataContext);
    const dataContext = useContext(DataContext);
    const [stats, setStats] = useState({
        totalProjects: 0,
        totalTasks: 0,
        criticalTasks: 0,
        delayedTasks: 0,
        tasksDelayedByDependency: 0,
        tasksPerStatus: {},
        tasksByPriority: {},
        assignedTasks: [],
        longestTasks: [],
        tasksPerAssignee: {},
        projectCompletion: [],
        closeDeadlines: [],
        tasksDelayedByDependencyList: [],
    });

    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState(null); // 'task' or 'project'
    const [modalMode, setModalMode] = useState(null); // 'create' or 'edit'
    const [currentProject, setCurrentProject] = useState(null);
    const [currentTask, setCurrentTask] = useState(null);

    useEffect(() => {
        if (!user) {
            navigate('/login');
        }
    }, [user, navigate]);

    useEffect(() => {
        if (projects.length > 0 && userTasks.length >= 0) {
            computeStats(projects, userTasks);
        }
    }, [projects, userTasks]);

    const computeStats = (projectsData, userTasksData) => {
        const totalProjects = projectsData.length;
        const allTasks = [];
        const tasksPerStatus = {};
        const tasksPerAssignee = {};
        const tasksByPriority = {};

        projectsData.forEach(project => {
            project.tasks?.forEach(task => {
                const taskProgress = task.progress ?? 0;
                const status = task.status || 'Unspecified';
                tasksPerStatus[status] = (tasksPerStatus[status] || 0) + 1;

                const assignee = task.assignee || 'Unassigned';
                tasksPerAssignee[assignee] = (tasksPerAssignee[assignee] || 0) + 1;

                const priority = task.priority || 'Normal';
                tasksByPriority[priority] = (tasksByPriority[priority] || 0) + 1;

                allTasks.push({ ...task, projectKey: project.projectKey, progress: taskProgress });
            });
        });

        const totalTasks = allTasks.length;
        const criticalTasks = allTasks.filter(task => task.isCritical).length;
        const today = new Date();

        const delayedTasks = allTasks.filter(task => {
            const dueDate = new Date(task.dueDate);
            return dueDate < today && (task.progress ?? 0) < 100;
        }).length;

        // Build a task map for dependency checks
        const taskMap = {};
        allTasks.forEach(task => {
            taskMap[task.id] = task;
        });
        const tasksDelayedByDependencyList = allTasks.filter(task => {
            if (!task.dependencies || task.dependencies.length === 0) return false;
            return task.dependencies.some(depId => {
                const dep = taskMap[depId];
                if (!dep) return false;
                const depDue = new Date(dep.dueDate);
                return depDue < today && (dep.progress ?? 0) < 100;
            });
        });
        const tasksDelayedByDependency = tasksDelayedByDependencyList.length;

        // Longest tasks (top 5)
        const longestTasks = allTasks
            .map(task => {
                const start = new Date(task.startDate);
                const due = new Date(task.dueDate);
                const duration = Math.ceil((due - start) / (1000 * 60 * 60 * 24));
                return { ...task, duration };
            })
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5);

        // Project completion percentages
        const projectCompletion = projectsData.map(project => {
            const totalProjectTasks = project.tasks?.length || 0;
            const totalProgress = project.tasks?.reduce((sum, t) => sum + (t.progress || 0), 0);
            const completionPercentage = totalProjectTasks > 0 ? Math.round(totalProgress / totalProjectTasks) : 0;
            return {
                projectKey: project.projectKey,
                summary: project.summary,
                completionPercentage,
            };
        });

        // Close deadlines (next 7 days)
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        const closeDeadlines = allTasks.filter(task => {
            const dueDate = new Date(task.dueDate);
            return dueDate >= today && dueDate <= nextWeek;
        });

        setStats({
            totalProjects,
            totalTasks,
            criticalTasks,
            delayedTasks,
            tasksDelayedByDependency,
            tasksPerStatus,
            tasksByPriority,
            assignedTasks: userTasksData,
            longestTasks,
            tasksPerAssignee,
            projectCompletion,
            closeDeadlines,
            tasksDelayedByDependencyList,
        });
    };

    const processedProjects = useMemo(() => {
        return projects.map(project => {
            let projectStartDate = null;
            let projectDueDate = null;
            if (project.tasks && project.tasks.length > 0) {
                const startDates = project.tasks.map(task => new Date(task.startDate));
                const dueDates = project.tasks.map(task => new Date(task.dueDate));
                projectStartDate = new Date(Math.min(...startDates)).toISOString().split('T')[0];
                projectDueDate = new Date(Math.max(...dueDates)).toISOString().split('T')[0];
            }
            return { ...project, projectStartDate, projectDueDate };
        });
    }, [projects]);

    const openModal = (type, mode, project, task = null) => {
        setModalType(type);
        setModalMode(mode);
        setCurrentProject(project);
        setCurrentTask(task);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setCurrentProject(null);
        setCurrentTask(null);
        refreshProjects();
        refreshUserTasks();
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        });
    };

    const handleLogout = () => {
        axios
            .delete('/api/auth/logout')
            .then(() => {
                dataContext.setUser(null);
                navigate('/login');
            })
            .catch((error) => {
                console.error('Logout failed', error);
            });
    };

    const handleCriticalFilter = () => {
        navigate('/list?critical=true');
    };

    const handleDelayedFilter = () => {
        navigate('/list?delayed=true');
    };

    const handleUpcomingDeadlinesFilter = () => {
        navigate('/list?upcomingDeadline=true');
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading Dashboard...</div>;
    }

    if (error) {
        return <div className="text-red-500">Error loading dashboard.</div>;
    }

    return (
        <div className="relative p-6 text-gray-900 flex flex-col min-h-screen">
            <div className="flex-grow rounded-3xl px-6 py-4 bg-white flex flex-col">
                <Header
                    onLogout={handleLogout}
                    onCreateProject={() => openModal('project', 'create')}
                    onCreateTask={() => openModal('task', 'create')}
                />

                <div className="px-2">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold">Hello, {user?.firstname || 'User'}</h1>
                        <p className="text-gray-600">Today is {formatDate(new Date())}</p>
                    </div>

                    {/* Quick Actions */}
                    <h2 className="text-l font-semibold mb-1">Quick Actions</h2>
                    <div className="flex space-x-4 mb-6">
                        <button
                            onClick={handleCriticalFilter}
                            className="py-2 px-4 bg-gray-100 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 transition duration-300"
                        >
                            View critical tasks
                        </button>
                        <button
                            onClick={handleDelayedFilter}
                            className="py-2 px-4 bg-gray-100 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 transition duration-300"
                        >
                            View delayed tasks
                        </button>
                        <button
                            onClick={handleUpcomingDeadlinesFilter}
                            className="py-2 px-4 bg-gray-100 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 transition duration-300"
                        >
                            View upcoming deadlines
                        </button>
                        <button
                            onClick={() => openModal('task', 'create', null)}
                            className="py-2 px-4 bg-gray-100 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 transition duration-300"
                        >
                            Create new task
                        </button>
                        <button
                            onClick={() => openModal('project', 'create')}
                            className="py-2 px-4 bg-gray-100 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 transition duration-300"
                        >
                            Create new project
                        </button>
                    </div>

                    {/* Statistics Cards */}
                    <h2 className="text-l font-semibold mb-1">Statistics</h2>
                    <div className="mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="p-4 bg-blue-100 rounded-lg">
                                <h3 className="text-lg font-semibold">Total Projects</h3>
                                <p className="text-3xl font-bold">{stats.totalProjects}</p>
                            </div>
                            <div className="p-4 bg-green-100 rounded-lg">
                                <h3 className="text-lg font-semibold">Total Tasks</h3>
                                <p className="text-3xl font-bold">{stats.totalTasks}</p>
                            </div>
                            <div className="p-4 bg-red-100 rounded-lg">
                                <h3 className="text-lg font-semibold">Critical Tasks</h3>
                                <p className="text-3xl font-bold">{stats.criticalTasks}</p>
                            </div>
                            <div className="p-4 bg-yellow-100 rounded-lg">
                                <h3 className="text-lg font-semibold">Delayed Tasks</h3>
                                <p className="text-3xl font-bold">{stats.delayedTasks}</p>
                            </div>
                        </div>
                    </div>

                    {/* Charts Section: 4 charts in a row */}
                    <h2 className="text-l font-semibold mb-1">Charts</h2>
                    <div className="mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Project Completion Chart */}
                            <div className="p-4 bg-gray-100 rounded-lg h-72 flex flex-col justify-center">
                                <h3 className="text-md font-semibold mt-2">Projects Completion</h3>
                                {stats.projectCompletion && stats.projectCompletion.length > 0 ? (
                                    <Bar
                                        data={{
                                            labels: stats.projectCompletion.map(
                                                project => `${project.projectKey}: ${project.summary}`
                                            ),
                                            datasets: [
                                                {
                                                    label: 'Avg Completion (%)',
                                                    data: stats.projectCompletion.map(project => project.completionPercentage),
                                                    backgroundColor: '#4caf50',
                                                },
                                            ],
                                        }}
                                        options={{
                                            indexAxis: 'y',
                                            scales: {
                                                x: { beginAtZero: true, max: 100, title: { display: true, text: 'Completion Percentage' } },
                                                y: { title: { display: false } },
                                            },
                                            responsive: true,
                                            maintainAspectRatio: false,
                                        }}
                                    />
                                ) : (
                                    <p className="text-gray-500">No project data available</p>
                                )}
                            </div>

                            {/* Tasks per Status Chart */}
                            <div className="p-4 bg-gray-100 rounded-lg h-72 flex flex-col justify-center">
                                <h3 className="text-md font-semibold mt-2">Tasks per Status</h3>
                                {stats.tasksPerStatus && Object.keys(stats.tasksPerStatus).length > 0 ? (
                                    <Pie
                                        data={{
                                            labels: Object.keys(stats.tasksPerStatus),
                                            datasets: [
                                                {
                                                    data: Object.values(stats.tasksPerStatus),
                                                    backgroundColor: ['#4caf50', '#ff9800', '#f44336', '#2196f3', '#9c27b0'],
                                                },
                                            ],
                                        }}
                                        options={{ maintainAspectRatio: false, responsive: true }}
                                    />
                                ) : (
                                    <p className="text-gray-500">No data available</p>
                                )}
                            </div>

                            {/* Upcoming Deadlines List */}
                            <div className="py-2 px-4 bg-gray-100 rounded-lg h-72 overflow-y-auto">
                                <h3 className="text-md font-semibold mb-2">Next Week's Deadlines</h3>
                                {stats.closeDeadlines && stats.closeDeadlines.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-2">
                                        {stats.closeDeadlines.map(task => (
                                            <li key={task.id} className="text-gray-700">
                                                <a href={`timeline?selectedIssue=${task.taskKey}`} className="font-medium text-blue-600 hover:underline">
                                                    {task.taskKey}: {task.summary}
                                                </a>{' '}
                                                (<em>{formatDate(task.dueDate)}</em>)
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500">No tasks with close deadlines</p>
                                )}
                                <h2 className="text-l font-semibold mb-1 mt-3">Tasks Delayed by Dependency</h2>
                                {stats.tasksDelayedByDependencyList && stats.tasksDelayedByDependencyList.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-2">
                                        {stats.tasksDelayedByDependencyList.map(task => (
                                            <li key={task.id} className="text-gray-700">
                                                <a href={`timeline?selectedIssue=${task.taskKey}`} className="font-medium text-blue-600 hover:underline">
                                                    {task.taskKey}: {task.summary}
                                                </a>{' '}
                                                (<em>{formatDate(task.dueDate)}</em>)
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500">No tasks delayed by dependency</p>
                                )}
                            </div>

                            {/* Longest Tasks Chart */}
                            <div className="p-4 bg-gray-100 rounded-lg h-72 flex flex-col justify-center">
                                <h3 className="text-md font-semibold mt-2">Top 5 Longest Tasks</h3>
                                {stats.longestTasks && stats.longestTasks.length > 0 ? (
                                    <Bar
                                        data={{
                                            labels: stats.longestTasks.map(task => `${task.projectKey}-${task.id}`),
                                            datasets: [
                                                {
                                                    label: 'Duration (days)',
                                                    data: stats.longestTasks.map(task => task.duration),
                                                    backgroundColor: '#3f51b5',
                                                },
                                            ],
                                        }}
                                        options={{
                                            indexAxis: 'y',
                                            scales: { x: { beginAtZero: true } },
                                            maintainAspectRatio: false,
                                            responsive: true,
                                        }}
                                    />
                                ) : (
                                    <p className="text-gray-500">No data available</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Projects Shortcuts */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-l font-semibold">All Projects</h3>
                        </div>
                        {processedProjects.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                {processedProjects.map(project => (
                                    <div
                                        key={project.projectKey}
                                        onClick={() => openModal('project', 'edit', project)}
                                        className="cursor-pointer p-4 bg-gray-50 rounded-lg shadow hover:shadow-md transition"
                                    >
                                        <div className="flex mb-2">
                                            <h4 className="text-lg font-semibold">
                                                {project.projectKey}: {project.summary}
                                            </h4>
                                            <div className="font-semibold text-xs bg-gray-200 p-1.5 rounded-xl px-2 ml-4">
                                                Edit project
                                            </div>
                                        </div>
                                        <div className="mt-2">
                                            <p className="text-gray-600 font-medium text-md">
                                                Start Date:{' '}
                                                {project.projectStartDate ? formatDate(project.projectStartDate) : 'N/A'}
                                            </p>
                                            <p className="text-gray-600 font-medium text-md">
                                                End Date:{' '}
                                                {project.projectDueDate ? formatDate(project.projectDueDate) : 'N/A'}
                                            </p>
                                            <div className="flex -space-x-2 mt-2">
                                                {project.users &&
                                                    project.users.slice(0, 5).map(usr =>
                                                        usr.profilePicture ? (
                                                            <img
                                                                key={usr.id}
                                                                src={`http://localhost:8080${usr.profilePicture}`}
                                                                alt={usr.firstname}
                                                                className="w-8 h-8 rounded-full border-2 border-white"
                                                            />
                                                        ) : (
                                                            <div
                                                                key={usr.id}
                                                                className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center"
                                                            >
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    className="h-4 w-4 text-gray-500"
                                                                    fill="currentColor"
                                                                    viewBox="0 0 24 24"
                                                                >
                                                                    <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5S7 4.24 7 7s2.24 5 5 5zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z" />
                                                                </svg>
                                                            </div>
                                                        )
                                                    )}
                                                {project.users && project.users.length > 5 && (
                                                    <span className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                            +{project.users.length - 5}
                          </span>
                                                )}
                                            </div>
                                            {project.dependencies && project.dependencies.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-gray-600">Dependencies:</p>
                                                    <ul className="list-disc list-inside">
                                                        {project.dependencies.map(dep => (
                                                            <li key={dep}>{dep}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-4 flex space-x-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/timeline?projectKey=${project.projectKey}`);
                                                }}
                                                className="py-1 px-2 bg-blue-100 text-gray-800 text-base font-medium rounded-lg hover:bg-blue-200 transition duration-300"
                                            >
                                                View on Timeline
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/list?projectKey=${project.projectKey}`);
                                                }}
                                                className="py-1 px-2 bg-green-100 text-gray-800 text-base font-medium rounded-lg hover:bg-green-200 transition duration-300"
                                            >
                                                View on List
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500">No projects available</p>
                        )}
                    </div>

                    {modalOpen && (
                        <TaskProjectModal
                            modalType={modalType}
                            modalMode={modalMode}
                            project={currentProject}
                            task={currentTask}
                            onClose={closeModal}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
