import React from 'react';
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { SectionHeader, ChartCard, chartOptions } from './ChartComponents';
import { formatShortDate } from '../../util/helpers';
import {
    CheckCircleIcon, AlertTriangleIcon, BlockedIcon,
    TrendingUpIcon, ChartBarIcon, UsersIcon, LightningIcon,
    ClockIcon, FlagIcon,
} from '../common/Icons';

const AnalyticsSection = ({ stats }) => {
    return (
        <section>
            <SectionHeader title="Analytics" subtitle="Critical path optimization & schedule intelligence" />
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">

                {/* ── 1. Critical Path Health (existing) ── */}
                <ChartCard title="Critical Path Health" subtitle="Overall critical task status">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <div className="text-4xl font-bold text-slate-900 mb-1">
                                {stats.criticalHealthScore}%
                            </div>
                            <div className="text-xs text-slate-500">
                                {stats.criticalTasksList.length} critical tasks
                            </div>
                        </div>
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                            stats.criticalHealthScore >= 80 ? 'bg-green-100' :
                            stats.criticalHealthScore >= 60 ? 'bg-yellow-100' : 'bg-red-100'
                        }`}>
                            <CheckCircleIcon className={`w-7 h-7 ${
                                stats.criticalHealthScore >= 80 ? 'text-green-600' :
                                stats.criticalHealthScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`} />
                        </div>
                    </div>
                    <div className="space-y-2 pt-4 border-t border-slate-100">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-600">On Track</span>
                            <span className="font-semibold text-green-600">{stats.criticalOnTime}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-600">At Risk</span>
                            <span className="font-semibold text-yellow-600">{stats.criticalAtRisk.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-600">Delayed</span>
                            <span className="font-semibold text-red-600">{stats.criticalDelayed.length}</span>
                        </div>
                    </div>
                </ChartCard>

                {/* ── 2. Schedule Health (NEW) ── */}
                <ScheduleHealthCard stats={stats} />

                {/* ── 3. Resource Conflicts (NEW) ── */}
                <ResourceConflictsCard stats={stats} />

                {/* ── 4. Critical Path Duration (existing) ── */}
                <CriticalPathTimelineCard stats={stats} />

                {/* ── 5. Project Velocity (NEW) ── */}
                <ProjectVelocityCard stats={stats} />

                {/* ── 6. Project Progress (existing) ── */}
                <ProjectProgressCard stats={stats} />

                {/* ── 7. Dependency Chain Analysis (NEW) ── */}
                <DependencyChainCard stats={stats} />

                {/* ── 8. Overdue Critical (existing) ── */}
                <OverdueCriticalCard stats={stats} />

                {/* ── 9. Blocked Tasks (existing) ── */}
                <BlockedTasksCard stats={stats} />

                {/* ── 10. Assignee Load (NEW) ── */}
                <AssigneeLoadCard stats={stats} />

                {/* ── 11. Critical Path Workload (existing) ── */}
                <CriticalWorkloadCard stats={stats} />

                {/* ── 12. Near-Critical (existing) ── */}
                <NearCriticalCard stats={stats} />

                {/* ── 13. Cross-Project Deps (existing) ── */}
                <CrossProjectDepsCard stats={stats} />

                {/* ── 14. Upcoming Deadlines (existing) ── */}
                <UpcomingDeadlinesCard stats={stats} />
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
                                <span className="text-slate-500 truncate max-w-[80px]">{c.assignee.split('@')[0]}</span>
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

const AssigneeLoadCard = ({ stats }) => (
    <ChartCard title="Team Load Distribution" subtitle="Active workload per assignee">
        <div className="space-y-2">
            {stats.assigneeLoad.length > 0 ? (
                stats.assigneeLoad.map(a => {
                    const isOverloaded = a.total > 5 || a.overdue > 1;
                    return (
                        <div key={a.assignee} className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-medium text-slate-700">
                                    {a.assignee.split('@')[0].substring(0, 2).toUpperCase()}
                                </span>
                            </div>
                            <span className="text-xs text-slate-700 truncate min-w-0 flex-1">{a.assignee.split('@')[0]}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isOverloaded ? 'text-red-600 bg-red-50' : 'text-slate-600 bg-slate-100'}`}>
                                    {a.total} tasks
                                </span>
                                {a.critical > 0 && (
                                    <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-medium">
                                        {a.critical}C
                                    </span>
                                )}
                                {a.overdue > 0 && (
                                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                        {a.overdue} late
                                    </span>
                                )}
                                {a.conflicts > 0 && (
                                    <span className="text-[10px] text-red-500 bg-red-50 px-1 py-0.5 rounded">
                                        {a.conflicts} conflicts
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })
            ) : (
                <EmptyState icon="users" message="No assigned active tasks" />
            )}
        </div>
    </ChartCard>
);

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

