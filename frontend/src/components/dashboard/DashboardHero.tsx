import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconType } from 'react-icons';
import { formatLongDate } from '../../util/helpers';
import { CalendarIcon, AlertTriangleIcon, ClockIcon, TrendingUpIcon } from '../common/Icons';
import { User } from '../../types';
import '../common/Aurora.css';

const quickActionClass = "inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500";

interface QuickActionButtonProps {
    onClick: () => void;
    icon: IconType;
    iconColor: string;
    label: string;
    count: number;
}

const QuickActionButton = ({ onClick, icon: Icon, iconColor, label, count }: QuickActionButtonProps) => (
    <button onClick={onClick} className={quickActionClass}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {label}
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded text-xs font-semibold tabular-nums">{count}</span>
    </button>
);

interface DashboardHeroProps {
    user: User | null;
    criticalCount: number;
    delayedCount: number;
    upcomingCriticalCount: number;
}

const DashboardHero = ({ user, criticalCount, delayedCount, upcomingCriticalCount }: DashboardHeroProps) => {
    const navigate = useNavigate();
    const todayFormatted = useMemo(() => formatLongDate(new Date()), []);

    return (
        <div className="relative overflow-hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            {/* Dimmer in dark mode: the same blobs that read as a tint on white glare on slate. */}
            <div className="absolute inset-0 z-0 opacity-40 dark:opacity-20">
                <div className="aurora-bg transform scale-110">
                    <div className="aurora-blob aurora-blob-1" />
                    <div className="aurora-blob aurora-blob-2" />
                    <div className="aurora-blob aurora-blob-3" />
                </div>
            </div>

            <div className="relative z-10 px-6 lg:px-10 py-10 lg:py-12">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Dashboard</p>
                            <h1 className="text-3xl lg:text-4xl font-semibold text-slate-900 dark:text-white mb-2">
                                Welcome back, {user?.firstname || 'User'}
                            </h1>
                            <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                {todayFormatted}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <QuickActionButton
                                onClick={() => navigate('/projects?critical=true')}
                                icon={AlertTriangleIcon}
                                iconColor="text-red-500"
                                label="Critical"
                                count={criticalCount}
                            />
                            <QuickActionButton
                                onClick={() => navigate('/projects?delayed=true')}
                                icon={ClockIcon}
                                iconColor="text-amber-500"
                                label="Delayed"
                                count={delayedCount}
                            />
                            <QuickActionButton
                                onClick={() => navigate('/projects?upcomingDeadline=true')}
                                icon={TrendingUpIcon}
                                iconColor="text-blue-500"
                                label="Critical Due"
                                count={upcomingCriticalCount}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardHero;
