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
import { BoxIcon, PlusIcon } from '../components/common/Icons';
import { SectionHeader } from '../components/dashboard/ChartComponents';
import DashboardHero from '../components/dashboard/DashboardHero';
import ProjectCard from '../components/dashboard/ProjectCard';
import AnalyticsSection from '../components/dashboard/AnalyticsSection';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useModal } from '../hooks/useModal';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { computeProjectDateRange } from '../util/projectUtils';

ChartJS.register(
    TimeScale, CategoryScale, LinearScale, BarElement,
    PointElement, LineElement, Title, Tooltip, Legend, ArcElement
);

const DashboardPage = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const { projects, projectsLoading, refreshProjects } = useContext(ProjectsContext);
    const handleLogout = useLogout();

    const {
        open: modalOpen, type: modalType, mode: modalMode,
        project: currentProject, task: currentTask,
        openModal, closeModal: baseCloseModal,
    } = useModal();

    useEffect(() => {
        if (!user) navigate('/login');
    }, [user, navigate]);

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
        <div className="min-h-screen bg-slate-50">
            <Header
                onLogout={handleLogout}
                onCreateProject={() => openModal('project', 'create')}
                onCreateTask={() => openModal('task', 'create')}
            />

            {projectsLoading && <DashboardSkeleton />}

            {!projectsLoading && (
                <>
                    <ErrorBoundary level="section" resetKey="dashboard-hero">
                        <DashboardHero user={user} stats={stats} />
                    </ErrorBoundary>

                    <div className="px-8 lg:px-12 py-8">
                        <div className="max-w-[1400px] mx-auto space-y-10">
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
                                                animationDelay={index * 50}
                                                onEditProject={(p) => openModal('project', 'edit', p)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyProjectsState onCreateProject={() => openModal('project', 'create')} />
                                )}
                            </section>

                            <ErrorBoundary level="section" resetKey="analytics">
                                <AnalyticsSection stats={stats} />
                            </ErrorBoundary>
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
            <BoxIcon className="w-7 h-7 text-slate-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">No projects yet</h3>
        <p className="text-slate-500 mb-4">Create your first project to get started</p>
        <button
            onClick={onCreateProject}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
            <PlusIcon />
            Create Project
        </button>
    </div>
);

export default DashboardPage;
