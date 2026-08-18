import React, { useMemo } from 'react';
import { TIMELINE_CONSTANTS } from '../../config/timelineConstants';
import { ChevronsLeftIcon } from '../common/Icons';
import { TimelineHeaderProps } from './types';

const { DAY_WIDTH } = TIMELINE_CONSTANTS;

const TimelineHeader = ({
    timelineStart,
    timelineEnd,
    sidebarWidth,
    sidebarCollapsed,
    processedProjects,
    optimization,
    onOptimize,
    onScrollToToday,
    onSidebarToggle,
    headerRef,
    syncScroll,
}: TimelineHeaderProps) => {
    const monthElements = useMemo(() => {
        const months: React.ReactNode[] = [];
        let year = timelineStart.getFullYear(), month = timelineStart.getMonth();
        const endYear = timelineEnd.getFullYear(), endMonth = timelineEnd.getMonth();
        const today = new Date();

        while (year < endYear || (year === endYear && month <= endMonth)) {
            const currentYear = year;
            const currentMonth = month;
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const monthDate = new Date(currentYear, currentMonth, 1);

            const days = Array.from({ length: daysInMonth }, (_, i) => {
                const day = new Date(currentYear, currentMonth, i + 1);
                const isToday = today.toDateString() === day.toDateString();
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const weekendClass = isWeekend ? 'bg-slate-50/80 dark:bg-slate-800/30' : '';
                const todayClass = isToday
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-md'
                    : 'text-slate-400 dark:text-slate-500';
                return (
                    <div
                        key={`${currentYear}-${currentMonth}-${i}`}
                        className={`text-xs p-1 border-l border-slate-100 dark:border-slate-800 flex items-center justify-center ${weekendClass} ${todayClass}`}
                        style={{ width: `${DAY_WIDTH}px`, minWidth: `${DAY_WIDTH}px` }}
                    >
                        {i + 1}
                    </div>
                );
            });

            months.push(
                <div
                    key={`${year}-${month}`}
                    className="flex flex-col text-center border-r border-slate-100 dark:border-slate-800"
                    style={{ width: `${daysInMonth * DAY_WIDTH}px` }}
                >
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 px-3 py-2 bg-slate-50/50 dark:bg-slate-800/30 tracking-wide">
                        {monthDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} {year}
                    </div>
                    <div className="flex">{days}</div>
                </div>
            );

            month++;
            if (month > 11) { month = 0; year++; }
        }
        return months;
    }, [timelineStart, timelineEnd]);

    return (
        <div
            className="flex mb-4 overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
            ref={headerRef}
            onScroll={syncScroll}
        >
            <div
                className="sticky left-0 z-10 flex items-center justify-between bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-200"
                style={{ minWidth: `${sidebarWidth}px`, width: `${sidebarWidth}px` }}
            >
                <button
                    onClick={onSidebarToggle}
                    className="p-2 ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <ChevronsLeftIcon className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
                </button>
                {!sidebarCollapsed && (
                    <div className="flex items-center gap-2 pr-3">
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                            {processedProjects.length} projects
                        </span>
                        {onScrollToToday && (
                            <button
                                onClick={onScrollToToday}
                                className="text-xs px-2.5 py-1 rounded-lg font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                Today
                            </button>
                        )}
                        {!optimization?.result && (
                            <button
                                onClick={onOptimize}
                                disabled={optimization?.loading}
                                className="group text-xs px-3 py-1 rounded-lg font-semibold transition-all duration-200 disabled:opacity-60 flex items-center gap-1.5 text-white"
                                title="Optimize schedule (RCPSP solver)"
                                style={{
                                    background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                                    boxShadow: '0 1px 3px rgba(37,99,235,0.3)',
                                }}
                            >
                                {optimization?.loading ? (
                                    <>
                                        <svg className="animate-spin h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        <span>Solving...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="flex-shrink-0 transition-transform group-hover:rotate-90 duration-300">
                                            <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
                                            <circle cx="5.5" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                                            <circle cx="5.5" cy="5.5" r="1" fill="currentColor"/>
                                        </svg>
                                        <span>Optimize</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div className="flex-1 flex relative bg-white dark:bg-slate-800">{monthElements}</div>
        </div>
    );
};

export default React.memo(TimelineHeader);
