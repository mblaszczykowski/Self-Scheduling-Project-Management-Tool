import React, { useEffect, useState, useMemo } from 'react';
import { formatAssigneeName, daysBetween, formatShortDate } from '../../util/helpers';

const keyframes = `
@keyframes optSlideIn {
    from { opacity: 0; transform: translateY(-12px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes optFadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes optProgressFill {
    from { width: 0%; }
    to { width: var(--fill); }
}
`;

const fmtDate = (d) => (d ? formatShortDate(d) : '—');

const fmtNum = (v, decimals = 1) => {
    if (typeof v !== 'number') return v;
    return v % 1 === 0 ? v.toString() : v.toFixed(decimals);
};

/* Small arrow between before/after */
const Arrow = () => (
    <svg width="12" height="7" viewBox="0 0 12 7" className="text-slate-300 flex-shrink-0 mx-0.5">
        <path d="M0 3.5h9M7.5 1L10 3.5l-2.5 2.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

/* Before → After metric used in the comparison row */
const BeforeAfter = ({ label, before, after, unit = '', lowerIsBetter = true, infeasible = false }) => {
    const improved = lowerIsBetter ? after < before : after > before;
    const unchanged = Math.abs(after - before) < 0.01;
    const afterColor = unchanged ? 'text-slate-500'
        : improved ? 'text-emerald-600' : 'text-amber-600';

    return (
        <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-slate-400 font-medium">{label}</span>
            <div className="flex items-center gap-0.5 tabular-nums">
                <span className={`text-xs ${infeasible ? 'text-slate-300' : 'text-slate-400'}`}>
                    {infeasible ? 'n/a' : <>{fmtNum(before)}{unit}</>}
                </span>
                <Arrow />
                <span className={`text-sm font-bold leading-none ${infeasible ? 'text-slate-600' : afterColor}`}>
                    {fmtNum(after)}{unit}
                </span>
            </div>
        </div>
    );
};

/* Stat card for headline numbers */
const StatCard = ({ value, label, sublabel, accent = 'emerald', delay = 0 }) => {
    const colors = {
        emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400',
        amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400',
        slate: 'from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300',
    };
    return (
        <div
            className={`flex flex-col items-center px-4 py-2.5 rounded-xl bg-gradient-to-b border ${colors[accent]}`}
            style={{ animation: `optFadeUp 0.4s ${delay}ms cubic-bezier(0.22, 1, 0.36, 1) both` }}
        >
            <span className="text-2xl font-bold tabular-nums leading-none tracking-tight">{value}</span>
            <span className="text-xs mt-1 font-medium opacity-70">{label}</span>
            {sublabel && <span className="text-[10px] opacity-50">{sublabel}</span>}
        </div>
    );
};

const OptimizationMetrics = ({
    originalMetrics, optimizedMetrics, suggestions,
    suggestionsCount, onAccept, onReject, isApplying,
}) => {
    const [mounted, setMounted] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const summary = useMemo(() => {
        if (!suggestions) return null;
        const shifted = suggestions.filter(s => s.wasShifted);

        const byAssignee = {};
        let totalShiftDays = 0, maxShift = 0;

        shifted.forEach(s => {
            const key = s.assignee || 'Unassigned';
            if (!byAssignee[key]) byAssignee[key] = [];
            byAssignee[key].push(s);
            const shift = Math.abs(daysBetween(s.originalStartDate, s.suggestedStartDate));
            totalShiftDays += shift;
            if (shift > maxShift) maxShift = shift;
        });

        return {
            shifted,
            byAssignee,
            avgShift: shifted.length > 0 ? Math.round(totalShiftDays / shifted.length) : 0,
            maxShift,
            affectedPeople: Object.keys(byAssignee).filter(k => k !== 'Unassigned').length,
        };
    }, [suggestions]);

    if (!originalMetrics || !optimizedMetrics || !mounted || !summary) return null;

    const conflictsBefore = originalMetrics.resourceConflicts;
    const conflictsAfter = optimizedMetrics.resourceConflicts;
    const conflictsResolved = conflictsBefore - conflictsAfter;
    const infeasible = conflictsBefore > 0;
    const onTimeBefore = originalMetrics.tasksOnTime;
    const onTimeAfter = optimizedMetrics.tasksOnTime;
    const totalTasks = optimizedMetrics.totalTasks;
    const onTimePct = totalTasks > 0 ? Math.round((onTimeAfter / totalTasks) * 100) : 0;
    const lateBefore = originalMetrics.tasksLate;
    const lateAfter = optimizedMetrics.tasksLate;

    return (
        <>
            <style>{keyframes}</style>
            <div
                className="mb-4 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
                style={{ animation: 'optSlideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
            >
                {/* Top accent line */}
                <div className="h-1" style={{ background: 'linear-gradient(90deg, #10b981, #3b82f6, #10b981)' }} />

                <div className="px-6 py-5">
                    {/* ===== Header row ===== */}
                    <div className="flex items-start justify-between gap-6">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center flex-shrink-0">
                                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                        <path d="M3 9.5L7 13.5L15 4.5" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                                        Schedule Optimization Ready
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {suggestionsCount} of {suggestions?.length || 0} tasks rescheduled
                                        {summary.affectedPeople > 0 && (
                                            <> &middot; {summary.affectedPeople} {summary.affectedPeople === 1 ? 'person' : 'people'} affected</>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Infeasible note */}
                            {infeasible && (
                                <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 text-amber-500">
                                        <path d="M7 1L13 12H1L7 1Z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
                                        <circle cx="7" cy="9.5" r="0.6" fill="currentColor"/>
                                        <line x1="7" y1="5" x2="7" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                    </svg>
                                    <span className="text-xs text-amber-700 dark:text-amber-300">
                                        Original schedule contains {conflictsBefore} resource {conflictsBefore === 1 ? 'conflict' : 'conflicts'}; the "before" metrics below are computed naively (assuming overlapping tasks run in parallel) and serve as a lower bound for the true cost.
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                            <div className="flex items-center gap-1.5 mr-2">
                                <div className="w-4 h-1 rounded-full"
                                    style={{
                                        background: 'linear-gradient(90deg, rgba(99,102,241,0.25), rgba(99,102,241,0.5))',
                                        border: '1px dashed rgba(99,102,241,0.7)',
                                    }}
                                />
                                <span className="text-[10px] text-slate-400">= suggested</span>
                            </div>
                            <button
                                onClick={onAccept}
                                disabled={isApplying}
                                className="text-sm px-5 py-2 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 text-white flex items-center gap-2"
                                style={{
                                    background: 'linear-gradient(135deg, #059669, #10b981)',
                                    boxShadow: '0 1px 3px rgba(5,150,105,0.3), 0 4px 12px rgba(5,150,105,0.15)',
                                }}
                            >
                                {isApplying ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Applying…
                                    </>
                                ) : (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                            <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        Apply Schedule
                                    </>
                                )}
                            </button>
                            <button
                                onClick={onReject}
                                disabled={isApplying}
                                className="text-sm px-4 py-2 rounded-lg font-medium transition-all text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>

                    {/* ===== Stats cards row ===== */}
                    <div className="flex items-center gap-3 mt-4">
                        <StatCard
                            value={suggestionsCount}
                            label="Rescheduled"
                            sublabel={`of ${suggestions?.length || 0} tasks`}
                            accent="blue"
                            delay={80}
                        />
                        <StatCard
                            value={`${summary.avgShift}d`}
                            label="Avg. shift"
                            sublabel={`max ${summary.maxShift}d`}
                            accent="slate"
                            delay={140}
                        />
                        <StatCard
                            value={conflictsAfter}
                            label="Conflicts"
                            sublabel={conflictsResolved > 0 ? `${conflictsResolved} resolved` : undefined}
                            accent={conflictsAfter === 0 ? 'emerald' : 'amber'}
                            delay={200}
                        />
                        <StatCard
                            value={summary.affectedPeople}
                            label="People"
                            accent="slate"
                            delay={260}
                        />
                        <StatCard
                            value={`${onTimeAfter}/${totalTasks}`}
                            label="On time"
                            sublabel={onTimeAfter > onTimeBefore ? `was ${onTimeBefore}/${totalTasks}` : undefined}
                            accent={onTimeAfter >= totalTasks ? 'emerald' : onTimeAfter > onTimeBefore ? 'blue' : 'slate'}
                            delay={320}
                        />

                        {/* On-time progress bar fills remaining space */}
                        <div
                            className="flex-1 ml-1"
                            style={{ animation: `optFadeUp 0.4s 350ms cubic-bezier(0.22, 1, 0.36, 1) both` }}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-slate-500 dark:text-slate-400">On-time delivery</span>
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{onTimePct}%</span>
                            </div>
                            <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        '--fill': `${onTimePct}%`,
                                        width: `${onTimePct}%`,
                                        background: onTimePct === 100
                                            ? 'linear-gradient(90deg, #059669, #10b981)'
                                            : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                                        animation: 'optProgressFill 0.8s 450ms cubic-bezier(0.22, 1, 0.36, 1) both',
                                    }}
                                />
                            </div>
                            {lateAfter > 0 && (
                                <p className="text-xs text-amber-600 mt-1">
                                    {lateAfter} {lateAfter === 1 ? 'task' : 'tasks'} still late — consider adjusting deadlines or adding resources
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ===== Before/After comparison row ===== */}
                    <div className="flex items-center gap-6 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex-wrap"
                        style={{ animation: `optFadeUp 0.4s 400ms cubic-bezier(0.22, 1, 0.36, 1) both` }}
                    >
                        <BeforeAfter
                            label="Conflicts"
                            before={conflictsBefore}
                            after={conflictsAfter}
                        />
                        <BeforeAfter
                            label="Tasks late"
                            before={lateBefore}
                            after={lateAfter}
                        />
                        <BeforeAfter
                            label="Tasks on time"
                            before={onTimeBefore}
                            after={onTimeAfter}
                            lowerIsBetter={false}
                        />
                        <BeforeAfter
                            label="Weighted delay"
                            before={originalMetrics.weightedTardiness}
                            after={optimizedMetrics.weightedTardiness}
                        />
                        <BeforeAfter
                            label="Total duration"
                            before={originalMetrics.makespan}
                            after={optimizedMetrics.makespan}
                            unit="d"
                        />
                    </div>

                    {/* ===== Expandable per-task detail ===== */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <button
                            onClick={() => setShowDetails(p => !p)}
                            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5 px-1 py-0.5 -ml-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                                className={`transition-transform duration-200 ${showDetails ? 'rotate-90' : ''}`}
                            >
                                <path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {showDetails ? 'Hide' : 'Show'} what changes ({summary.shifted.length} {summary.shifted.length === 1 ? 'task' : 'tasks'})
                        </button>

                        {showDetails && summary.shifted.length > 0 && (
                            <div className="mt-3 rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                                {/* Table header */}
                                <div className="grid grid-cols-[1fr_120px_120px_55px_50px_130px] gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
                                    <span>Task</span>
                                    <span>Current</span>
                                    <span>Proposed</span>
                                    <span className="text-right">Shift</span>
                                    <span className="text-right">Late</span>
                                    <span className="text-right">Assigned to</span>
                                </div>

                                {/* Rows */}
                                <div className="max-h-[220px] overflow-y-auto"
                                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(148,163,184,0.2) transparent' }}
                                >
                                    {[...summary.shifted]
                                        .sort((a, b) =>
                                            Math.abs(daysBetween(b.originalStartDate, b.suggestedStartDate)) -
                                            Math.abs(daysBetween(a.originalStartDate, a.suggestedStartDate))
                                        )
                                        .map((s, i) => {
                                            const shift = daysBetween(s.originalStartDate, s.suggestedStartDate);
                                            return (
                                                <div key={s.taskKey}
                                                    className="grid grid-cols-[1fr_120px_120px_55px_50px_130px] gap-3 px-4 py-2.5 border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors items-center"
                                                    style={{ animation: `optFadeUp 0.25s ${80 + i * 30}ms cubic-bezier(0.22, 1, 0.36, 1) both` }}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-xs font-semibold text-slate-400 flex-shrink-0">{s.taskKey}</span>
                                                        <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{s.summary}</span>
                                                        {s.isCritical && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-semibold flex-shrink-0 border border-red-100">
                                                                Critical
                                                            </span>
                                                        )}
                                                        {s.priorityWeight >= 8 && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-bold flex-shrink-0 border border-amber-200">
                                                                High priority
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-slate-400 tabular-nums">
                                                        {fmtDate(s.originalStartDate)} – {fmtDate(s.originalDueDate)}
                                                    </span>
                                                    <span className="text-xs text-blue-600 font-medium tabular-nums">
                                                        {fmtDate(s.suggestedStartDate)} – {fmtDate(s.suggestedDueDate)}
                                                    </span>
                                                    <span className={`text-xs font-semibold tabular-nums text-right ${
                                                        shift > 0 ? 'text-amber-600' : shift < 0 ? 'text-emerald-600' : 'text-slate-400'
                                                    }`}>
                                                        {shift > 0 ? '+' : ''}{shift}d
                                                    </span>
                                                    <span className={`text-xs tabular-nums text-right ${
                                                        s.tardinessDays > 0 ? 'text-red-500 font-semibold' : 'text-slate-300'
                                                    }`}>
                                                        {s.tardinessDays > 0 ? `+${s.tardinessDays}d` : '—'}
                                                    </span>
                                                    <span className="text-xs text-slate-500 truncate text-right" title={s.assignee || 'Unassigned'}>
                                                        {s.assignee ? formatAssigneeName(s.assignee) : '—'}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default React.memo(OptimizationMetrics);
