import React, { useMemo } from 'react';
import { TIMELINE_CONSTANTS } from '../../config/timelineConstants';
import { ChevronsLeftIcon } from '../common/Icons';

const { DAY_WIDTH } = TIMELINE_CONSTANTS;

const TimelineHeader = ({
    timelineStart,
    timelineEnd,
    sidebarWidth,
    sidebarCollapsed,
    processedProjects,
    optimization,
    onOptimize,
    onSidebarToggle,
    headerRef,
    syncScroll,
}) => {
    const monthElements = useMemo(() => {
        const months = [];
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
                const weekendClass = isWeekend ? 'bg-slate-50' : '';
                const todayClass = isToday
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-500';
                const dayClassName = `text-xs p-1 border-l border-slate-200 flex items-center justify-center ${
                    weekendClass
                } ${todayClass}`;
                return (
                    <div
                        key={`${currentYear}-${currentMonth}-${i}`}
                        className={dayClassName}
                        style={{ width: `${DAY_WIDTH}px`, minWidth: `${DAY_WIDTH}px` }}
                    >
                        {i + 1}
                    </div>
                );
            });

            const monthHeaderClass = 'text-xs font-semibold text-slate-700 border-b border-slate-200 p-2 bg-white';
            months.push(
                <div
                    key={`${year}-${month}`}
                    className="flex flex-col text-center border-r border-slate-200"
                    style={{ width: `${daysInMonth * DAY_WIDTH}px` }}
                >
                    <div className={monthHeaderClass}>
                        {monthDate.toLocaleDateString('default', { month: 'short' }).toUpperCase()} {year}
                    </div>
                    <div className="flex">{days}</div>
                </div>
            );

            month++;
            if (month > 11) { month = 0; year++; }
        }
        return months;
    }, [timelineStart, timelineEnd]);

    const headerSidebarClass = 'sticky left-0 z-10 flex items-center justify-between bg-white border-r border-slate-200 transition-all duration-200';

    return (
        <div
            className="flex mb-3 overflow-hidden rounded-lg border border-slate-200 bg-white"
            ref={headerRef}
            onScroll={syncScroll}
        >
            <div
                className={headerSidebarClass}
                style={{ minWidth: `${sidebarWidth}px`, width: `${sidebarWidth}px` }}
            >
                <button
                    onClick={onSidebarToggle}
                    className="p-2 ml-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <ChevronsLeftIcon
                        className={`w-4 h-4 transition-transform ${
                            sidebarCollapsed ? 'rotate-180' : ''
                        }`}
                    />
                </button>
                {!sidebarCollapsed && (
                    <div className="flex items-center gap-2.5 pr-3">
                        <span className="text-xs text-slate-500">
                            {processedProjects.length} projects
                        </span>
                        {!optimization?.result && (
                            <button
                                onClick={onOptimize}
                                disabled={optimization?.loading}
                                className="group relative text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all duration-200 disabled:opacity-60 flex items-center gap-1.5 text-white overflow-hidden"
                                title="Optimize schedule across all projects (RCPSP solver)"
                                style={{
                                    background: optimization?.loading
                                        ? 'linear-gradient(135deg, #4338ca, #6366f1)'
                                        : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                    boxShadow: optimization?.loading
                                        ? '0 0 12px rgba(99,102,241,0.3)'
                                        : '0 1px 3px rgba(79,70,229,0.3)',
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
            <div className="flex-1 flex relative bg-white">{monthElements}</div>
        </div>
    );
};

export default React.memo(TimelineHeader);
