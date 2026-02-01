import React from 'react';

/**
 * Base skeleton component with pulse animation.
 * Use className to customize dimensions.
 */
export const Skeleton = ({ className = '' }) => (
    <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
);

/**
 * Skeleton for stat cards on the dashboard.
 */
export const StatCardSkeleton = () => (
    <div className="bg-white rounded-xl p-5 border border-slate-200">
        <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
    </div>
);

/**
 * Skeleton for a task row in a list.
 */
export const TaskRowSkeleton = () => (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-slate-100">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-48 flex-1" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
    </div>
);

/**
 * Skeleton for project cards.
 */
export const ProjectCardSkeleton = () => (
    <div className="bg-white rounded-xl p-5 border border-slate-200">
        <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-3 w-20" />
                </div>
            </div>
            <Skeleton className="h-6 w-6 rounded" />
        </div>
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-2/3 mb-4" />
        <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-6 w-6 rounded-full" />
        </div>
    </div>
);

/**
 * Skeleton for timeline rows.
 */
export const TimelineRowSkeleton = () => (
    <div className="flex items-center h-10 border-b border-slate-100">
        <div className="w-64 px-4 flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex-1 px-4">
            <Skeleton className="h-6 w-32 rounded" />
        </div>
    </div>
);

/**
 * Dashboard loading skeleton.
 * Shows placeholder UI while data is loading.
 */
export const DashboardSkeleton = () => (
    <div className="p-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-5 border border-slate-200">
                <Skeleton className="h-5 w-32 mb-4" />
                <Skeleton className="h-48 w-full rounded-lg" />
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200">
                <Skeleton className="h-5 w-32 mb-4" />
                <Skeleton className="h-48 w-full rounded-lg" />
            </div>
        </div>

        {/* Tasks list */}
        <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200">
                <Skeleton className="h-5 w-40" />
            </div>
            <TaskRowSkeleton />
            <TaskRowSkeleton />
            <TaskRowSkeleton />
            <TaskRowSkeleton />
            <TaskRowSkeleton />
        </div>
    </div>
);

export default Skeleton;
