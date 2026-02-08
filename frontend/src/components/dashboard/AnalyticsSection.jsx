import React from 'react';
import { Bar } from 'react-chartjs-2';
import { SectionHeader, ChartCard, chartOptions } from './DashboardComponents';
import { formatShortDate } from '../../util/helpers';

/**
 * Analytics grid section with all chart cards
 */
const AnalyticsSection = ({ stats }) => {
    return (
        <section>
            <SectionHeader title="Analytics" subtitle="Critical path optimization" />
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">

                {/* 1. Critical Path Health Score */}
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
                            <svg className={`w-7 h-7 ${
                                stats.criticalHealthScore >= 80 ? 'text-green-600' :
                                stats.criticalHealthScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
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

                {/* 2. Critical Path Timeline */}
                <CriticalPathTimelineCard stats={stats} />

                {/* 3. Project Progress */}
                <ProjectProgressCard stats={stats} />

                {/* 4. Overdue Critical Tasks */}
                <OverdueCriticalCard stats={stats} />

                {/* 5. Blocked Tasks */}
                <BlockedTasksCard stats={stats} />

                {/* 6. Team Workload on Critical Path */}
                <CriticalWorkloadCard stats={stats} />

                {/* 7. Float/Slack at Risk */}
                <NearCriticalCard stats={stats} />

                {/* 8. Cross-Project Dependencies */}
                <CrossProjectDepsCard stats={stats} />

                {/* 9. Upcoming Critical Deadlines */}
                <UpcomingDeadlinesCard stats={stats} />
            </div>
        </section>
    );
};

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
                            <a
                                href={`/projects?selectedIssue=${project.overdueTasks[0].taskKey}`}
                                className="block text-xs text-slate-500 hover:text-slate-900 truncate transition-colors"
                            >
                                {project.overdueTasks[0].taskKey} - {project.overdueTasks[0].summary}
                            </a>
                        )}
                    </div>
                ))
            ) : (
                <EmptyState icon="check" message="All critical tasks on time" />
            )}
        </div>
    </ChartCard>
);

const BlockedTasksCard = ({ stats }) => (
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
            <div className={`w-14 h-14 ${stats.blockedTasks.length > 0 ? 'bg-red-100' : 'bg-slate-100'} rounded-xl flex items-center justify-center shrink-0`}>
                <svg className={`w-7 h-7 ${stats.blockedTasks.length > 0 ? 'text-red-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
            </div>
        </div>
        {stats.blockedTasks.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
                <div className="space-y-2">
                    {stats.blockedTasks.slice(0, 4).map(task => (
                        <a key={task.id} href={`/projects?selectedIssue=${task.taskKey}`} className="block">
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
                        </a>
                    ))}
                </div>
            </div>
        )}
    </ChartCard>
);

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
                <svg className={`w-7 h-7 ${stats.nearCriticalTasks.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
        </div>
        {stats.nearCriticalTasks.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
                <div className="space-y-2">
                    {stats.nearCriticalTasks.slice(0, 4).map(task => (
                        <a key={task.id} href={`/projects?selectedIssue=${task.taskKey}`} className="block text-xs">
                            <div className="text-slate-900 font-medium truncate">
                                {task.taskKey}
                            </div>
                            <div className="text-slate-500 truncate">
                                {task.summary}
                            </div>
                        </a>
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
                    <a
                        key={task.id}
                        href={`/projects?selectedIssue=${task.taskKey}`}
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
                    </a>
                ))
            ) : (
                <EmptyState icon="check" message="No upcoming critical deadlines" fullHeight />
            )}
        </div>
    </ChartCard>
);

const EmptyState = ({ icon, message, fullHeight = false }) => {
    const icons = {
        trend: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
        chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
        check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
        lightning: "M13 10V3L4 14h7v7l9-11h-7z",
    };

    return (
        <div className={`${fullHeight ? 'h-full min-h-[180px]' : 'py-8'} flex flex-col items-center justify-center text-slate-400`}>
            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icons[icon]} />
                </svg>
            </div>
            <p className="text-xs text-slate-500">{message}</p>
        </div>
    );
};

export default AnalyticsSection;
