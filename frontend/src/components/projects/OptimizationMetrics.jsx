import React, { useEffect, useState, useMemo } from 'react';

const keyframes = `
@keyframes optPanelIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes optPulseRing {
    0% { transform: scale(0.8); opacity: 0.6; }
    50% { transform: scale(1.4); opacity: 0; }
    100% { transform: scale(0.8); opacity: 0; }
}
@keyframes optCountUp {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes optRowIn {
    from { opacity: 0; transform: translateX(-4px); }
    to { opacity: 1; transform: translateX(0); }
}
`;

const daysBetween = (a, b) => {
    if (!a || !b) return 0;
    return Math.round((new Date(b) - new Date(a)) / 86400000);
};

const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const fmtNum = (v, decimals = 1) => {
    if (typeof v !== 'number') return v;
    return v % 1 === 0 ? v.toString() : v.toFixed(decimals);
};

// Arrow between before/after values
const TransitionArrow = () => (
    <svg width="10" height="6" viewBox="0 0 10 6" className="text-slate-600 flex-shrink-0">
        <path d="M0 3h7M5.5 1L8 3l-2.5 2" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// Metric with before→after comparison
const MetricTransition = ({ label, before, after, unit = '', lowerIsBetter = true, delay = 0, infeasibleBefore = false }) => {
    const improved = lowerIsBetter ? after < before : after > before;
    const unchanged = Math.abs(after - before) < 0.01;

    // Handle percentage: avoid misleading % when original was 0 or infeasible
    let pctLabel = null;
    if (!unchanged) {
        if (before === 0) {
            pctLabel = 'new';
        } else {
            pctLabel = ((Math.abs(after - before) / before) * 100).toFixed(1) + '%';
        }
    }

    // When original schedule was infeasible, "before" values are unreliable
    // Color the "after" value neutrally instead of red
    const afterColor = unchanged ? 'text-slate-300'
        : infeasibleBefore ? 'text-slate-200'
        : improved ? 'text-emerald-400' : 'text-amber-400';

    return (
        <div className="flex flex-col items-center gap-1"
            style={{ animation: `optCountUp 0.35s ${delay}ms cubic-bezier(0.16,1,0.3,1) both` }}
        >
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</span>
            <div className="flex items-center gap-1.5 tabular-nums">
                <span className={`text-xs line-through decoration-slate-600 ${infeasibleBefore ? 'text-slate-600' : 'text-slate-500'}`}>
                    {fmtNum(before)}{unit}
                </span>
                <TransitionArrow />
                <span className={`text-sm font-bold leading-none ${afterColor}`}>
                    {fmtNum(after)}{unit}
                </span>
            </div>
            {pctLabel && !infeasibleBefore && (
                <span className={`text-[9px] font-semibold tracking-wide ${
                    improved ? 'text-emerald-400/70' : 'text-amber-400/70'
                }`}>
                    {improved ? '\u2193' : '\u2191'} {pctLabel}
                </span>
            )}
        </div>
    );
};

const OptimizationMetrics = ({
    originalMetrics, optimizedMetrics, suggestions,
    suggestionsCount, onAccept, onReject, isApplying
}) => {
    const [mounted, setMounted] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const summary = useMemo(() => {
        if (!suggestions) return null;

        const shifted = suggestions.filter(s => s.wasShifted);

        const byAssignee = {};
        shifted.forEach(s => {
            const key = s.assignee || 'Unassigned';
            if (!byAssignee[key]) byAssignee[key] = [];
            byAssignee[key].push(s);
        });

        let totalShiftDays = 0;
        let maxShift = 0;
        shifted.forEach(s => {
            const shift = Math.abs(daysBetween(s.originalStartDate, s.suggestedStartDate));
            totalShiftDays += shift;
            if (shift > maxShift) maxShift = shift;
        });
        const avgShift = shifted.length > 0 ? Math.round(totalShiftDays / shifted.length) : 0;

        return {
            shifted, byAssignee, avgShift, maxShift,
            affectedPeople: Object.keys(byAssignee).length,
        };
    }, [suggestions]);

    if (!originalMetrics || !optimizedMetrics || !mounted || !summary) return null;

    const conflictsBefore = originalMetrics.resourceConflicts;
    const conflictsAfter = optimizedMetrics.resourceConflicts;
    const conflictsResolved = conflictsBefore - conflictsAfter;

    return (
        <>
            <style>{keyframes}</style>
            <div
                className="relative mb-4 rounded-xl overflow-hidden"
                style={{ animation: 'optPanelIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
            >
                {/* Background */}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                        backgroundSize: '128px 128px',
                    }}
                />
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5) 20%, rgba(16,185,129,0.5) 80%, transparent)' }}
                />

                <div className="relative px-5 py-4">
                    {/* ===== ROW 1: Actionable summary ===== */}
                    <div className="flex items-center gap-5">
                        {/* Title block */}
                        <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-[130px]">
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-indigo-400"
                                        style={{ animation: 'optPulseRing 2s ease-out infinite' }}
                                    />
                                </div>
                                <span className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
                                    Schedule Solver
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-500">
                                MORCPSP &middot; SSGS heuristic
                            </span>
                        </div>

                        <div className="w-px h-12 bg-slate-700/50 flex-shrink-0" />

                        {/* Summary stat cards */}
                        <div className="flex items-center gap-5 flex-1 justify-center flex-wrap"
                            style={{ animation: 'optCountUp 0.35s 80ms cubic-bezier(0.16,1,0.3,1) both' }}
                        >
                            {/* Tasks rescheduled */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Rescheduled</span>
                                <span className="text-xl font-bold text-indigo-400 tabular-nums leading-none">
                                    {suggestionsCount}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                    of {suggestions?.length || 0} tasks
                                </span>
                            </div>

                            {/* Avg shift */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Avg. Shift</span>
                                <span className="text-xl font-bold text-slate-200 tabular-nums leading-none">
                                    {summary.avgShift}d
                                </span>
                                <span className="text-[10px] text-slate-500">max {summary.maxShift}d</span>
                            </div>

                            {/* Conflicts */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Conflicts</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm text-slate-500 tabular-nums line-through">{conflictsBefore}</span>
                                    <TransitionArrow />
                                    <span className={`text-xl font-bold tabular-nums leading-none ${conflictsAfter === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {conflictsAfter}
                                    </span>
                                </div>
                                {conflictsResolved > 0 && (
                                    <span className="text-[10px] text-emerald-400/70 font-medium">{conflictsResolved} resolved</span>
                                )}
                            </div>

                            {/* People */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">People</span>
                                <span className="text-xl font-bold text-slate-200 tabular-nums leading-none">
                                    {summary.affectedPeople}
                                </span>
                                <span className="text-[10px] text-slate-500">affected</span>
                            </div>

                            {/* On time */}
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">On Time</span>
                                <div className="flex items-center gap-1.5">
                                    {conflictsBefore > 0 ? (
                                        <span className="text-sm text-slate-600 tabular-nums" title="Original schedule was infeasible">
                                            n/a
                                        </span>
                                    ) : (
                                        <span className="text-sm text-slate-500 tabular-nums line-through">
                                            {originalMetrics.tasksOnTime}/{originalMetrics.totalTasks}
                                        </span>
                                    )}
                                    <TransitionArrow />
                                    <span className={`text-lg font-bold tabular-nums leading-none ${
                                        conflictsBefore > 0 ? 'text-slate-200'
                                            : optimizedMetrics.tasksOnTime >= originalMetrics.tasksOnTime ? 'text-emerald-400' : 'text-amber-400'
                                    }`}>
                                        {optimizedMetrics.tasksOnTime}/{optimizedMetrics.totalTasks}
                                    </span>
                                </div>
                                {conflictsBefore > 0 && (
                                    <span className="text-[9px] text-slate-600">feasible schedule</span>
                                )}
                            </div>
                        </div>

                        <div className="w-px h-12 bg-slate-700/50 flex-shrink-0" />

                        {/* Actions column */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-1.5 rounded-full"
                                    style={{
                                        background: 'linear-gradient(90deg, rgba(129,140,248,0.3), rgba(129,140,248,0.6))',
                                        border: '1.5px dashed rgba(129,140,248,0.8)',
                                    }}
                                />
                                <span className="text-[10px] text-slate-500">suggested position</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onAccept}
                                    disabled={isApplying}
                                    className="group text-xs px-4 py-1.5 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50"
                                    style={{
                                        background: 'linear-gradient(135deg, #059669, #10b981)',
                                        color: 'white',
                                        boxShadow: '0 0 16px rgba(16,185,129,0.2), 0 1px 2px rgba(0,0,0,0.2)',
                                    }}
                                >
                                    <span className="flex items-center gap-1.5">
                                        {isApplying ? (
                                            <>
                                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Applying...
                                            </>
                                        ) : (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                                Apply Schedule
                                            </>
                                        )}
                                    </span>
                                </button>
                                <button
                                    onClick={onReject}
                                    disabled={isApplying}
                                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all text-slate-400 hover:text-slate-200"
                                    style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)' }}
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ===== ROW 2: Technical MORCPSP metrics ===== */}
                    <div className="mt-3 pt-3 border-t border-slate-700/40">
                        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                            <span className="text-[9px] uppercase tracking-widest text-slate-600 font-semibold">
                                Objective Function
                            </span>
                            <span className="text-[9px] text-slate-700 font-mono">
                                Z = {'\u03B1'}&middot;{'\u03A3'}(w<sub>j</sub>&middot;T<sub>j</sub>) + {'\u03B2'}&middot;C<sub>max</sub>
                                &ensp;({'\u03B1'}=0.8, {'\u03B2'}=0.2)
                            </span>
                            {conflictsBefore > 0 && (
                                <span className="text-[9px] text-amber-500/80 flex items-center gap-1 ml-2">
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <path d="M5 1L9 8.5H1L5 1Z" stroke="currentColor" strokeWidth="1" fill="none" strokeLinejoin="round"/>
                                        <circle cx="5" cy="6.5" r="0.5" fill="currentColor"/>
                                        <line x1="5" y1="3.5" x2="5" y2="5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                                    </svg>
                                    Original schedule was infeasible ({conflictsBefore} resource conflicts) — "before" metrics assume parallel execution
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-6 flex-wrap">
                            <MetricTransition
                                label={<>Weighted Tardiness <span className="normal-case text-slate-600">({'\u03A3'}w<sub>j</sub>T<sub>j</sub>)</span></>}
                                before={originalMetrics.weightedTardiness}
                                after={optimizedMetrics.weightedTardiness}
                                infeasibleBefore={conflictsBefore > 0}
                                delay={100}
                            />
                            <MetricTransition
                                label={<>Makespan <span className="normal-case text-slate-600">(C<sub>max</sub>)</span></>}
                                before={originalMetrics.makespan}
                                after={optimizedMetrics.makespan}
                                unit="d"
                                infeasibleBefore={conflictsBefore > 0}
                                delay={160}
                            />
                            <MetricTransition
                                label={<>Objective Z</>}
                                before={originalMetrics.objectiveValue}
                                after={optimizedMetrics.objectiveValue}
                                infeasibleBefore={conflictsBefore > 0}
                                delay={220}
                            />

                            <div className="w-px h-8 bg-slate-700/40 flex-shrink-0" />

                            <MetricTransition
                                label="Tasks Late"
                                before={originalMetrics.tasksLate}
                                after={optimizedMetrics.tasksLate}
                                infeasibleBefore={conflictsBefore > 0}
                                delay={280}
                            />
                            <MetricTransition
                                label="Tasks On Time"
                                before={originalMetrics.tasksOnTime}
                                after={optimizedMetrics.tasksOnTime}
                                lowerIsBetter={false}
                                infeasibleBefore={conflictsBefore > 0}
                                delay={340}
                            />

                            {/* Show details toggle */}
                            <div className="ml-auto flex-shrink-0">
                                <button
                                    onClick={() => setShowDetails(p => !p)}
                                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700/30"
                                >
                                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"
                                        className={`transition-transform duration-200 ${showDetails ? 'rotate-90' : ''}`}
                                    >
                                        <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    {showDetails ? 'Hide' : 'Show'} per-task breakdown
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ===== ROW 3: Expandable per-task detail table ===== */}
                    {showDetails && summary.shifted.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700/40">
                            <div className="grid gap-1 max-h-[220px] overflow-y-auto pr-1"
                                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(148,163,184,0.2) transparent' }}
                            >
                                {/* Header */}
                                <div className="grid grid-cols-[1fr_110px_110px_55px_55px_80px] gap-3 px-3 pb-1.5 text-[9px] uppercase tracking-wider text-slate-500 font-semibold sticky top-0 bg-slate-800/95 backdrop-blur-sm z-10">
                                    <span>Task</span>
                                    <span>Current Schedule</span>
                                    <span>Suggested Schedule</span>
                                    <span className="text-right">Shift</span>
                                    <span className="text-right">Late</span>
                                    <span className="text-right">Assignee</span>
                                </div>

                                {/* Rows sorted by largest shift first */}
                                {summary.shifted
                                    .sort((a, b) => Math.abs(daysBetween(b.originalStartDate, b.suggestedStartDate)) - Math.abs(daysBetween(a.originalStartDate, a.suggestedStartDate)))
                                    .map((s, i) => {
                                        const shift = daysBetween(s.originalStartDate, s.suggestedStartDate);
                                        return (
                                            <div key={s.taskKey}
                                                className="grid grid-cols-[1fr_110px_110px_55px_55px_80px] gap-3 px-3 py-1.5 rounded-md hover:bg-slate-700/30 transition-colors items-center"
                                                style={{ animation: `optRowIn 0.2s ${i * 25}ms cubic-bezier(0.16,1,0.3,1) both` }}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-[10px] font-bold text-slate-500 flex-shrink-0">{s.taskKey}</span>
                                                    <span className="text-xs text-slate-300 truncate">{s.summary}</span>
                                                    {s.isCritical && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" title="Critical path" />
                                                    )}
                                                    {s.priorityWeight >= 8 && (
                                                        <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold flex-shrink-0">
                                                            P{s.priorityWeight / 2}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[11px] text-slate-500 tabular-nums">
                                                    {fmtDate(s.originalStartDate)} — {fmtDate(s.originalDueDate)}
                                                </span>
                                                <span className="text-[11px] text-indigo-300 tabular-nums">
                                                    {fmtDate(s.suggestedStartDate)} — {fmtDate(s.suggestedDueDate)}
                                                </span>
                                                <span className={`text-[11px] font-semibold tabular-nums text-right ${
                                                    shift > 0 ? 'text-amber-400' : shift < 0 ? 'text-emerald-400' : 'text-slate-400'
                                                }`}>
                                                    {shift > 0 ? '+' : ''}{shift}d
                                                </span>
                                                <span className={`text-[11px] tabular-nums text-right ${
                                                    s.tardinessDays > 0 ? 'text-red-400 font-semibold' : 'text-slate-600'
                                                }`}>
                                                    {s.tardinessDays > 0 ? `+${s.tardinessDays}d` : '—'}
                                                </span>
                                                <span className="text-[10px] text-slate-500 truncate text-right" title={s.assignee || 'Unassigned'}>
                                                    {s.assignee ? s.assignee.split('@')[0] : '—'}
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
        </>
    );
};

export default React.memo(OptimizationMetrics);
