import React from 'react';
import { Link } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { SectionHeader, ChartCard, chartOptions } from './ChartComponents';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../util/helpers';
import { formatShortDate, formatAssigneeName } from '../../util/helpers';
import {
    CheckCircleIcon, BlockedIcon,
    TrendingUpIcon, ChartBarIcon, UsersIcon, LightningIcon,
    ClockIcon,
} from '../common/Icons';

const SectionDivider = ({ title }) => (
    <div className="col-span-full pt-6 pb-2 first:pt-0">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
    </div>
);

const AnalyticsSection = ({ stats }) => {
    return (
        <section>
            <SectionHeader title="Analytics" subtitle="Critical path optimization & schedule intelligence" />
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">

                {/* ═══ Overview ═══ */}
                <SectionDivider title="Overview" />
                <StatusDistributionCard stats={stats} />
                <PriorityDistributionCard stats={stats} />
                <ProjectProgressCard stats={stats} />
                <CompletionTrendCard stats={stats} />
                <OptimizationOpportunityCard stats={stats} />

                {/* ═══ Schedule & Health ═══ */}
                <SectionDivider title="Schedule & Health" />
                <ChartCard title="Critical Path Health" subtitle="Overall critical task status">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <div className="text-4xl font-bold text-slate-900 dark:text-white mb-1">
                                {stats.criticalHealthScore}%
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {stats.criticalTasksList.length} critical tasks
                            </div>
                        </div>
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                            stats.criticalHealthScore >= 80 ? 'bg-green-100 dark:bg-green-900/30' :
                            stats.criticalHealthScore >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                            <CheckCircleIcon className={`w-7 h-7 ${
                                stats.criticalHealthScore >= 80 ? 'text-green-600 dark:text-green-400' :
                                stats.criticalHealthScore >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                            }`} />
                        </div>
                    </div>
                    <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">On Track</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">{stats.criticalOnTime}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">At Risk</span>
                            <span className="font-semibold text-yellow-600 dark:text-yellow-400">{stats.criticalAtRisk.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">Delayed</span>
                            <span className="font-semibold text-red-600 dark:text-red-400">{stats.criticalDelayed.length}</span>
                        </div>
                    </div>
                </ChartCard>
                <ScheduleHealthCard stats={stats} />
                <SlackDistributionCard stats={stats} />
                <ProjectVelocityCard stats={stats} />
                <ResourceConflictsCard stats={stats} />
                <UpcomingDeadlinesCard stats={stats} />

                {/* ═══ Dependencies & Team ═══ */}
                <SectionDivider title="Dependencies & Team" />
                <CriticalPathTimelineCard stats={stats} />
                <DependencyChainCard stats={stats} />
                <BlockedTasksCard stats={stats} />
                <CrossProjectDepsCard stats={stats} />
                <TeamWorkloadBarCard stats={stats} />
            </div>
        </section>
    );
};

/* ══════════════════════════════════════════════════════════
   NEW CARDS
   ══════════════════════════════════════════════════════════ */

const ScheduleHealthCard = ({ stats }) => {
    const h = stats.scheduleHealth;
    const scoreColor = h.scheduleHealthScore >= 75 ? 'text-green-600'
        : h.scheduleHealthScore >= 50 ? 'text-amber-600' : 'text-red-600';
    const bgColor = h.scheduleHealthScore >= 75 ? 'bg-green-100'
        : h.scheduleHealthScore >= 50 ? 'bg-amber-100' : 'bg-red-100';
    const iconColor = h.scheduleHealthScore >= 75 ? 'text-green-600'
        : h.scheduleHealthScore >= 50 ? 'text-amber-600' : 'text-red-600';

    return (
        <ChartCard title="Schedule Health" subtitle="Progress vs time elapsed">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className={`text-4xl font-bold ${scoreColor} mb-1`}>
                        {h.scheduleHealthScore}%
                    </div>
                    <div className="text-xs text-slate-500">
                        {h.totalActive} active tasks tracked
                    </div>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${bgColor}`}>
                    <ClockIcon className={`w-7 h-7 ${iconColor}`} />
                </div>
            </div>
            <div className="space-y-1.5 pt-4 border-t border-slate-100">
                <HealthRow label="On track" value={h.onTrack} color="text-green-600" />
                <HealthRow label="Slightly behind (<15%)" value={h.slightlyBehind} color="text-amber-500" />
                <HealthRow label="Behind (15-30%)" value={h.behind} color="text-orange-600" />
                <HealthRow label="Critically behind (>30%)" value={h.criticallyBehind} color="text-red-600" />
                <HealthRow label="Not yet started" value={h.notStarted} color="text-slate-400" />
            </div>
            {h.worstBehind.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">Most behind</p>
                    {h.worstBehind.slice(0, 3).map(task => (
                        <Link key={task.taskKey} to={`/projects?selectedIssue=${task.taskKey}`}
                            className="block text-xs text-slate-600 hover:text-slate-900 truncate transition-colors mb-0.5">
                            <span className="font-mono font-medium">{task.taskKey}</span>
                            <span className="text-red-500 ml-1">{task.gap}% behind</span>
                            <span className="text-slate-400 ml-1">({task.progress}% vs {task.expected}% expected)</span>
                        </Link>
                    ))}
                </div>
            )}
        </ChartCard>
    );
};

const HealthRow = ({ label, value, color }) => (
    <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className={`font-semibold ${color}`}>{value}</span>
    </div>
);

const ResourceConflictsCard = ({ stats }) => {
    const rc = stats.resourceConflicts;
    const hasConflicts = rc.totalConflicts > 0;

    return (
        <ChartCard title="Resource Conflicts" subtitle="Overlapping task assignments">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className={`text-4xl font-bold mb-1 ${hasConflicts ? 'text-red-600' : 'text-green-600'}`}>
                        {rc.totalConflicts}
                    </div>
                    <div className="text-xs text-slate-500">
                        {rc.affectedAssignees.length} people over-allocated
                    </div>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${hasConflicts ? 'bg-red-100' : 'bg-green-100'}`}>
                    <UsersIcon className={`w-7 h-7 ${hasConflicts ? 'text-red-600' : 'text-green-600'}`} />
                </div>
            </div>
            {hasConflicts ? (
                <div className="space-y-2 pt-4 border-t border-slate-100">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-600">Involve critical tasks</span>
                        <span className="font-semibold text-red-600">{rc.criticalConflicts}</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                        {rc.conflicts.slice(0, 4).map((c, i) => (
                            <div key={i} className="text-xs flex items-center gap-1.5">
                                <span className="text-slate-500 truncate max-w-[140px]">{formatAssigneeName(c.assignee)}</span>
                                <span className="font-mono text-slate-700">{c.task1}</span>
                                <span className="text-slate-300">/</span>
                                <span className="font-mono text-slate-700">{c.task2}</span>
                                <span className="text-red-500 ml-auto shrink-0">{c.overlapDays}d overlap</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                        Run the optimizer to resolve scheduling conflicts
                    </p>
                </div>
            ) : (
                <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs text-green-600 font-medium">No resource conflicts detected</p>
                    <p className="text-[10px] text-slate-400 mt-1">All assignees have non-overlapping schedules</p>
                </div>
            )}
        </ChartCard>
    );
};

const velocityStatusConfig = {
    comfortable: { color: 'bg-green-500', label: 'Comfortable', textColor: 'text-green-600' },
    moderate: { color: 'bg-blue-500', label: 'Moderate', textColor: 'text-blue-600' },
    tight: { color: 'bg-amber-500', label: 'Tight', textColor: 'text-amber-600' },
    critical: { color: 'bg-red-500', label: 'Critical', textColor: 'text-red-600' },
};

const ProjectVelocityCard = ({ stats }) => (
    <ChartCard title="Required Velocity" subtitle="Daily progress needed to meet deadlines">
        <div className="space-y-3">
            {stats.projectVelocity.length > 0 ? (
                stats.projectVelocity.slice(0, 6).map(pv => {
                    const cfg = velocityStatusConfig[pv.status];
                    return (
                        <div key={pv.projectKey} className="space-y-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-900">{pv.projectKey}</span>
                                    <span className={`text-[10px] font-medium ${cfg.textColor} px-1.5 py-0.5 rounded-full bg-opacity-10 ${cfg.color.replace('bg-', 'bg-')}/10`}>
                                        {cfg.label}
                                    </span>
                                </div>
                                <span className={`text-sm font-bold ${cfg.textColor}`}>
                                    {pv.avgVelocityNeeded > 100 ? '99+' : pv.avgVelocityNeeded}%/day
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>{pv.activeTasks} active</span>
                                {pv.urgentCount > 0 && (
                                    <span className="text-amber-600">{pv.urgentCount} need >15%/day</span>
                                )}
                            </div>
                        </div>
                    );
                })
            ) : (
                <EmptyState icon="trend" message="No active tasks with schedules" />
            )}
        </div>
    </ChartCard>
);

const DependencyChainCard = ({ stats }) => {
    const da = stats.dependencyAnalysis;
    return (
        <ChartCard title="Dependency Analysis" subtitle="Chain depth & bottleneck tasks">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="text-4xl font-bold text-slate-900 mb-1">
                        {da.longestChainLength}
                    </div>
                    <div className="text-xs text-slate-500">
                        Longest dependency chain
                    </div>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                    da.longestChainLength > 3 ? 'bg-amber-100' : 'bg-slate-100'
                }`}>
                    <LightningIcon className={`w-7 h-7 ${
                        da.longestChainLength > 3 ? 'text-amber-600' : 'text-slate-400'
                    }`} />
                </div>
            </div>
            {da.bottlenecks.length > 0 ? (
                <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Bottleneck tasks (most dependents)
                    </p>
                    <div className="space-y-2">
                        {da.bottlenecks.map(b => (
                            <Link key={b.taskKey} to={`/projects?selectedIssue=${b.taskKey}`}
                                className="flex items-center justify-between text-xs hover:bg-slate-50 -mx-1 px-1 rounded transition-colors">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono font-medium text-slate-800">{b.taskKey}</span>
                                    {b.isCritical && (
                                        <span className="text-[9px] text-red-600 bg-red-50 px-1 py-px rounded font-medium">C</span>
                                    )}
                                    <span className="text-slate-400 truncate">{b.task?.summary}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className="text-slate-500">{b.progress}%</span>
                                    <span className="font-semibold text-slate-700">{b.dependentCount} downstream</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                    {da.longestChainLength > 3 && (
                        <p className="text-[10px] text-amber-600 mt-2">
                            Deep chains amplify delays. Consider parallelizing work.
                        </p>
                    )}
                </div>
            ) : (
                <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500">No active bottleneck tasks</p>
                </div>
            )}
        </ChartCard>
    );
};

/* ── Status distribution color map (hex values matching STATUS_CONFIG dot colors) ── */
const STATUS_CHART_COLORS = {
    BACKLOG: '#94a3b8',
    TODO: '#3b82f6',
    IN_PROGRESS: '#f59e0b',
    IN_TEST: '#0ea5e9',
    TO_TEST: '#3b82f6',
    TO_REVIEW: '#06b6d4',
    READY_TO_MERGE: '#14b8a6',
    READY_TO_DEPLOY: '#10b981',
    DONE: '#22c55e',
    RELEASED: '#16a34a',
    WITHDRAWN: '#ef4444',
    GATHERING_INTEREST: '#f97316',
};

const PRIORITY_CHART_COLORS = {
    LOWEST: '#94a3b8',
    LOW: '#3b82f6',
    MEDIUM: '#f59e0b',
    HIGH: '#f97316',
    HIGHEST: '#ef4444',
};

const doughnutOptions = {
    plugins: {
        legend: { display: false },
        tooltip: {
            ...chartOptions.plugins.tooltip,
            displayColors: true,
        },
    },
    maintainAspectRatio: false,
    cutout: '65%',
};

const StatusDistributionCard = ({ stats }) => {
    const distribution = stats.statusDistribution || {};
    const statuses = Object.keys(distribution).filter(s => distribution[s] > 0);

    if (statuses.length === 0) {
        return (
            <ChartCard title="Status Distribution" subtitle="Tasks by current status">
                <EmptyState icon="chart" message="No tasks to display" />
            </ChartCard>
        );
    }

    const data = {
        labels: statuses.map(s => STATUS_CONFIG[s]?.label || s),
        datasets: [{
            data: statuses.map(s => distribution[s]),
            backgroundColor: statuses.map(s => STATUS_CHART_COLORS[s] || '#94a3b8'),
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 4,
        }],
    };

    return (
        <ChartCard title="Status Distribution" subtitle="Tasks by current status">
            <div className="h-48 flex items-center justify-center">
                <Doughnut data={data} options={doughnutOptions} />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-1">
                {statuses.map(s => (
                    <div key={s} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_CHART_COLORS[s] }} />
                        <span className="text-slate-600 truncate">{STATUS_CONFIG[s]?.label || s}</span>
                        <span className="font-semibold text-slate-800 ml-auto">{distribution[s]}</span>
                    </div>
                ))}
            </div>
        </ChartCard>
    );
};

const TeamWorkloadBarCard = ({ stats }) => {
    const assignees = stats.assigneeLoad || [];

    if (assignees.length === 0) {
        return (
            <ChartCard title="Team Workload" subtitle="Tasks per assignee (critical vs normal)">
                <EmptyState icon="users" message="No assigned active tasks" />
            </ChartCard>
        );
    }

    const labels = assignees.map(a => formatAssigneeName(a.assignee));
    const criticalData = assignees.map(a => a.critical);
    const normalData = assignees.map(a => a.total - a.critical);

    const data = {
        labels,
        datasets: [
            {
                label: 'Critical',
                data: criticalData,
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                hoverBackgroundColor: 'rgba(220, 38, 38, 1)',
                borderRadius: 4,
                borderSkipped: false,
            },
            {
                label: 'Normal',
                data: normalData,
                backgroundColor: 'rgba(71, 85, 105, 0.7)',
                hoverBackgroundColor: 'rgba(51, 65, 85, 1)',
                borderRadius: 4,
                borderSkipped: false,
            },
        ],
    };

    const options = {
        ...chartOptions,
        indexAxis: 'y',
        plugins: {
            ...chartOptions.plugins,
            legend: {
                display: true,
                position: 'top',
                labels: {
                    boxWidth: 10,
                    boxHeight: 10,
                    borderRadius: 2,
                    useBorderRadius: true,
                    font: { size: 10, family: 'system-ui' },
                    color: '#64748b',
                    padding: 12,
                },
            },
        },
        scales: {
            ...chartOptions.scales,
            x: {
                ...chartOptions.scales.x,
                stacked: true,
                beginAtZero: true,
                grid: { display: true, color: 'rgba(148, 163, 184, 0.1)' },
                ticks: { ...chartOptions.scales.x.ticks, stepSize: 1 },
            },
            y: {
                ...chartOptions.scales.y,
                stacked: true,
            },
        },
    };

    return (
        <ChartCard title="Team Workload" subtitle="Tasks per assignee (critical vs normal)">
            <div className="h-56">
                <Bar data={data} options={options} />
            </div>
        </ChartCard>
    );
};

const PriorityDistributionCard = ({ stats }) => {
    const distribution = stats.priorityDistribution || {};
    const priorities = ['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST'].filter(p => distribution[p] > 0);

    if (priorities.length === 0) {
        return (
            <ChartCard title="Priority Distribution" subtitle="Tasks by priority level">
                <EmptyState icon="chart" message="No tasks to display" />
            </ChartCard>
        );
    }

    const data = {
        labels: priorities.map(p => PRIORITY_CONFIG[p]?.label || p),
        datasets: [{
            data: priorities.map(p => distribution[p]),
            backgroundColor: priorities.map(p => PRIORITY_CHART_COLORS[p] || '#94a3b8'),
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 4,
        }],
    };

    return (
        <ChartCard title="Priority Distribution" subtitle="Tasks by priority level">
            <div className="h-48 flex items-center justify-center">
                <Doughnut data={data} options={doughnutOptions} />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 justify-center">
                {priorities.map(p => (
                    <div key={p} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_CHART_COLORS[p] }} />
                        <span className="text-slate-600">{PRIORITY_CONFIG[p]?.label || p}</span>
                        <span className="font-semibold text-slate-800">{distribution[p]}</span>
                    </div>
                ))}
            </div>
        </ChartCard>
    );
};

const CompletionTrendCard = ({ stats }) => {
    const trend = stats.completionTrend || [];
    const hasData = trend.some(w => w.count > 0);

    if (!hasData) {
        return (
            <ChartCard title="Completion Trend" subtitle="Weekly completed tasks (8 weeks)">
                <EmptyState icon="trend" message="No completions in the past 8 weeks" />
            </ChartCard>
        );
    }

    const data = {
        labels: trend.map(w => w.label),
        datasets: [{
            label: 'Completed',
            data: trend.map(w => w.count),
            borderColor: 'rgba(71, 85, 105, 0.9)',
            backgroundColor: 'rgba(71, 85, 105, 0.1)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#475569',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
        }],
    };

    const options = {
        ...chartOptions,
        plugins: {
            ...chartOptions.plugins,
            legend: { display: false },
        },
        scales: {
            ...chartOptions.scales,
            y: {
                ...chartOptions.scales.y,
                beginAtZero: true,
                ticks: { ...chartOptions.scales.y.ticks, stepSize: 1 },
            },
        },
    };

    return (
        <ChartCard title="Completion Trend" subtitle="Weekly completed tasks (8 weeks)">
            <div className="h-56">
                <Line data={data} options={options} />
            </div>
        </ChartCard>
    );
};

/* ══════════════════════════════════════════════════════════
   EXISTING CARDS (preserved)
   ══════════════════════════════════════════════════════════ */

const CriticalPathTimelineCard = ({ stats }) => (
    <ChartCard title="Critical Path Duration" subtitle="Timeline by project">
        <div className="space-y-3">
            {stats.criticalPathTimeline.length > 0 ? (
                stats.criticalPathTimeline.slice(0, 5).map(project => (
                    <div key={project.projectKey} className="space-y-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">
                                    {project.projectKey}
                                </span>
                                {project.status === 'delayed' && (
                                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                )}
                            </div>
                            <span className="text-sm font-bold text-slate-900">
                                {project.criticalPathDays}d
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{project.criticalTaskCount} critical tasks</span>
                            {project.delayedCritical > 0 && (
                                <span className="text-red-600 font-medium">
                                    {project.delayedCritical} delayed
                                </span>
                            )}
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${
                                    project.status === 'delayed' ? 'bg-red-500' : 'bg-slate-600'
                                }`}
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>
                ))
            ) : (
                <EmptyState icon="trend" message="No critical paths" />
            )}
        </div>
    </ChartCard>
);

