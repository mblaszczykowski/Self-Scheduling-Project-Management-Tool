import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatLongDate } from '../../util/helpers';
import '../common/Aurora.css';

/**
 * Hero section with welcome message and quick action buttons
 */
const DashboardHero = ({ user, stats }) => {
    const navigate = useNavigate();

    return (
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
                                Critical Due
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">{stats.upcomingCriticalDeadlines?.length || 0}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardHero;
