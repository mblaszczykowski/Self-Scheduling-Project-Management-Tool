import React from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';
import { ChartCard, chartOptions, useChartSurfaceColor } from '../ChartComponents';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../../util/helpers';
import { ChartBarIcon, TrendingUpIcon } from '../../common/Icons';
import EmptyState from '../../common/EmptyState';
import { ProjectCompletion } from '../../../util/statsCompute';
import {
    CompletionWeek,
    FactorImpact,
    OptimizationOpportunity,
    PriorityCount,
    StatusCount,
} from '../../../util/scheduleAnalysis';

// The portfolio-wide cards: what the work looks like right now, and how much the optimizer could
// still improve it. Each card owns the colours and chart options it draws with.

const doughnutOptions: ChartOptions<'doughnut'> = {
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

export const StatusDistributionCard = ({ distribution }: { distribution: StatusCount[] }) => {
    const surfaceColor = useChartSurfaceColor();

    if (distribution.length === 0) {
        return (
            <ChartCard title="Status Distribution" subtitle="Tasks by current status">
                <EmptyState size="sm" icon={ChartBarIcon} title="No tasks to display" />
            </ChartCard>
        );
    }

    const data = {
        labels: distribution.map(entry => STATUS_CONFIG[entry.status].label),
        datasets: [{
            data: distribution.map(entry => entry.count),
            backgroundColor: distribution.map(entry => STATUS_CONFIG[entry.status].hex),
            borderWidth: 2,
            borderColor: surfaceColor,
            hoverOffset: 4,
        }],
    };

    return (
        <ChartCard title="Status Distribution" subtitle="Tasks by current status">
            <div className="h-48 flex items-center justify-center">
                <Doughnut data={data} options={doughnutOptions} />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-x-4 gap-y-1">
                {distribution.map(entry => (
                    <div key={entry.status} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_CONFIG[entry.status].hex }} />
                        <span className="text-slate-600 dark:text-slate-400 truncate">{STATUS_CONFIG[entry.status].label}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 ml-auto">{entry.count}</span>
                    </div>
                ))}
            </div>
        </ChartCard>
    );
};

export const PriorityDistributionCard = ({ distribution }: { distribution: PriorityCount[] }) => {
    const surfaceColor = useChartSurfaceColor();

    if (distribution.length === 0) {
        return (
            <ChartCard title="Priority Distribution" subtitle="Tasks by priority level">
                <EmptyState size="sm" icon={ChartBarIcon} title="No tasks to display" />
            </ChartCard>
        );
    }

    const data = {
        labels: distribution.map(entry => PRIORITY_CONFIG[entry.priority].label),
        datasets: [{
            data: distribution.map(entry => entry.count),
            backgroundColor: distribution.map(entry => PRIORITY_CONFIG[entry.priority].hex),
            borderWidth: 2,
            borderColor: surfaceColor,
            hoverOffset: 4,
        }],
    };

    return (
        <ChartCard title="Priority Distribution" subtitle="Tasks by priority level">
            <div className="h-48 flex items-center justify-center">
                <Doughnut data={data} options={doughnutOptions} />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-x-4 gap-y-1 justify-center">
                {distribution.map(entry => (
                    <div key={entry.priority} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_CONFIG[entry.priority].hex }} />
                        <span className="text-slate-600 dark:text-slate-400">{PRIORITY_CONFIG[entry.priority].label}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{entry.count}</span>
                    </div>
                ))}
            </div>
        </ChartCard>
    );
};

const projectProgressOptions: ChartOptions<'bar'> = {
    ...chartOptions,
    indexAxis: 'y',
    scales: {
        ...chartOptions.scales,
        x: {
            ...chartOptions.scales.x,
            beginAtZero: true,
            max: 100,
            grid: { display: true, color: 'rgba(148, 163, 184, 0.1)' },
        },
    },
};

