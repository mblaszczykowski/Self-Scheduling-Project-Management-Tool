import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook for handling timeline task resizing via drag.
 * Extracts mouse event handling logic from UnifiedView component.
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onResizeMove - Callback when task is being resized (taskKey, projectKey, side, deltaDays)
 * @param {Function} options.onResizeEnd - Optional callback when resize ends
 * @param {number} options.dayWidth - Width of one day in pixels (default: 25)
 */
export const useTimelineResize = ({ onResizeMove, onResizeEnd, dayWidth = 25 }) => {
    const [resizeState, setResizeState] = useState(null);
    const isResizingRef = useRef(false);
    const wasResizingRef = useRef(false);

    /**
     * Starts the resize operation.
     * Call this on mousedown of resize handles.
     */
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

    /**
     * Checks if a click should be prevented due to recent resize.
     * Use this to prevent opening modals after resize ends.
     */
    const shouldPreventClick = useCallback(() => {
        return isResizingRef.current || wasResizingRef.current;
    }, []);

    useEffect(() => {
        if (!resizeState) return;

        const handleMouseMove = (event) => {
            const { taskKey, projectKey, side, startX } = resizeState;
            const deltaDays = Math.round((event.clientX - startX) / dayWidth);

            if (deltaDays === 0) return;

            // Update start position for next calculation
            setResizeState(prev => ({ ...prev, startX: event.clientX }));

            // Notify parent of resize movement
            onResizeMove?.(taskKey, projectKey, side, deltaDays);
        };

        const handleMouseUp = () => {
            isResizingRef.current = false;
            wasResizingRef.current = true;

            // Clear the "was resizing" flag after a short delay
            // This prevents click events from firing immediately after resize
            setTimeout(() => {
                wasResizingRef.current = false;
            }, 100);

            // Notify parent that resize ended
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
