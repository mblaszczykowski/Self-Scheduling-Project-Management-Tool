import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatShortDate } from '../../util/helpers';
import Avatar from '../common/Avatar';

const ProjectCard = ({
    project,
    completionPercentage,
    animationDelay = 0,
    onEditProject
}) => {
    const navigate = useNavigate();

    return (
        <div
            onClick={() => onEditProject(project)}
            className="group cursor-pointer bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all duration-300 overflow-hidden animate-[fadeInSlide_0.3s_ease-out_both]"
            style={{ animationDelay: `${animationDelay}ms` }}
        >
            <div className="p-5 pb-4 border-b border-slate-100">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-slate-600 mb-2 block">{project.projectKey}</span>
                        <h4 className="text-base font-semibold text-slate-900 line-clamp-2">
                            {project.summary}
                        </h4>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-slate-500">Progress</span>
                        <span className="text-xs font-semibold text-slate-900">{completionPercentage}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-slate-900 rounded-full transition-all duration-500"
                            style={{ width: `${completionPercentage}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <p className="text-xs text-slate-500 mb-1">Start</p>
                        <p className="text-sm font-medium text-slate-900">
                            {project.projectStartDate ? formatShortDate(project.projectStartDate) : '\u2014'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 mb-1">Due</p>
                        <p className="text-sm font-medium text-slate-900">
                            {project.projectDueDate ? formatShortDate(project.projectDueDate) : '\u2014'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex -space-x-2">
                        {project.members?.slice(0, 4).map(member => (
                            <Avatar key={member.id} user={member} size="md" className="border-2 border-white" />
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
};

export default React.memo(ProjectCard);
