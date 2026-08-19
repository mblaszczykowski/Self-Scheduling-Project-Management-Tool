import { RefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import { MS_PER_DAY } from '../util/helpers';
import { TIMELINE_CONSTANTS } from '../config/timelineConstants';
import { OptimizationSuggestion, ProcessedProject } from '../types';

const { DAY_WIDTH, TIMELINE_END_PADDING } = TIMELINE_CONSTANTS;
const MIN_MONTHS = 4;

const timeOf = (date?: string | null): number | null => {
    if (!date) return null;
    const parsed = new Date(date).getTime();
    return Number.isNaN(parsed) ? null : parsed;
};

interface Options {
    processedProjects: ProcessedProject[];
    /** Ghost bars extend the visible range, so proposed dates count towards the bounds. */
    suggestions: Map<string, OptimizationSuggestion> | null;
}

/**
 * Computes the timeline's date range and pixel width, and keeps the sticky header's horizontal
 * scroll in step with the body.
 */
export function useTimelineViewport({ processedProjects, suggestions }: Options) {
    const headerRef = useRef<HTMLDivElement | null>(null);
    const timelineRef = useRef<HTMLDivElement | null>(null);
    const scrollFrameRef = useRef<number | null>(null);

    const syncScroll = useCallback(() => {
        if (scrollFrameRef.current !== null) return;
        scrollFrameRef.current = requestAnimationFrame(() => {
            scrollFrameRef.current = null;
            if (headerRef.current && timelineRef.current) {
                headerRef.current.scrollLeft = timelineRef.current.scrollLeft;
            }
        });
    }, []);

    useEffect(() => () => {
        if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    }, []);

    const bounds = useMemo(() => {
        const dates: number[] = [];
        processedProjects.forEach((project) => project.tasks.forEach((task) => {
            const start = timeOf(task.startDate);
            const due = timeOf(task.dueDate);
            if (start !== null) dates.push(start);
            if (due !== null) dates.push(due);
        }));
        suggestions?.forEach((suggestion) => {
            const start = timeOf(suggestion.suggestedStartDate);
            const due = timeOf(suggestion.suggestedDueDate);
            if (start !== null) dates.push(start);
            if (due !== null) dates.push(due);
        });

        const today = new Date();
        let timelineStart: Date;
        let timelineEnd: Date;

        if (dates.length === 0) {
            timelineStart = new Date(today.getFullYear(), today.getMonth(), 1);
            timelineEnd = new Date(today.getFullYear(), today.getMonth() + MIN_MONTHS, 0);
        } else {
            // Reduce rather than spread: Math.min(...dates) overflows the argument limit on a
            // portfolio with tens of thousands of dates.
            const earliest = new Date(dates.reduce((a, b) => Math.min(a, b)));
            const latest = new Date(dates.reduce((a, b) => Math.max(a, b)));
            timelineStart = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
            timelineEnd = new Date(latest.getFullYear(), latest.getMonth() + 1, 0);

            const monthSpan = (timelineEnd.getFullYear() - timelineStart.getFullYear()) * 12
                + (timelineEnd.getMonth() - timelineStart.getMonth()) + 1;
            if (monthSpan < MIN_MONTHS) {
                timelineEnd = new Date(timelineStart.getFullYear(),
                    timelineStart.getMonth() + MIN_MONTHS, 0);
            }
        }

        // Inclusive day count spanned by the two whole-month bounds above, matching the day-cell
        // count TimelineHeader sums from the same months.
        const totalDays =
            Math.round((timelineEnd.getTime() - timelineStart.getTime()) / MS_PER_DAY) + 1;
        // The shared day-area width: both TimelineHeader and the body rows apply this unmodified.
        const timelineWidth = totalDays * DAY_WIDTH + TIMELINE_END_PADDING;

        return { timelineStart, timelineEnd, timelineWidth };
    }, [processedProjects, suggestions]);

    const scrollToToday = useCallback(() => {
        const timeline = timelineRef.current;
        if (!timeline) return;
        const daysFromStart =
            Math.round((Date.now() - bounds.timelineStart.getTime()) / MS_PER_DAY);
        const target = Math.max(0, daysFromStart * DAY_WIDTH - timeline.clientWidth / 2);
        timeline.scrollTo({ left: target, behavior: 'smooth' });
    }, [bounds.timelineStart]);

    return {
        ...bounds,
        headerRef: headerRef as RefObject<HTMLDivElement>,
        timelineRef: timelineRef as RefObject<HTMLDivElement>,
        syncScroll,
        scrollToToday,
    };
}

export default useTimelineViewport;
