import { useCallback, useEffect, useMemo, useRef } from 'react';
import { MS_PER_DAY, dayIndex, daysBetween } from '../util/helpers';
import { TIMELINE_CONSTANTS } from '../config/timelineConstants';
import { OptimizationSuggestion, ProcessedProject } from '../types';

const { DAY_WIDTH, TIMELINE_END_PADDING } = TIMELINE_CONSTANTS;
const MIN_MONTHS = 4;

const timeOf = (date?: string | null): number | null => {
    if (!date) return null;
    const day = dayIndex(date);
    return day === null ? null : day * MS_PER_DAY;
};

interface Options {
    processedProjects: ProcessedProject[];
    suggestions: Map<string, OptimizationSuggestion> | null;
}

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
            const earliest = new Date(dates.reduce((a, b) => Math.min(a, b)));
            const latest = new Date(dates.reduce((a, b) => Math.max(a, b)));
            timelineStart = new Date(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1);
            timelineEnd = new Date(latest.getUTCFullYear(), latest.getUTCMonth() + 1, 0);

            const monthSpan = (timelineEnd.getFullYear() - timelineStart.getFullYear()) * 12
                + (timelineEnd.getMonth() - timelineStart.getMonth()) + 1;
            if (monthSpan < MIN_MONTHS) {
                timelineEnd = new Date(timelineStart.getFullYear(),
                    timelineStart.getMonth() + MIN_MONTHS, 0);
            }
        }

        const totalDays =
            daysBetween(timelineStart, timelineEnd) + 1;
        const timelineWidth = totalDays * DAY_WIDTH + TIMELINE_END_PADDING;

        return { timelineStart, timelineEnd, timelineWidth };
    }, [processedProjects, suggestions]);

    const scrollToToday = useCallback(() => {
        const timeline = timelineRef.current;
        if (!timeline) return;
        const daysFromStart =
            daysBetween(bounds.timelineStart, new Date());
        const target = Math.max(0, daysFromStart * DAY_WIDTH - timeline.clientWidth / 2);
        timeline.scrollTo({ left: target, behavior: 'smooth' });
    }, [bounds.timelineStart]);

    return {
        ...bounds,
        headerRef,
        timelineRef,
        syncScroll,
        scrollToToday,
    };
}

export default useTimelineViewport;