const OverdueCriticalCard = ({ stats }) => (
    <ChartCard title="Overdue Critical Tasks" subtitle="Delaying critical path">
        <div className="space-y-3">
            {stats.overdueCriticalByProject.length > 0 ? (
                stats.overdueCriticalByProject.slice(0, 5).map(project => (
                    <div key={project.projectKey}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-700 font-medium truncate">
                                {project.projectKey}
                            </span>
                            <span className="text-sm font-semibold text-red-600">
                                {project.overdueCount}
                            </span>
                        </div>
                        {project.overdueTasks.length > 0 && (
                            <Link
                                to={`/projects?selectedIssue=${project.overdueTasks[0].taskKey}`}
                                className="block text-xs text-slate-500 hover:text-slate-900 truncate transition-colors"
                            >
                                {project.overdueTasks[0].taskKey} - {project.overdueTasks[0].summary}
                            </Link>
                        )}
                    </div>
                ))
            ) : (
                <EmptyState icon="check" message="All critical tasks on time" />
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

const CriticalWorkloadCard = ({ stats }) => (
    <ChartCard title="Critical Path Workload" subtitle="Team resources on critical tasks">
        <div className="space-y-3">
            {stats.criticalWorkload.length > 0 ? (
                stats.criticalWorkload.slice(0, 5).map(({ assignee, criticalCount, criticalOverdue }) => (
                    <div key={assignee} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-medium text-slate-700">
                                    {assignee.split('@')[0].substring(0, 2).toUpperCase()}
                                </span>
                            </div>
                            <span className="text-sm text-slate-700 truncate">
                                {assignee.split('@')[0]}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {criticalOverdue > 0 && (
                                <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                    {criticalOverdue} late
                                </span>
                            )}
                            <span className="text-sm font-semibold text-slate-900 w-6 text-right">
                                {criticalCount}
                            </span>
                        </div>
                    </div>
                ))
            ) : (
                <EmptyState icon="users" message="No critical tasks assigned" />
            )}
        </div>
    </ChartCard>
);

const NearCriticalCard = ({ stats }) => (
    <ChartCard title="Near-Critical Tasks" subtitle="Tasks at risk of becoming critical">
        <div className="flex items-start justify-between mb-4">
            <div>
                <div className="text-4xl font-bold text-slate-900 mb-1">
                    {stats.nearCriticalTasks.length}
                </div>
                <div className="text-xs text-slate-500">
                    {stats.nearCriticalTasks.length === 0 ? 'No risks' : 'Tasks with low slack'}
                </div>
            </div>
            <div className={`w-14 h-14 ${stats.nearCriticalTasks.length > 0 ? 'bg-amber-100' : 'bg-slate-100'} rounded-xl flex items-center justify-center shrink-0`}>
                <AlertTriangleIcon className={`w-7 h-7 ${stats.nearCriticalTasks.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            </div>
        </div>
        {stats.nearCriticalTasks.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
                <div className="space-y-2">
                    {stats.nearCriticalTasks.slice(0, 4).map(task => (
                        <Link key={task.id} to={`/projects?selectedIssue=${task.taskKey}`} className="block text-xs">
                            <div className="text-slate-900 font-medium truncate">
                                {task.taskKey}
                            </div>
                            <div className="text-slate-500 truncate">
                                {task.summary}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        )}
    </ChartCard>
);

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

export default AnalyticsSection;