export const ProjectProgressCard = ({ completion }: { completion: ProjectCompletion[] }) => (
    <ChartCard title="Project Progress" subtitle="Overall completion">
        <div className="h-56">
            {completion.length > 0 ? (
                <Bar
                    data={{
                        labels: completion.map(p => p.projectKey),
                        datasets: [{
                            data: completion.map(p => p.completionPercentage),
                            backgroundColor: 'rgba(71, 85, 105, 0.8)',
                            hoverBackgroundColor: 'rgba(51, 65, 85, 1)',
                            borderRadius: 6,
                            borderSkipped: false,
                        }],
                    }}
                    options={projectProgressOptions}
                />
            ) : (
                <EmptyState size="sm" icon={ChartBarIcon} title="No data" className="h-full" />
            )}
        </div>
    </ChartCard>
);

const completionTrendOptions: ChartOptions<'line'> = {
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

export const CompletionTrendCard = ({ trend }: { trend: CompletionWeek[] }) => {
    const surfaceColor = useChartSurfaceColor();

    if (!trend.some(week => week.count > 0)) {
        return (
            <ChartCard title="Completion Trend" subtitle="Weekly completed tasks (8 weeks)">
                <EmptyState size="sm" icon={TrendingUpIcon} title="No completions in the past 8 weeks" />
            </ChartCard>
        );
    }

    const data = {
        labels: trend.map(week => week.label),
        datasets: [{
            label: 'Completed',
            data: trend.map(week => week.count),
            borderColor: 'rgba(71, 85, 105, 0.9)',
            backgroundColor: 'rgba(71, 85, 105, 0.1)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#475569',
            pointBorderColor: surfaceColor,
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
        }],
    };

    return (
        <ChartCard title="Completion Trend" subtitle="Weekly completed tasks (8 weeks)">
            <div className="h-56">
                <Line data={data} options={completionTrendOptions} />
            </div>
        </ChartCard>
    );
};

const IMPACT_COLORS: Record<FactorImpact, string> = {
    high: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
    medium: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
};

const RING_SIZE = 56;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const OptimizationOpportunityCard = ({ opportunity }: { opportunity: OptimizationOpportunity }) => {
    const { score, factors, recommendation } = opportunity;

    const ringColor = score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : score >= 15 ? '#3b82f6' : '#22c55e';
    const bgColor = score >= 70 ? 'bg-red-100 dark:bg-red-900/30'
        : score >= 40 ? 'bg-amber-100 dark:bg-amber-900/30'
        : score >= 15 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30';
    const textColor = score >= 70 ? 'text-red-600 dark:text-red-400'
        : score >= 40 ? 'text-amber-600 dark:text-amber-400'
        : score >= 15 ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400';
    const headline = score >= 70 ? 'High opportunity'
        : score >= 40 ? 'Moderate opportunity'
        : score >= 15 ? 'Low opportunity' : 'Schedule is healthy';

    return (
        <ChartCard title="Optimization Opportunity" subtitle="How much can the optimizer help">
            <div className="flex items-start gap-4 mb-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${bgColor}`}>
                    <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
                        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" strokeWidth={RING_STROKE}
                            className="text-slate-200 dark:text-slate-700" stroke="currentColor" />
                        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" strokeWidth={RING_STROKE}
                            strokeLinecap="round" strokeDasharray={RING_CIRCUMFERENCE}
                            strokeDashoffset={RING_CIRCUMFERENCE - (score / 100) * RING_CIRCUMFERENCE}
                            stroke={ringColor} className="transition-all duration-700" />
                        <text x={RING_SIZE / 2} y={RING_SIZE / 2} textAnchor="middle" dominantBaseline="central"
                            className={`fill-current text-[11px] font-bold rotate-90 origin-center ${textColor}`}>
                            {score}
                        </text>
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${textColor} mb-0.5`}>{headline}</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{recommendation}</p>
                </div>
            </div>
            {factors.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-700">
                    {factors.map(factor => (
                        <div key={factor.label} className="flex items-center justify-between">
                            <span className="text-xs text-slate-600 dark:text-slate-400">{factor.label}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{factor.value}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${IMPACT_COLORS[factor.impact]}`}>
                                    {factor.impact}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </ChartCard>
    );
};
