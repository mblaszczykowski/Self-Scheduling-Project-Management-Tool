import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react';
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
import { logout } from '../util/api';
import { formatLongDate, formatShortDate, getImageUrl, getAvatarColor } from '../util/helpers';
import './Aurora.css';

ChartJS.register(
    TimeScale, CategoryScale, LinearScale, BarElement,
    PointElement, LineElement, Title, Tooltip, Legend, ArcElement
);

// Professional Chart Configuration
const chartOptions = {
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            titleFont: { size: 12, weight: '600', family: 'system-ui' },
            bodyFont: { size: 11, family: 'system-ui' },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            borderWidth: 1,
            borderColor: 'rgba(148, 163, 184, 0.2)',
        },
    },
    scales: {
        x: {
            grid: { display: false },
            ticks: { font: { size: 10, family: 'system-ui' }, color: '#64748b' },
            border: { display: false },
        },
        y: {
            grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
            ticks: { font: { size: 10, family: 'system-ui' }, color: '#64748b', padding: 8 },
            border: { display: false },
        },
    },
    maintainAspectRatio: false,
};


// Professional Section Header
const SectionHeader = ({ title, subtitle }) => (
    <div className="flex items-start justify-between mb-6">
        <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
    </div>
);

// Chart Container
const ChartCard = ({ title, subtitle, children, className = "" }) => (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 hover:border-slate-300 transition-colors ${className}`}>
        <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {children}
    </div>
);

const Dashboard = () => {
    const navigate = useNavigate();
    const { user, projects, refreshProjects, refreshUserTasks, setUser } = useContext(DataContext);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState(null);
    const [modalMode, setModalMode] = useState(null);
    const [currentProject, setCurrentProject] = useState(null);
    const [currentTask, setCurrentTask] = useState(null);

    useEffect(() => {
        if (!user) navigate('/login');
    }, [user, navigate]);

    // Compute all stats from projects
    const stats = useMemo(() => {
        const tasksPerStatus = {};
        const tasksPerAssignee = {};
        const tasksByPriority = {};
        const allTasks = [];
        const taskMap = {};
        const today = new Date();

        projects.forEach(project => {
            project.tasks?.forEach(task => {
                const progress = task.progress ?? 0;
                const status = task.status || 'Unspecified';
                const assignee = task.assignee || 'Unassigned';
                const priority = task.priority || 'MEDIUM';
                const dependencies = task.dependencyKeys?.map(d => parseInt(d, 10)) || [];

                tasksPerStatus[status] = (tasksPerStatus[status] || 0) + 1;
                tasksPerAssignee[assignee] = (tasksPerAssignee[assignee] || 0) + 1;
                tasksByPriority[priority] = (tasksByPriority[priority] || 0) + 1;

                const taskData = { ...task, projectKey: project.projectKey, progress, dependencies };
                allTasks.push(taskData);
                taskMap[task.id] = taskData;
            });
        });

        const criticalTasks = allTasks.filter(t => t.isCritical).length;
        const delayedTasks = allTasks.filter(t => {
            const dueDate = new Date(t.dueDate);
            return dueDate < today && t.progress < 100;
        }).length;

        const tasksDelayedByDependencyList = allTasks.filter(task => {
            if (!task.dependencies?.length) return false;
            return task.dependencies.some(depId => {
                const dep = taskMap[depId];
                return dep && new Date(dep.dueDate) < today && dep.progress < 100;
            });
        });

        const longestTasks = allTasks
            .map(task => {
                const start = new Date(task.startDate);
                const due = new Date(task.dueDate);
                const duration = Math.ceil((due - start) / (1000 * 60 * 60 * 24));
                return { ...task, duration };
            })
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5);

        const projectCompletion = projects.map(project => {
            const totalTasks = project.tasks?.length || 0;
            const totalProgress = project.tasks?.reduce((sum, t) => sum + (t.progress || 0), 0) || 0;
            return {
                projectKey: project.projectKey,
                summary: project.summary,
                completionPercentage: totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0,
            };
        });

        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        const closeDeadlines = allTasks.filter(task => {
            const dueDate = new Date(task.dueDate);
            return dueDate >= today && dueDate <= nextWeek;
        });

        const myTasks = allTasks
            .filter(task => task.assignee === user?.email)
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .slice(0, 5);

        const recentActivity = [];
        allTasks.filter(t => t.progress === 100).slice(0, 3).forEach(task => {
            recentActivity.push({
                type: 'completed',
                task,
                message: `Task ${task.taskKey} completed`,
                time: task.dueDate,
            });
        });

        allTasks.filter(t => t.isCritical && t.progress < 100).slice(0, 2).forEach(task => {
            recentActivity.push({
                type: 'critical',
                task,
                message: `Critical task ${task.taskKey} needs attention`,
                time: task.dueDate,
            });
        });

        recentActivity.sort((a, b) => new Date(b.time) - new Date(a.time)).splice(8);

        const latestProjects = projects
            .map(project => {
                const recentTasks = project.tasks?.filter(t => t.progress === 100).length || 0;
                const totalTasks = project.tasks?.length || 0;
                return { ...project, recentTasks, totalTasks };
            })
            .sort((a, b) => b.recentTasks - a.recentTasks)
            .slice(0, 5);

        return {
            totalProjects: projects.length,
            totalTasks: allTasks.length,
            criticalTasks,
            delayedTasks,
            tasksDelayedByDependency: tasksDelayedByDependencyList.length,
            tasksPerStatus,
            tasksByPriority,
            longestTasks,
            tasksPerAssignee,
            projectCompletion,
            closeDeadlines,
            tasksDelayedByDependencyList,
            myTasks,
            recentActivity,
            latestProjects,
        };
    }, [projects, user]);

    // Process projects with computed dates
    const processedProjects = useMemo(() => {
        return projects.map(project => {
            let projectStartDate = null;
            let projectDueDate = null;

            if (project.tasks?.length > 0) {
                const startDates = project.tasks.map(t => new Date(t.startDate));
                const dueDates = project.tasks.map(t => new Date(t.dueDate));
                projectStartDate = new Date(Math.min(...startDates)).toISOString().split('T')[0];
                projectDueDate = new Date(Math.max(...dueDates)).toISOString().split('T')[0];
            }

            return { ...project, projectStartDate, projectDueDate };
        });
    }, [projects]);

    const openModal = useCallback((type, mode, project = null, task = null) => {
        setModalType(type);
        setModalMode(mode);
        setCurrentProject(project);
        setCurrentTask(task);
        setModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setModalOpen(false);
        setCurrentProject(null);
        setCurrentTask(null);
        refreshProjects();
        refreshUserTasks();
    }, [refreshProjects, refreshUserTasks]);

    const handleLogout = useCallback(async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout failed', error);
        } finally {
            setUser(null);
            navigate('/login');
        }
    }, [navigate, setUser]);

    return (
        <div className="min-h-screen bg-slate-50">
            <Header
                onLogout={handleLogout}
                onCreateProject={() => openModal('project', 'create')}
                onCreateTask={() => openModal('task', 'create')}
            />

            {/* Hero Section */}
            <div className="relative overflow-hidden bg-white border-b border-slate-200">
                <div className="absolute inset-0 z-0 opacity-40">
                    <div className="aurora-bg transform scale-110">
                        <div className="aurora-blob aurora-blob-1" />
                        <div className="aurora-blob aurora-blob-2" />
                        <div className="aurora-blob aurora-blob-3" />
                    </div>
                </div>

                <div className="relative z-10 px-8 lg:px-12 py-10 lg:py-12">
                    <div className="max-w-[1400px] mx-auto">
                        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Dashboard</p>
                                <h1 className="text-3xl lg:text-4xl font-semibold text-slate-900 mb-2">
                                    Welcome back, {user?.firstname || 'User'}
                                </h1>
                                <p className="text-slate-600 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {formatLongDate(new Date())}
                                </p>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => navigate('/projects?critical=true')}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors border border-slate-200 hover:border-slate-300"
                                >
                                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Critical
                                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">{stats.criticalTasks}</span>
                                </button>
                                <button
                                    onClick={() => navigate('/projects?delayed=true')}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors border border-slate-200 hover:border-slate-300"
                                >
                                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Delayed
                                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">{stats.delayedTasks}</span>
                                </button>
                                <button
                                    onClick={() => navigate('/projects?upcomingDeadline=true')}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors border border-slate-200 hover:border-slate-300"
                                >
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                    Upcoming
                                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">{stats.closeDeadlines.length}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-8 lg:px-12 py-8">
                <div className="max-w-[1400px] mx-auto space-y-10">
                    {/* Projects Grid */}
                    <section>
                        <SectionHeader
                            title="Projects"
                            subtitle="Active project portfolio"
                        />

                        {processedProjects.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                                {processedProjects.map(project => {
                                    const completion = stats.projectCompletion.find(p => p.projectKey === project.projectKey)?.completionPercentage || 0;

                                    return (
                                        <div
                                            key={project.projectKey}
                                            onClick={() => openModal('project', 'edit', project)}
                                            className="group cursor-pointer bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all duration-200 overflow-hidden"
                                        >
                                            {/* Header */}
                                            <div className="p-5 pb-4 border-b border-slate-100">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-xs font-medium text-slate-600 mb-2 block">{project.projectKey}</span>
                                                        <h4 className="text-base font-semibold text-slate-900 line-clamp-2">
                                                            {project.summary}
                                                        </h4>
                                                    </div>
                                                </div>

                                                {/* Progress */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-xs text-slate-500">Progress</span>
                                                        <span className="text-xs font-semibold text-slate-900">{completion}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-slate-900 rounded-full transition-all duration-500"
                                                            style={{ width: `${completion}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Body */}
                                            <div className="p-5 space-y-3">
                                                {/* Dates */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <p className="text-xs text-slate-500 mb-1">Start</p>
                                                        <p className="text-sm font-medium text-slate-900">{project.projectStartDate ? formatShortDate(project.projectStartDate) : '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500 mb-1">Due</p>
                                                        <p className="text-sm font-medium text-slate-900">{project.projectDueDate ? formatShortDate(project.projectDueDate) : '—'}</p>
                                                    </div>
                                                </div>

                                                {/* Team & Action */}
                                                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                                    <div className="flex -space-x-2">
                                                        {project.members?.slice(0, 4).map(member => (
                                                            member.profilePicture ? (
                                                                <img
                                                                    key={member.id}
                                                                    src={getImageUrl(member.profilePicture)}
                                                                    alt={member.firstname}
                                                                    className="w-7 h-7 rounded-full border-2 border-white object-cover"
                                                                />
                                                            ) : (
                                                                <div
                                                                    key={member.id}
                                                                    className={`w-7 h-7 bg-gradient-to-br ${getAvatarColor(member.firstname)} rounded-full flex items-center justify-center border-2 border-white`}
                                                                >
                                                                    <span className="text-xs font-medium text-white">{member.firstname?.[0] || 'U'}</span>
                                                                </div>
                                                            )
                                                        ))}
                                                        {project.members?.length > 4 && (
                                                            <span className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium text-slate-700 border-2 border-white">
                                                                +{project.members.length - 4}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/projects?projectKey=${project.projectKey}`); }}
                                                        className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors"
                                                    >
                                                        View
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
                                <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <h3 className="text-base font-semibold text-slate-900 mb-1">No projects yet</h3>
                                <p className="text-slate-500 mb-4">Create your first project to get started</p>
                                <button
                                    onClick={() => openModal('project', 'create')}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Create Project
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Analytics Charts */}
                    <section>
                        <SectionHeader title="Analytics" subtitle="Project and task insights" />
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                            {/* Project Progress */}
                            <ChartCard title="Project Progress" subtitle="Completion by project">
                                <div className="h-56">
                                    {stats.projectCompletion?.length > 0 ? (
                                        <Bar
                                            data={{
                                                labels: stats.projectCompletion.map(p => p.projectKey),
                                                datasets: [{
                                                    data: stats.projectCompletion.map(p => p.completionPercentage),
                                                    backgroundColor: 'rgba(71, 85, 105, 0.8)',
                                                    hoverBackgroundColor: 'rgba(51, 65, 85, 1)',
                                                    borderRadius: 6,
                                                    borderSkipped: false,
                                                }],
                                            }}
                                            options={{
                                                ...chartOptions,
                                                indexAxis: 'y',
                                                scales: {
                                                    ...chartOptions.scales,
                                                    x: {
                                                        ...chartOptions.scales.x,
                                                        beginAtZero: true,
                                                        max: 100,
                                                        grid: { display: true, color: 'rgba(148, 163, 184, 0.1)' }
                                                    }
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            <p className="text-xs">No data</p>
                                        </div>
                                    )}
                                </div>
                            </ChartCard>

                            {/* Task Status */}
                            <ChartCard title="Task Status" subtitle="Status distribution">
                                <div className="h-56">
                                    {Object.keys(stats.tasksPerStatus).length > 0 ? (
                                        <Pie
                                            data={{
                                                labels: Object.keys(stats.tasksPerStatus),
                                                datasets: [{
                                                    data: Object.values(stats.tasksPerStatus),
                                                    backgroundColor: [
                                                        'rgba(16, 185, 129, 0.8)',
                                                        'rgba(245, 158, 11, 0.8)',
                                                        'rgba(239, 68, 68, 0.8)',
                                                        'rgba(59, 130, 246, 0.8)',
                                                        'rgba(139, 92, 246, 0.8)'
                                                    ],
                                                    borderWidth: 2,
                                                    borderColor: '#fff',
                                                    hoverOffset: 8,
                                                }],
                                            }}
                                            options={{
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: {
                                                        position: 'bottom',
                                                        labels: {
                                                            padding: 16,
                                                            usePointStyle: true,
                                                            pointStyle: 'circle',
                                                            font: { size: 11, family: 'system-ui' },
                                                            color: '#475569'
                                                        }
                                                    }
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                                            </svg>
                                            <p className="text-xs">No data</p>
                                        </div>
                                    )}
                                </div>
                            </ChartCard>

                            {/* Upcoming Deadlines */}
                            <ChartCard title="Upcoming Deadlines" subtitle="Next 7 days" className="lg:col-span-2">
                                <div className="h-56 overflow-y-auto pr-2 space-y-2">
                                    {stats.closeDeadlines?.length > 0 ? (
                                        <>
                                            {stats.closeDeadlines.map(task => (
                                                <a
                                                    key={task.id}
                                                    href={`/projects?selectedIssue=${task.taskKey}`}
                                                    className="block p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs font-medium text-slate-900">{task.taskKey}</span>
                                                                {task.isCritical && (
                                                                    <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Critical</span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-slate-600 line-clamp-1">{task.summary}</p>
                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                <span className="text-xs text-slate-500">{task.progress}%</span>
                                                                <div className="h-1 flex-1 bg-slate-200 rounded-full overflow-hidden max-w-[100px]">
                                                                    <div className="h-full bg-slate-600 rounded-full" style={{ width: `${task.progress}%` }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs text-slate-500 whitespace-nowrap">{formatShortDate(task.dueDate)}</span>
                                                    </div>
                                                </a>
                                            ))}
                                        </>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="text-xs">No upcoming deadlines</p>
                                        </div>
                                    )}

                                    {stats.tasksDelayedByDependencyList?.length > 0 && (
                                        <>
                                            <div className="flex items-center gap-3 my-4">
                                                <div className="flex-1 h-px bg-slate-200" />
                                                <span className="text-xs text-slate-500 uppercase">Blocked</span>
                                                <div className="flex-1 h-px bg-slate-200" />
                                            </div>
                                            {stats.tasksDelayedByDependencyList.map(task => (
                                                <a
                                                    key={task.id}
                                                    href={`/projects?selectedIssue=${task.taskKey}`}
                                                    className="block p-3 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xs font-medium text-slate-900">{task.taskKey}</span>
                                                            </div>
                                                            <p className="text-sm text-slate-600 line-clamp-1">{task.summary}</p>
                                                        </div>
                                                        <span className="text-xs text-slate-500 whitespace-nowrap">{formatShortDate(task.dueDate)}</span>
                                                    </div>
                                                </a>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </ChartCard>
                        </div>
                    </section>


                </div>
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
    );
};

export default Dashboard;