import React from 'react';
import { Link } from 'react-router-dom';
import { ChartCard } from '../ChartComponents';
import { formatAssigneeName, formatShortDate } from '../../../util/helpers';
import { CheckCircleIcon, ChartBarIcon, ClockIcon, TrendingUpIcon, UsersIcon } from '../../common/Icons';
import EmptyState from '../../common/EmptyState';
import { EnrichedTask } from '../../../types';
import { CriticalPathHealth } from '../../../util/statsCompute';
import {
    ProjectVelocity,
    ResourceConflicts,
    ScheduleHealth,
    SlackBucketId,
    SlackDistribution,
    VelocityStatus,
} from '../../../util/scheduleAnalysis';

// Cards about time: is the plan achievable, and where is it already slipping.

export const CriticalPathHealthCard = ({ health }: { health: CriticalPathHealth }) => {
    const score = health.criticalHealthScore;
    const tint = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red';
    const tintBg = { green: 'bg-green-100 dark:bg-green-900/30', yellow: 'bg-yellow-100 dark:bg-yellow-900/30', red: 'bg-red-100 dark:bg-red-900/30' }[tint];
    const tintText = { green: 'text-green-600 dark:text-green-400', yellow: 'text-yellow-600 dark:text-yellow-400', red: 'text-red-600 dark:text-red-400' }[tint];

    return (
        <ChartCard title="Critical Path Health" subtitle="Overall critical task status">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="text-4xl font-bold text-slate-900 dark:text-white mb-1">{score}%</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        {health.criticalTasksList.length} critical tasks
                    </div>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${tintBg}`}>
                    <CheckCircleIcon className={`w-7 h-7 ${tintText}`} />
                </div>
            </div>
            <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                <StatRow label="On Track" value={health.criticalOnTime} color="text-green-600 dark:text-green-400" />
                <StatRow label="At Risk" value={health.criticalAtRisk.length} color="text-yellow-600 dark:text-yellow-400" />
                <StatRow label="Delayed" value={health.criticalDelayed.length} color="text-red-600 dark:text-red-400" />
            </div>
        </ChartCard>
    );
};

const StatRow = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="flex justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span className={`font-semibold ${color}`}>{value}</span>
    </div>
);

export const ScheduleHealthCard = ({ health }: { health: ScheduleHealth }) => {
    const score = health.scheduleHealthScore;
    const tintText = score >= 75 ? 'text-green-600 dark:text-green-400'
        : score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
    const tintBg = score >= 75 ? 'bg-green-100 dark:bg-green-900/30'
        : score >= 50 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30';

    return (
        <ChartCard title="Schedule Health" subtitle="Progress vs time elapsed">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className={`text-4xl font-bold ${tintText} mb-1`}>{score}%</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        {health.totalActive} active tasks tracked
                    </div>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${tintBg}`}>
                    <ClockIcon className={`w-7 h-7 ${tintText}`} />
                </div>
            </div>
            <div className="space-y-1.5 pt-4 border-t border-slate-100 dark:border-slate-700">
                <StatRow label="On track" value={health.onTrack} color="text-green-600 dark:text-green-400" />
                <StatRow label="Slightly behind (<15%)" value={health.slightlyBehind} color="text-amber-500 dark:text-amber-400" />
                <StatRow label="Behind (15-30%)" value={health.behind} color="text-orange-600 dark:text-orange-400" />
                <StatRow label="Critically behind (>30%)" value={health.criticallyBehind} color="text-red-600 dark:text-red-400" />
                <StatRow label="Not yet started" value={health.notStarted} color="text-slate-400 dark:text-slate-500" />
            </div>
            {health.worstBehind.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Most behind</p>
                    {health.worstBehind.slice(0, 3).map(task => (
                        <Link key={task.taskKey} to={`/projects?selectedIssue=${task.taskKey}`}
                            className="block text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white truncate transition-colors mb-0.5">
                            <span className="font-mono font-medium">{task.taskKey}</span>
                            <span className="text-red-500 dark:text-red-400 ml-1">{task.gap}% behind</span>
                            <span className="text-slate-400 dark:text-slate-500 ml-1">({task.progress}% vs {task.expected}% expected)</span>
                        </Link>
                    ))}
                </div>
            )}
        </ChartCard>
    );
};

const SLACK_BUCKET_COLORS: Record<SlackBucketId, string> = {
    none: '#ef4444',
    tight: '#f97316',
    moderate: '#f59e0b',
    comfortable: '#3b82f6',
    ample: '#22c55e',
};

