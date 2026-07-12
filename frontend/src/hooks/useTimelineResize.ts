import { useState, useRef, useEffect, useCallback, MouseEvent as ReactMouseEvent } from 'react';

type ResizeSide = 'left' | 'right';
interface ResizeState {
    taskKey: string;
    projectKey: string;
    side: ResizeSide;
    startX: number;
}

interface UseTimelineResizeOptions {
    onResizeMove?: (taskKey: string, projectKey: string, side: ResizeSide, deltaDays: number) => void;
    onResizeEnd?: () => void;
    dayWidth?: number;
}

export const useTimelineResize = ({ onResizeMove, onResizeEnd, dayWidth = 25 }: UseTimelineResizeOptions) => {
    const [resizeState, setResizeState] = useState<ResizeState | null>(null);
    const isResizingRef = useRef(false);
    const wasResizingRef = useRef(false);

    const startResize = useCallback((event: ReactMouseEvent, taskKey: string, projectKey: string, side: ResizeSide) => {
        event.preventDefault();
        event.stopPropagation();
        isResizingRef.current = true;
        wasResizingRef.current = false;
        setResizeState({
            taskKey,
            projectKey,
            side,
            startX: event.clientX,
        });
    }, []);

    const shouldPreventClick = useCallback(() => {
        return isResizingRef.current || wasResizingRef.current;
    }, []);

    useEffect(() => {
        if (!resizeState) return;

        const handleMouseMove = (event: MouseEvent) => {
            const { taskKey, projectKey, side, startX } = resizeState;
            const deltaDays = Math.round((event.clientX - startX) / dayWidth);

            if (deltaDays === 0) return;

            setResizeState(prev => ({ ...prev, startX: event.clientX }));
            onResizeMove?.(taskKey, projectKey, side, deltaDays);
        };

        const handleMouseUp = () => {
            isResizingRef.current = false;
            wasResizingRef.current = true;

            setTimeout(() => {
                wasResizingRef.current = false;
            }, 100);

            onResizeEnd?.();
            setResizeState(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizeState, dayWidth, onResizeMove, onResizeEnd]);

    return {
        startResize,
        resizeState,
        isResizing: resizeState !== null,
        shouldPreventClick,
    };
};

export default useTimelineResize;