const ProjectProgressCard = ({ stats }) => (
    <ChartCard title="Project Progress" subtitle="Overall completion">
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
                <EmptyState icon="chart" message="No data" fullHeight />
            )}
        </div>
    </ChartCard>
);

const BlockedTasksCard = ({ stats }) => {
    const hasBlocked = stats.blockedTasks.length > 0;
    const blockedIconWrapCls = 'w-14 h-14 rounded-xl'
        + ' flex items-center justify-center shrink-0 '
        + (hasBlocked ? 'bg-red-100' : 'bg-slate-100');
    const blockedIconCls = 'w-7 h-7 '
        + (hasBlocked ? 'text-red-600' : 'text-slate-400');

    return (
    <ChartCard title="Blocked Tasks" subtitle="Waiting on dependencies">
        <div className="flex items-start justify-between mb-4">
            <div>
                <div className="text-4xl font-bold text-slate-900 mb-1">
                    {stats.blockedTasks.length}
                </div>
                <div className="text-xs text-slate-500">
                    {stats.blockedCriticalTasks.length} are critical
                </div>
            </div>
            <div className={blockedIconWrapCls}>
                <BlockedIcon className={blockedIconCls} />
            </div>
        </div>
        {stats.blockedTasks.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
                <div className="space-y-2">
                    {stats.blockedTasks.slice(0, 4).map(task => (
                        <Link key={task.id} to={`/projects?selectedIssue=${task.taskKey}`} className="block">
                            <div className="flex items-center gap-2">
                                <div className="text-xs text-slate-900 font-medium truncate">
                                    {task.taskKey}
                                </div>
                                {task.isCritical && (
                                    <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Critical</span>
                                )}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                                {task.summary}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        )}
    </ChartCard>
    );
};

const CrossProjectDepsCard = ({ stats }) => (
    <ChartCard title="Cross-Project Dependencies" subtitle="Inter-project links">
        <div className="space-y-3">
            {stats.crossProjectDeps.length > 0 ? (
                stats.crossProjectDeps.map(project => (
                    <div key={project.projectKey} className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900">
                            {project.projectKey}
                        </div>
                        <div className="text-xs text-slate-500">
                            Depends on {project.dependencyCount} project{project.dependencyCount > 1 ? 's' : ''}
                        </div>
                        <div className="pl-3 border-l-2 border-slate-200">
                            {project.dependsOn.slice(0, 2).map((dep, idx) => (
                                <div key={idx} className="text-xs text-slate-600 truncate">
                                    {'\u2192'} {dep.key}
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            ) : (
                <EmptyState icon="lightning" message="No cross-project dependencies" />
            )}
        </div>
    </ChartCard>
);

const UpcomingDeadlinesCard = ({ stats }) => (
    <ChartCard title="Upcoming Critical Deadlines" subtitle="Next 7 days" className="xl:col-span-2">
        <div className="h-56 overflow-y-auto pr-2 space-y-2">
            {stats.upcomingCriticalDeadlines?.length > 0 ? (
                stats.upcomingCriticalDeadlines.map(task => (
                    <Link
                        key={task.id}
                        to={`/projects?selectedIssue=${task.taskKey}`}
                        className="block p-3 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-slate-900">{task.taskKey}</span>
                                    <span className="text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded font-semibold">
                                        Critical
                                    </span>
                                </div>
                                <p className="text-sm text-slate-700 line-clamp-1 font-medium">{task.summary}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-xs text-slate-600">{task.progress}%</span>
                                    <div className="h-1.5 flex-1 bg-slate-200 rounded-full overflow-hidden max-w-[100px]">
                                        <div className="h-full bg-red-600 rounded-full" style={{ width: `${task.progress}%` }} />
                                    </div>
                                </div>
                            </div>
                            <span className="text-xs text-slate-600 whitespace-nowrap font-medium">
                                {formatShortDate(task.dueDate)}
                            </span>
                        </div>
                    </Link>
                ))
            ) : (
                <EmptyState icon="check" message="No upcoming critical deadlines" fullHeight />
            )}
        </div>
    </ChartCard>
);

/* ── Shared Empty State ── */

const iconMap = {
    trend: TrendingUpIcon,
    chart: ChartBarIcon,
    check: CheckCircleIcon,
    users: UsersIcon,
    lightning: LightningIcon,
};

const EmptyState = ({ icon, message, fullHeight = false }) => {
    const IconComponent = iconMap[icon];

    return (
        <div className={`${fullHeight ? 'h-full min-h-[180px]' : 'py-8'} flex flex-col items-center justify-center text-slate-400`}>
            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                <IconComponent className="w-7 h-7" />
            </div>
            <p className="text-xs text-slate-500">{message}</p>
        </div>
    );
};

/* ── Slack Distribution ── */

const SlackDistributionCard = ({ stats }) => {
    const sd = stats.slackDistribution;
    if (!sd || sd.totalScheduled === 0) {
        return (
            <ChartCard title="Slack Distribution" subtitle="Schedule flexibility per task">
                <EmptyState icon="chart" message="No scheduled tasks" />
            </ChartCard>
        );
    }

    const maxCount = Math.max(...sd.buckets.map(b => b.count), 1);
    const fragilePercent = sd.totalScheduled > 0 ? Math.round((sd.zeroSlackCount / sd.totalScheduled) * 100) : 0;
    const fragilityColor = fragilePercent >= 50 ? 'text-red-600 dark:text-red-400'
        : fragilePercent >= 25 ? 'text-amber-600 dark:text-amber-400'
        : 'text-green-600 dark:text-green-400';

    return (
        <ChartCard title="Slack Distribution" subtitle="Schedule flexibility per task">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{sd.avgSlack}d</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">avg slack</div>
                </div>
                <div className="text-right">
                    <div className={`text-2xl font-bold ${fragilityColor}`}>{fragilePercent}%</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">zero slack</div>
                </div>
            </div>
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                {sd.buckets.map(bucket => (
                    <div key={bucket.label} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400 w-16 shrink-0">{bucket.label}</span>
                        <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700/50 rounded overflow-hidden">
                            <div
                                className="h-full rounded transition-all duration-500"
                                style={{
                                    width: `${Math.max((bucket.count / maxCount) * 100, bucket.count > 0 ? 8 : 0)}%`,
                                    backgroundColor: bucket.color,
                                    opacity: 0.85,
                                }}
                            />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-6 text-right tabular-nums">
                            {bucket.count}
                        </span>
                    </div>
                ))}
            </div>
            {fragilePercent >= 40 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                    High fragility — {sd.zeroSlackCount} of {sd.totalScheduled} tasks have no scheduling flexibility
                </p>
            )}
        </ChartCard>
    );
};

/* ── Optimization Opportunity ── */

const IMPACT_COLORS = {
    high: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
    medium: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    low: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
};

const OptimizationOpportunityCard = ({ stats }) => {
    const oo = stats.optimizationOpportunity;
    if (!oo) return null;

    const ringColor = oo.score >= 70 ? '#ef4444' : oo.score >= 40 ? '#f59e0b' : oo.score >= 15 ? '#3b82f6' : '#22c55e';
    const bgColor = oo.score >= 70 ? 'bg-red-100 dark:bg-red-900/30' : oo.score >= 40 ? 'bg-amber-100 dark:bg-amber-900/30' : oo.score >= 15 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30';
    const textColor = oo.score >= 70 ? 'text-red-600 dark:text-red-400' : oo.score >= 40 ? 'text-amber-600 dark:text-amber-400' : oo.score >= 15 ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400';

    const size = 56;
    const stroke = 5;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (oo.score / 100) * c;

    return (
        <ChartCard title="Optimization Opportunity" subtitle="How much can the optimizer help">
            <div className="flex items-start gap-4 mb-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${bgColor}`}>
                    <svg width={size} height={size} className="-rotate-90">
                        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke}
                            className="text-slate-200 dark:text-slate-700" stroke="currentColor" />
                        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke}
                            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
                            stroke={ringColor} className="transition-all duration-700" />
                        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
                            className={`fill-current text-[11px] font-bold rotate-90 origin-center ${textColor}`}>
                            {oo.score}
                        </text>
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${textColor} mb-0.5`}>
                        {oo.score >= 70 ? 'High opportunity' : oo.score >= 40 ? 'Moderate opportunity' : oo.score >= 15 ? 'Low opportunity' : 'Schedule is healthy'}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{oo.recommendation}</p>
                </div>
            </div>
            {oo.factors.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-700">
                    {oo.factors.map((f, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <span className="text-xs text-slate-600 dark:text-slate-400">{f.label}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{f.value}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${IMPACT_COLORS[f.impact]}`}>
                                    {f.impact}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </ChartCard>
    );
};

export default AnalyticsSection;
