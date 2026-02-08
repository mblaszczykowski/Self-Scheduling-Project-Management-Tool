import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import Header from '../layout/Header';
import { DataContext } from '../../context/DataContext';
import TaskProjectModal from '../modals/TaskProjectModal';
import { DashboardSkeleton } from '../common/Skeleton';
import { logout } from '../../util/api';
import { useDashboardStats } from '../../hooks/useDashboardStats';
import { SectionHeader } from './DashboardComponents';
import DashboardHero from './DashboardHero';
import ProjectCard from './ProjectCard';
import AnalyticsSection from './AnalyticsSection';

ChartJS.register(
    TimeScale, CategoryScale, LinearScale, BarElement,
    PointElement, LineElement, Title, Tooltip, Legend, ArcElement
);

const Dashboard = () => {
    const navigate = useNavigate();
    const { user, projects, loading, refreshProjects, refreshUserTasks, setUser } = useContext(DataContext);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState(null);
    const [modalMode, setModalMode] = useState(null);
    const [currentProject, setCurrentProject] = useState(null);
    const [currentTask, setCurrentTask] = useState(null);
    const [cardsVisible, setCardsVisible] = useState([]);

    useEffect(() => {
        if (!user) navigate('/login');
    }, [user, navigate]);

    useEffect(() => {
        setCardsVisible([]);
        const timeouts = projects.map((_, index) =>
            setTimeout(() => {
                setCardsVisible(prev => {
                    if (prev.includes(index)) return prev;
                    return [...prev, index];
                });
            }, index * 50)
        );
        return () => timeouts.forEach(clearTimeout);
    }, [projects]);

    const stats = useDashboardStats(projects);

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

    const getProjectCompletion = (projectKey) => {
        return stats.projectCompletion.find(p => p.projectKey === projectKey)?.completionPercentage || 0;
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Header
                onLogout={handleLogout}
                onCreateProject={() => openModal('project', 'create')}
                onCreateTask={() => openModal('task', 'create')}
            />

            {loading && <DashboardSkeleton />}

            {!loading && (
                <>
                    <DashboardHero user={user} stats={stats} />

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
                                        {processedProjects.map((project, index) => (
                                            <ProjectCard
                                                key={project.projectKey}
                                                project={project}
                                                completionPercentage={getProjectCompletion(project.projectKey)}
                                                isVisible={cardsVisible.includes(index)}
                                                onEditProject={(p) => openModal('project', 'edit', p)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyProjectsState onCreateProject={() => openModal('project', 'create')} />
                                )}
                            </section>

                            <AnalyticsSection stats={stats} />
                        </div>
                    </div>
                </>
            )}

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

const EmptyProjectsState = ({ onCreateProject }) => (
    <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
        <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">No projects yet</h3>
        <p className="text-slate-500 mb-4">Create your first project to get started</p>
        <button
            onClick={onCreateProject}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Project
        </button>
    </div>
);

export default Dashboard;
