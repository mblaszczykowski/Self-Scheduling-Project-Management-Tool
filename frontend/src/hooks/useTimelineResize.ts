import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ResizeSide } from '../components/projects/types';

interface Options {
    onResizeMove: (taskKey: string, projectKey: string, side: ResizeSide, deltaDays: number) => void;
    onResizeEnd: () => void;
    /** Abandons the drag without writing: Escape, a cancelled pointer, or a lost capture. */
    onResizeCancel: () => void;
    dayWidth: number;
}

interface Drag {
    taskKey: string;
    projectKey: string;
    side: ResizeSide;
    anchorX: number;
    pointerId: number;
    target: Element;
}

/**
 * Turns a pointer drag on a Gantt bar edge into whole-day deltas.
 *
 * The in-progress drag lives in refs, not state, so the listeners are attached once per drag rather
 * than being torn down and re-added on every pixel of movement — and so a background refetch
 * mid-drag cannot resubscribe them either.
 *
 * The drag captures the pointer. Without capture, a release outside the window never reaches a
 * document-level listener: `pointermove` keeps firing with no button held, the bar follows the
 * cursor, and the next click anywhere commits dates the user never chose. Capture guarantees a
 * terminating `pointerup` or `lostpointercapture`, and Escape abandons the drag without writing.
 */
export const useTimelineResize = ({ onResizeMove, onResizeEnd, onResizeCancel, dayWidth }: Options) => {
    const [isResizing, setIsResizing] = useState(false);
    const dragRef = useRef<Drag | null>(null);
    // Set briefly after a drag so the click that follows the release does not open the task modal.
    const justFinishedRef = useRef(false);
    const clickSuppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callbacksRef = useRef({ onResizeMove, onResizeEnd, onResizeCancel });
    callbacksRef.current = { onResizeMove, onResizeEnd, onResizeCancel };

    const startResize = useCallback((
        event: ReactPointerEvent,
        taskKey: string,
        projectKey: string,
        side: ResizeSide,
    ) => {
        event.preventDefault();
        event.stopPropagation();
        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);
        dragRef.current = {
            taskKey, projectKey, side,
            anchorX: event.clientX,
            pointerId: event.pointerId,
            target,
        };
        justFinishedRef.current = false;
        setIsResizing(true);
    }, []);

    const shouldPreventClick = useCallback(
        () => dragRef.current !== null || justFinishedRef.current, []);

    useEffect(() => {
        if (!isResizing) return;

        const finish = (commit: boolean) => {
            const drag = dragRef.current;
            if (!drag) return;
            dragRef.current = null;
            if (drag.target.hasPointerCapture(drag.pointerId)) {
                drag.target.releasePointerCapture(drag.pointerId);
            }
            justFinishedRef.current = true;
            clickSuppressTimerRef.current = setTimeout(() => {
                justFinishedRef.current = false;
            }, 100);
            setIsResizing(false);
            if (commit) callbacksRef.current.onResizeEnd();
            else callbacksRef.current.onResizeCancel();
        };

        const handlePointerMove = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag || event.pointerId !== drag.pointerId) return;
            const deltaDays = Math.round((event.clientX - drag.anchorX) / dayWidth);
            if (deltaDays === 0) return;
            // Re-anchor so the next delta is measured from here, keeping the bar under the cursor.
            drag.anchorX = event.clientX;
            callbacksRef.current.onResizeMove(drag.taskKey, drag.projectKey, drag.side, deltaDays);
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (dragRef.current && event.pointerId !== dragRef.current.pointerId) return;
            finish(true);
        };

        // Fires after pointerup's implicit release too, where finish() has already cleared the
        // drag and this is a no-op; it only does work when capture is lost without a release.
        const handleCaptureLost = () => finish(false);
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') finish(false);
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        document.addEventListener('pointercancel', handleCaptureLost);
        document.addEventListener('lostpointercapture', handleCaptureLost);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleCaptureLost);
        return () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
            document.removeEventListener('pointercancel', handleCaptureLost);
            document.removeEventListener('lostpointercapture', handleCaptureLost);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleCaptureLost);
        };
    }, [isResizing, dayWidth]);

    useEffect(() => () => {
        if (clickSuppressTimerRef.current) clearTimeout(clickSuppressTimerRef.current);
    }, []);

    return { startResize, isResizing, shouldPreventClick };
};

export default useTimelineResize;
