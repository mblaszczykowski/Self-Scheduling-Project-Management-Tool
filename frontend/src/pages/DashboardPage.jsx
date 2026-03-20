import React, { useContext, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogout } from '../hooks/useLogout';
import {
    ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend,
    LinearScale, LineElement, PointElement, TimeScale, Title, Tooltip,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { AuthContext } from '../context/AuthContext';
import { ProjectsContext } from '../context/ProjectsContext';
import Header from '../components/layout/Header';
import TaskProjectModal from '../components/modals/TaskProjectModal';
import { DashboardSkeleton } from '../components/common/Skeleton';
import { BoxIcon, PlusIcon, AlertTriangleIcon } from '../components/common/Icons';
import { SectionHeader } from '../components/dashboard/ChartComponents';
import DashboardHero from '../components/dashboard/DashboardHero';
import ProjectCard from '../components/dashboard/ProjectCard';
import AnalyticsSection from '../components/dashboard/AnalyticsSection';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useModal } from '../hooks/useModal';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { computeProjectDateRange } from '../util/projectUtils';

ChartJS.register(
    TimeScale, CategoryScale, LinearScale, BarElement,
    PointElement, LineElement, Title, Tooltip, Legend, ArcElement
);

const DashboardPage = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const { projects, projectsLoading, projectsError, refreshProjects } = useContext(ProjectsContext);
    const handleLogout = useLogout();

    const {
        open: modalOpen, type: modalType, mode: modalMode,
        project: currentProject, task: currentTask,
        openModal, closeModal: baseCloseModal,
    } = useModal();

    useEffect(() => {
        if (!user) navigate('/login');
    }, [user, navigate]);

    useKeyboardShortcuts([
        { key: 'n', handler: () => openModal('task', 'create') },
        { key: 'p', handler: () => openModal('project', 'create') },
    ]);

    const stats = useDashboardStats(projects);

    const processedProjects = useMemo(() => {
        return projects.map(project => {
            const { projectStartDate, projectDueDate } = computeProjectDateRange(project.tasks);
            return { ...project, projectStartDate, projectDueDate };
        });
    }, [projects]);

    const closeModal = useCallback((didSave = false) => {
        baseCloseModal();
        if (didSave) refreshProjects();
    }, [baseCloseModal, refreshProjects]);

    const getProjectCompletion = (projectKey) => {
        return stats.projectCompletion.find(p => p.projectKey === projectKey)?.completionPercentage || 0;
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <Header
                onLogout={handleLogout}
                onCreateProject={() => openModal('project', 'create')}
                onCreateTask={() => openModal('task', 'create')}
            />

            {projectsLoading && <DashboardSkeleton />}

            {!projectsLoading && projectsError && (
                <div className="px-8 lg:px-12 py-16 text-center">
                    <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <AlertTriangleIcon className="w-7 h-7 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Failed to load projects</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-4">{projectsError}</p>
                    <button
                        onClick={refreshProjects}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {!projectsLoading && !projectsError && (
                <>
                    <ErrorBoundary level="section" resetKey="dashboard-hero">
                        <DashboardHero user={user} stats={stats} />
                    </ErrorBoundary>

                    <div className="px-8 lg:px-12 py-8">
                        <div className="max-w-[1400px] mx-auto space-y-10">
                            <section className="animate-[fadeInSlide_0.4s_ease-out_0.1s_both]">
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
                                                animationDelay={index * 50}
                                                onEditProject={(p) => openModal('project', 'edit', p)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyProjectsState onCreateProject={() => openModal('project', 'create')} />
                                )}
                            </section>

                            {processedProjects.length > 0 && (
                                <ErrorBoundary level="section" resetKey="analytics">
                                    <AnalyticsSection stats={stats} />
                                </ErrorBoundary>
                            )}
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
    <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center mx-auto mb-4">
            <BoxIcon className="w-7 h-7 text-slate-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">No projects yet</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-4">Create your first project to get started</p>
        <button
            onClick={onCreateProject}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
        >
            <PlusIcon />
            Create Project
        </button>
    </div>
);

export default DashboardPage;
