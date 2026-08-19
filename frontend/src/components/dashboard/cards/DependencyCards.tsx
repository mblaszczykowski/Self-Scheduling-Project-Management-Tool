import React from 'react';
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';
import { ChartCard, ICON_WELL_CLASS, chartOptions, useChartTickColor } from '../ChartComponents';
import { formatAssigneeName } from '../../../util/helpers';
import { LightningIcon, BlockedIcon, TrendingUpIcon, UsersIcon } from '../../common/Icons';
import EmptyState from '../../common/EmptyState';
import { BlockedTasks, CriticalPathProject, CrossProjectDependency } from '../../../util/statsCompute';
import { AssigneeLoad, DependencyChainAnalysis } from '../../../util/scheduleAnalysis';

export const CriticalPathTimelineCard = ({ timeline }: { timeline: CriticalPathProject[] }) => (
    <ChartCard title="Critical Path Duration" subtitle="Timeline by project">
        <div className="space-y-3">
            {timeline.length > 0 ? (
                timeline.slice(0, 5).map(project => (
                    <div key={project.projectKey} className="space-y-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {project.projectKey}
                                </span>
                                {project.status === 'delayed' && (
                                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                                )}
                            </div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {project.criticalPathDays}d
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>{project.criticalTaskCount} critical tasks</span>
                            {project.delayedCritical > 0 && (
                                <span className="text-red-600 dark:text-red-400 font-medium">
                                    {project.delayedCritical} delayed
                                </span>
                            )}
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full w-full rounded-full ${
                                    project.status === 'delayed' ? 'bg-red-500' : 'bg-slate-600 dark:bg-slate-400'
                                }`}
                            />
                        </div>
                    </div>
                ))
            ) : (
                <EmptyState size="sm" icon={TrendingUpIcon} title="No critical paths" />
            )}
        </div>
    </ChartCard>
);

const DEEP_CHAIN_THRESHOLD = 3;

export const DependencyChainCard = ({ analysis }: { analysis: DependencyChainAnalysis }) => {
    const isDeep = analysis.longestChainLength > DEEP_CHAIN_THRESHOLD;

    return (
        <ChartCard title="Dependency Analysis" subtitle="Chain depth & bottleneck tasks">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="text-4xl font-bold text-slate-900 dark:text-white mb-1">
                        {analysis.longestChainLength}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        Longest dependency chain
                    </div>
                </div>
                <div className={`${ICON_WELL_CLASS} ${
                    isDeep ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-slate-100 dark:bg-slate-700'
                }`}>
                    <LightningIcon className={`w-7 h-7 ${
                        isDeep ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
                    }`} />
                </div>
            </div>
            {analysis.bottlenecks.length > 0 ? (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                        Bottleneck tasks (most dependents)
                    </p>
                    <div className="space-y-2">
                        {analysis.bottlenecks.map(bottleneck => (
                            <Link key={bottleneck.taskKey} to={`/projects?selectedIssue=${bottleneck.taskKey}`}
                                className="flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-1 px-1 rounded transition-colors">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{bottleneck.taskKey}</span>
                                    {bottleneck.isCritical && (
                                        <span className="text-[9px] text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/60 px-1 py-px rounded font-medium">C</span>
                                    )}
                                    <span className="text-slate-400 dark:text-slate-500 truncate">{bottleneck.summary}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className="text-slate-500 dark:text-slate-400">{bottleneck.progress}%</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{bottleneck.dependentCount} downstream</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                    {isDeep && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2">
                            Deep chains amplify delays. Consider parallelizing work.
                        </p>
                    )}
                </div>
            ) : (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">No active bottleneck tasks</p>
                </div>
            )}
        </ChartCard>
    );
};

export const BlockedTasksCard = ({ blocked }: { blocked: BlockedTasks }) => {
    const hasBlocked = blocked.blockedTasks.length > 0;

    return (
        <ChartCard title="Blocked Tasks" subtitle="Waiting on dependencies">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="text-4xl font-bold text-slate-900 dark:text-white mb-1">
                        {blocked.blockedTasks.length}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        {blocked.blockedCriticalTasks.length} are critical
                    </div>
                </div>
                <div className={`${ICON_WELL_CLASS} ${
                    hasBlocked ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-700'
                }`}>
                    <BlockedIcon className={`w-7 h-7 ${hasBlocked ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`} />
                </div>
            </div>
            {hasBlocked && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                    <div className="space-y-2">
                        {blocked.blockedTasks.slice(0, 4).map(task => (
                            <Link key={task.id} to={`/projects?selectedIssue=${task.taskKey}`} className="block">
                                <div className="flex items-center gap-2">
                                    <div className="text-xs text-slate-900 dark:text-white font-medium truncate">
                                        {task.taskKey}
                                    </div>
                                    {task.isCritical && (
                                        <span className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/60 px-1.5 py-0.5 rounded">Critical</span>
                                    )}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
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

export const CrossProjectDepsCard = ({ dependencies }: { dependencies: CrossProjectDependency[] }) => (
    <ChartCard title="Cross-Project Dependencies" subtitle="Inter-project links">
        <div className="space-y-3">
            {dependencies.length > 0 ? (
                dependencies.map(project => (
                    <div key={project.projectKey} className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {project.projectKey}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Depends on {project.dependencyCount} project{project.dependencyCount > 1 ? 's' : ''}
                        </div>
                        <div className="pl-3 border-l-2 border-slate-200 dark:border-slate-700">
                            {project.dependsOn.slice(0, 2).map(dependency => (
                                <div key={dependency.key} className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                    {'→'} {dependency.key}
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            ) : (
                <EmptyState size="sm" icon={LightningIcon} title="No cross-project dependencies" />
            )}
        </div>
    </ChartCard>
);

export const TeamWorkloadBarCard = ({ load }: { load: AssigneeLoad[] }) => {
    const tickColor = useChartTickColor();

    if (load.length === 0) {
        return (
            <ChartCard title="Team Workload" subtitle="Tasks per assignee (critical vs normal)">
                <EmptyState size="sm" icon={UsersIcon} title="No assigned active tasks" />
            </ChartCard>
        );
    }

    const workloadOptions: ChartOptions<'bar'> = {
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
                    color: tickColor,
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
                ticks: { ...chartOptions.scales.x.ticks, color: tickColor, stepSize: 1 },
            },
            y: {
                ...chartOptions.scales.y,
                stacked: true,
                ticks: { ...chartOptions.scales.y.ticks, color: tickColor },
            },
        },
    };

    const data = {
        labels: load.map(entry => formatAssigneeName(entry.assignee)),
        datasets: [
            {
                label: 'Critical',
                data: load.map(entry => entry.critical),
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                hoverBackgroundColor: 'rgba(220, 38, 38, 1)',
                borderRadius: 4,
                borderSkipped: false,
            },
            {
                label: 'Normal',
                data: load.map(entry => entry.total - entry.critical),
                backgroundColor: 'rgba(71, 85, 105, 0.7)',
                hoverBackgroundColor: 'rgba(51, 65, 85, 1)',
                borderRadius: 4,
                borderSkipped: false,
            },
        ],
    };

    return (
        <ChartCard title="Team Workload" subtitle="Tasks per assignee (critical vs normal)">
            <div className="h-56">
                <Bar
                    data={data}
                    options={workloadOptions}
                    aria-label={`Bar chart of critical versus normal task counts for ${load.length} assignee${load.length === 1 ? '' : 's'}`}
                />
            </div>
        </ChartCard>
    );
};
