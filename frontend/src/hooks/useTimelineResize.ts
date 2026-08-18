import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ResizeSide } from '../components/projects/types';

interface Options {
    onResizeMove: (taskKey: string, projectKey: string, side: ResizeSide, deltaDays: number) => void;
    onResizeEnd: () => void;
    dayWidth: number;
}

/**
 * Turns a mouse drag on a Gantt bar edge into whole-day deltas.
 *
 * The in-progress drag lives in refs, not state, so the document listeners are attached once per
 * drag rather than being torn down and re-added on every pixel of movement — and so a background
 * refetch mid-drag cannot resubscribe them either.
 */
export const useTimelineResize = ({ onResizeMove, onResizeEnd, dayWidth }: Options) => {
    const [isResizing, setIsResizing] = useState(false);
    const dragRef = useRef<{ taskKey: string; projectKey: string; side: ResizeSide; anchorX: number } | null>(null);
    // Set briefly after a drag so the click that follows mouseup does not open the task modal.
    const justFinishedRef = useRef(false);
    const clickSuppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callbacksRef = useRef({ onResizeMove, onResizeEnd });
    callbacksRef.current = { onResizeMove, onResizeEnd };

    const startResize = useCallback((
        event: ReactMouseEvent,
        taskKey: string,
        projectKey: string,
        side: ResizeSide,
    ) => {
        event.preventDefault();
        event.stopPropagation();
        dragRef.current = { taskKey, projectKey, side, anchorX: event.clientX };
        justFinishedRef.current = false;
        setIsResizing(true);
    }, []);

    const shouldPreventClick = useCallback(
        () => dragRef.current !== null || justFinishedRef.current, []);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (event: MouseEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const deltaDays = Math.round((event.clientX - drag.anchorX) / dayWidth);
            if (deltaDays === 0) return;
            // Re-anchor so the next delta is measured from here, keeping the bar under the cursor.
            drag.anchorX = event.clientX;
            callbacksRef.current.onResizeMove(drag.taskKey, drag.projectKey, drag.side, deltaDays);
        };

        const handleMouseUp = () => {
            dragRef.current = null;
            justFinishedRef.current = true;
            clickSuppressTimerRef.current = setTimeout(() => {
                justFinishedRef.current = false;
            }, 100);
            setIsResizing(false);
            callbacksRef.current.onResizeEnd();
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, dayWidth]);

    useEffect(() => () => {
        if (clickSuppressTimerRef.current) clearTimeout(clickSuppressTimerRef.current);
    }, []);

    return { startResize, isResizing, shouldPreventClick };
};

export default useTimelineResize;
