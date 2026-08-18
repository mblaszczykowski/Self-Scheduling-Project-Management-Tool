import React from 'react';
import { SectionHeader } from './ChartComponents';
import {
    CompletionTrendCard,
    OptimizationOpportunityCard,
    PriorityDistributionCard,
    ProjectProgressCard,
    StatusDistributionCard,
} from './cards/OverviewCards';
import {
    CriticalPathHealthCard,
    ProjectVelocityCard,
    ResourceConflictsCard,
    ScheduleHealthCard,
    SlackDistributionCard,
    UpcomingDeadlinesCard,
} from './cards/ScheduleCards';
import {
    BlockedTasksCard,
    CriticalPathTimelineCard,
    CrossProjectDepsCard,
    DependencyChainCard,
    TeamWorkloadBarCard,
} from './cards/DependencyCards';
import { DashboardStats } from '../../hooks/useDashboardStats';

// Layout only. The cards are siblings with no shared state, so each one takes just the slice of
// `stats` it draws and lives in the file for its section.

const SectionDivider = ({ title }: { title: string }) => (
    <div className="col-span-full pt-6 pb-2 first:pt-0">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
    </div>
);

const AnalyticsSection = ({ stats }: { stats: DashboardStats }) => (
    <section>
        <SectionHeader title="Analytics" subtitle="Critical path optimization & schedule intelligence" />
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">

            <SectionDivider title="Overview" />
            <StatusDistributionCard distribution={stats.statusDistribution} />
            <PriorityDistributionCard distribution={stats.priorityDistribution} />
            <ProjectProgressCard completion={stats.projectCompletion} />
            <CompletionTrendCard trend={stats.completionTrend} />
            <OptimizationOpportunityCard opportunity={stats.optimizationOpportunity} />

            <SectionDivider title="Schedule & Health" />
            <CriticalPathHealthCard health={stats.criticalHealth} />
            <ScheduleHealthCard health={stats.scheduleHealth} />
            <SlackDistributionCard distribution={stats.slackDistribution} />
            <ProjectVelocityCard velocities={stats.projectVelocity} />
            <ResourceConflictsCard conflicts={stats.resourceConflicts} />
            <UpcomingDeadlinesCard deadlines={stats.upcomingCriticalDeadlines} />

            <SectionDivider title="Dependencies & Team" />
            <CriticalPathTimelineCard timeline={stats.criticalPathTimeline} />
            <DependencyChainCard analysis={stats.dependencyAnalysis} />
            <BlockedTasksCard blocked={stats.blocked} />
            <CrossProjectDepsCard dependencies={stats.crossProjectDeps} />
            <TeamWorkloadBarCard load={stats.assigneeLoad} />
        </div>
    </section>
);

// Memoized: it depends only on the stable `stats` object, so unrelated DashboardPage re-renders
// (e.g. opening a modal) no longer re-render every card.
export default React.memo(AnalyticsSection);
