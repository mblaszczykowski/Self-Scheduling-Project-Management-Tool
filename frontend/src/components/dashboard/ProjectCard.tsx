import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatShortDate, isOverdue, isUpcomingDeadline } from '../../util/helpers';
import Avatar from '../common/Avatar';
import { Project } from '../../types';

interface ProjectCardProps {
    project: Project;
    completionPercentage: number;
    animationDelay?: number;
    onEditProject: (project: Project) => void;
}

const ProjectCard = ({
    project,
    completionPercentage,
    animationDelay = 0,
    onEditProject
}: ProjectCardProps) => {
    const navigate = useNavigate();

    const health = useMemo(() => {
        if (!project.tasks?.length) return { label: 'No tasks', color: 'text-slate-400 dark:text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' };
        const tasks = project.tasks;
        const overdueTasks = tasks.filter(t => isOverdue(t.dueDate, t.progress));
        const atRiskTasks = tasks.filter(t => isUpcomingDeadline(t.dueDate) && t.progress < 80);
        if (overdueTasks.length > 0) return { label: `${overdueTasks.length} overdue`, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950' };
        if (atRiskTasks.length > 0) return { label: `${atRiskTasks.length} at risk`, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950' };
        if (completionPercentage === 100) return { label: 'Complete', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950' };
        return { label: 'On track', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950' };
    }, [project.tasks, completionPercentage]);

    const taskSummary = useMemo(() => {
        if (!project.tasks?.length) return null;
        const total = project.tasks.length;
        const done = project.tasks.filter(t => t.status === 'DONE' || t.status === 'RELEASED').length;
        const inProgress = project.tasks.filter(t => t.status === 'IN_PROGRESS').length;
        return { total, done, inProgress };
    }, [project.tasks]);

    const nextDeadline = useMemo(() => {
        if (!project.tasks?.length) return null;
        const upcoming = project.tasks
            .filter(t => t.dueDate && new Date(t.dueDate) >= new Date() && t.progress < 100)
            .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime());
        return upcoming[0] || null;
    }, [project.tasks]);

    const progressColor = completionPercentage === 100
        ? 'bg-green-500'
        : completionPercentage >= 60
            ? 'bg-slate-900 dark:bg-white'
            : 'bg-slate-400 dark:bg-slate-500';

    return (
        <div
            onClick={() => onEditProject(project)}
            className="group cursor-pointer bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300 overflow-hidden animate-[fadeInSlide_0.3s_ease-out_both] hover:shadow-md dark:hover:shadow-slate-900/50"
            style={{ animationDelay: `${animationDelay}ms` }}
        >
            <div className="p-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{project.projectKey}</span>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${health.bg} ${health.color}`}>
                                {health.label}
                            </span>
                        </div>
                        <h4 className="text-base font-semibold text-slate-900 dark:text-white line-clamp-2">
                            {project.summary}
                        </h4>
                    </div>
                </div>

                <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Progress</span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">{completionPercentage}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${progressColor} rounded-full transition-all duration-500`}
                            style={{ width: `${completionPercentage}%` }}
                        />
                    </div>
                </div>

                {taskSummary && (
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
                        <span>{taskSummary.total} tasks</span>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            {taskSummary.done} done
                        </span>
                        {taskSummary.inProgress > 0 && (
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {taskSummary.inProgress} active
                            </span>
                        )}
                    </div>
                )}

                {nextDeadline && (
                    <div className={`text-xs px-2.5 py-1.5 rounded-lg mb-3 ${
                        isUpcomingDeadline(nextDeadline.dueDate)
                            ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300'
                    }`}>
                        <span className="font-medium">Next:</span> {nextDeadline.summary?.substring(0, 30)}{nextDeadline.summary?.length > 30 ? '...' : ''} — {formatShortDate(nextDeadline.dueDate)}
                    </div>
                )}
            </div>

            <div className="px-5 pb-5">
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 uppercase tracking-wide">Start</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {project.projectStartDate ? formatShortDate(project.projectStartDate) : '\u2014'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 uppercase tracking-wide">Due</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {project.projectDueDate ? formatShortDate(project.projectDueDate) : '\u2014'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex -space-x-2">
                        {project.members?.slice(0, 4).map(member => (
                            <Avatar key={member.id} user={member} size="md" className="border-2 border-white dark:border-slate-800" />
                        ))}
                        {project.members?.length > 4 && (
                            <span className="w-7 h-7 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center text-xs font-medium text-slate-700 dark:text-slate-200 border-2 border-white dark:border-slate-800">
                                +{project.members.length - 4}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/projects?projectKey=${project.projectKey}`); }}
                        className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors"
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
};

export default React.memo(ProjectCard);
