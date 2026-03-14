import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatLongDate } from '../../util/helpers';
import { CalendarIcon, AlertTriangleIcon, ClockIcon, TrendingUpIcon } from '../common/Icons';
import '../common/Aurora.css';

const quickActionClass = "inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors border border-slate-200 hover:border-slate-300";

const QuickActionButton = ({ onClick, icon: Icon, iconColor, label, count }) => (
    <button onClick={onClick} className={quickActionClass}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {label}
        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">{count}</span>
    </button>
);

const DashboardHero = ({ user, stats }) => {
    const navigate = useNavigate();
    const todayFormatted = useMemo(() => formatLongDate(new Date()), []);

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
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                {todayFormatted}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <QuickActionButton
                                onClick={() => navigate('/projects?critical=true')}
                                icon={AlertTriangleIcon}
                                iconColor="text-red-500"
                                label="Critical"
                                count={stats.criticalTasks}
                            />
                            <QuickActionButton
                                onClick={() => navigate('/projects?delayed=true')}
                                icon={ClockIcon}
                                iconColor="text-amber-500"
                                label="Delayed"
                                count={stats.delayedTasks}
                            />
                            <QuickActionButton
                                onClick={() => navigate('/projects?upcomingDeadline=true')}
                                icon={TrendingUpIcon}
                                iconColor="text-blue-500"
                                label="Critical Due"
                                count={stats.upcomingCriticalDeadlines?.length || 0}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardHero;
