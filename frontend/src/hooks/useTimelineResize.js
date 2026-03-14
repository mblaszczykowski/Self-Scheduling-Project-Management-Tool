import { useState, useRef, useEffect, useCallback } from 'react';

export const useTimelineResize = ({ onResizeMove, onResizeEnd, dayWidth = 25 }) => {
    const [resizeState, setResizeState] = useState(null);
    const isResizingRef = useRef(false);
    const wasResizingRef = useRef(false);

    const startResize = useCallback((event, taskKey, projectKey, side) => {
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

        const handleMouseMove = (event) => {
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
