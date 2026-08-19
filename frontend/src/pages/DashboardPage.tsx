import React, { Suspense, useCallback, useMemo } from 'react';
import { useLogout } from '../hooks/useLogout';
import {
    ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend,
    LinearScale, LineElement, PointElement, TimeScale, Title, Tooltip,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectsContext';
import Header from '../components/layout/Header';
import { DashboardSkeleton } from '../components/common/Skeleton';
import { BoxIcon, AlertTriangleIcon } from '../components/common/Icons';
import EmptyState from '../components/common/EmptyState';
import { SectionHeader } from '../components/dashboard/ChartComponents';
import DashboardHero from '../components/dashboard/DashboardHero';
import ProjectCard from '../components/dashboard/ProjectCard';
import AnalyticsSection from '../components/dashboard/AnalyticsSection';
import { useEnrichedProjects } from '../hooks/useEnrichedProjects';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useModal } from '../hooks/useModal';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { ProcessedProject } from '../types';

const TaskProjectModal = React.lazy(() => import('../components/modals/TaskProjectModal'));

ChartJS.register(
    TimeScale, CategoryScale, LinearScale, BarElement,
    PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler
);

const DashboardPage = () => {
    const { user } = useAuth();
    const { projects, projectsLoading, projectsError, retryProjects } = useProjects();
    const handleLogout = useLogout();

    const {
        open: modalOpen, type: modalType, mode: modalMode,
        project: currentProject, task: currentTask,
        openModal, closeModal,
    } = useModal();

    useKeyboardShortcuts(modalOpen ? [] : [
        { key: 'n', handler: () => openModal('task', 'create') },
        { key: 'p', handler: () => openModal('project', 'create') },
    ]);

    const handleEditProject = useCallback(
        (p: ProcessedProject) => openModal('project', 'edit', p), [openModal]);

    const enriched = useEnrichedProjects(projects);
    const stats = useDashboardStats(enriched);
    const { processedProjects } = enriched;

    const completionByProject = useMemo(
        () => new Map(stats.projectCompletion.map(p => [p.projectKey, p.completionPercentage])),
        [stats.projectCompletion]
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <Header
                onLogout={handleLogout}
                onCreateProject={() => openModal('project', 'create')}
                onCreateTask={() => openModal('task', 'create')}
            />

            {projectsLoading && <DashboardSkeleton />}

            {!projectsLoading && projectsError && (
                <EmptyState
                    icon={AlertTriangleIcon}
                    tone="danger"
                    title="Failed to load projects"
                    description={projectsError}
                    action={retryProjects}
                    actionLabel="Try Again"
                />
            )}

            {!projectsLoading && !projectsError && (
                <>
                    <ErrorBoundary level="section" resetKey={stats}>
                        <DashboardHero
                            user={user}
                            criticalCount={stats.criticalTasks}
                            delayedCount={stats.delayedTasks}
                            upcomingCriticalCount={stats.upcomingCriticalDeadlines.length}
                        />
                    </ErrorBoundary>

                    <div className="px-6 lg:px-10 py-8">
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
                                                completionPercentage={completionByProject.get(project.projectKey) ?? 0}
                                                animationDelay={index * 50}
                                                onEditProject={handleEditProject}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState
                                        variant="table"
                                        icon={BoxIcon}
                                        title="No projects yet"
                                        description="Create your first project to get started"
                                        action={() => openModal('project', 'create')}
                                        actionLabel="Create Project"
                                        className="bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700"
                                    />
                                )}
                            </section>

                            {processedProjects.length > 0 && (
                                <ErrorBoundary level="section" resetKey={stats}>
                                    <AnalyticsSection stats={stats} />
                                </ErrorBoundary>
                            )}
                        </div>
                    </div>
                </>
            )}

            {modalOpen && modalType && modalMode && (
                <Suspense fallback={null}>
                    <TaskProjectModal
                        modalType={modalType}
                        modalMode={modalMode}
                        project={currentProject}
                        task={currentTask}
                        onClose={closeModal}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default DashboardPage;