export const SlackDistributionCard = ({ distribution }: { distribution: SlackDistribution }) => {
    if (distribution.totalScheduled === 0) {
        return (
            <ChartCard title="Slack Distribution" subtitle="Schedule flexibility per task">
                <EmptyState size="sm" icon={ChartBarIcon} title="No scheduled tasks" />
            </ChartCard>
        );
    }

    const maxCount = Math.max(...distribution.buckets.map(b => b.count), 1);
    const fragilePercent = Math.round((distribution.zeroSlackCount / distribution.totalScheduled) * 100);
    const fragilityColor = fragilePercent >= 50 ? 'text-red-600 dark:text-red-400'
        : fragilePercent >= 25 ? 'text-amber-600 dark:text-amber-400'
        : 'text-green-600 dark:text-green-400';

    return (
        <ChartCard title="Slack Distribution" subtitle="Schedule flexibility per task">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{distribution.avgSlack}d</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">avg slack</div>
                </div>
                <div className="text-right">
                    <div className={`text-2xl font-bold ${fragilityColor}`}>{fragilePercent}%</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">zero slack</div>
                </div>
            </div>
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                {distribution.buckets.map(bucket => (
                    <div key={bucket.id} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400 w-16 shrink-0">{bucket.label}</span>
                        <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700/50 rounded overflow-hidden">
                            <div
                                className="h-full rounded transition-all duration-500"
                                style={{
                                    // A non-empty bucket keeps a visible stub, so "few" never reads as "none".
                                    width: `${Math.max((bucket.count / maxCount) * 100, bucket.count > 0 ? 8 : 0)}%`,
                                    backgroundColor: SLACK_BUCKET_COLORS[bucket.id],
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
                    High fragility — {distribution.zeroSlackCount} of {distribution.totalScheduled} tasks have no scheduling flexibility
                </p>
            )}
        </ChartCard>
    );
};

const VELOCITY_STATUS: Record<VelocityStatus, { label: string; bgClass: string; textColor: string }> = {
    comfortable: { label: 'Comfortable', bgClass: 'bg-green-500/10', textColor: 'text-green-600 dark:text-green-400' },
    moderate: { label: 'Moderate', bgClass: 'bg-blue-500/10', textColor: 'text-blue-600 dark:text-blue-400' },
    tight: { label: 'Tight', bgClass: 'bg-amber-500/10', textColor: 'text-amber-600 dark:text-amber-400' },
    critical: { label: 'Critical', bgClass: 'bg-red-500/10', textColor: 'text-red-600 dark:text-red-400' },
};

export const ProjectVelocityCard = ({ velocities }: { velocities: ProjectVelocity[] }) => (
    <ChartCard title="Required Velocity" subtitle="Daily progress needed to meet deadlines">
        <div className="space-y-3">
            {velocities.length > 0 ? (
                velocities.slice(0, 6).map(velocity => {
                    const status = VELOCITY_STATUS[velocity.status];
                    return (
                        <div key={velocity.projectKey} className="space-y-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{velocity.projectKey}</span>
                                    <span className={`text-[10px] font-medium ${status.textColor} px-1.5 py-0.5 rounded-full ${status.bgClass}`}>
                                        {status.label}
                                    </span>
                                </div>
                                <span className={`text-sm font-bold ${status.textColor}`}>
                                    {velocity.avgVelocityNeeded > 100 ? '99+' : velocity.avgVelocityNeeded}%/day
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span>{velocity.activeTasks} active</span>
                                {velocity.urgentCount > 0 && (
                                    <span className="text-amber-600 dark:text-amber-400">{velocity.urgentCount} need &gt;15%/day</span>
                                )}
                            </div>
                        </div>
                    );
                })
            ) : (
                <EmptyState size="sm" icon={TrendingUpIcon} title="No active tasks with schedules" />
            )}
        </div>
    </ChartCard>
);

export const ResourceConflictsCard = ({ conflicts }: { conflicts: ResourceConflicts }) => {
    const hasConflicts = conflicts.totalConflicts > 0;

    return (
        <ChartCard title="Resource Conflicts" subtitle="Overlapping task assignments">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className={`text-4xl font-bold mb-1 ${hasConflicts ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {conflicts.totalConflicts}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        {conflicts.affectedAssignees.length} people over-allocated
                    </div>
                </div>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                    hasConflicts ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'
                }`}>
                    <UsersIcon className={`w-7 h-7 ${hasConflicts ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
                </div>
            </div>
            {hasConflicts ? (
                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <StatRow label="Involve critical tasks" value={conflicts.criticalConflicts} color="text-red-600 dark:text-red-400" />
                    <div className="mt-2 space-y-1.5">
                        {conflicts.conflicts.slice(0, 4).map(conflict => (
                            <div key={`${conflict.task1}|${conflict.task2}`} className="text-xs flex items-center gap-1.5">
                                <span className="text-slate-500 dark:text-slate-400 truncate max-w-[140px]">{formatAssigneeName(conflict.assignee)}</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">{conflict.task1}</span>
                                <span className="text-slate-300 dark:text-slate-600">/</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">{conflict.task2}</span>
                                <span className="text-red-500 dark:text-red-400 ml-auto shrink-0">{conflict.overlapDays}d overlap</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                        Run the optimizer to resolve scheduling conflicts
                    </p>
                </div>
            ) : (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">No resource conflicts detected</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">All assignees have non-overlapping schedules</p>
                </div>
            )}
        </ChartCard>
    );
};

export const UpcomingDeadlinesCard = ({ deadlines }: { deadlines: EnrichedTask[] }) => (
    <ChartCard title="Upcoming Critical Deadlines" subtitle="Next 7 days" className="xl:col-span-2">
        <div className="h-56 overflow-y-auto pr-2 space-y-2">
            {deadlines.length > 0 ? (
                deadlines.map(task => (
                    <Link
                        key={task.id}
                        to={`/projects?selectedIssue=${task.taskKey}`}
                        className="block p-3 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/70 rounded-lg transition-colors border border-red-100 dark:border-red-900/50"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-slate-900 dark:text-white">{task.taskKey}</span>
                                    <span className="text-xs text-red-600 dark:text-red-300 bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded font-semibold">
                                        Critical
                                    </span>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-1 font-medium">{task.summary}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">{task.progress}%</span>
                                    <div className="h-1.5 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden max-w-[100px]">
                                        <div className="h-full bg-red-600 dark:bg-red-500 rounded-full" style={{ width: `${task.progress}%` }} />
                                    </div>
                                </div>
                            </div>
                            <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap font-medium">
                                {formatShortDate(task.dueDate)}
                            </span>
                        </div>
                    </Link>
                ))
            ) : (
                <EmptyState size="sm" icon={CheckCircleIcon} title="No upcoming critical deadlines" className="h-full" />
            )}
        </div>
    </ChartCard>
);
