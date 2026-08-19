import { useCallback, useMemo, useRef, useState } from 'react';
import { addDays } from '../util/helpers';
import { showToast } from '../util/toast';
import { useTimelineResize } from './useTimelineResize';
import { TIMELINE_CONSTANTS } from '../config/timelineConstants';
import { ResizeSide } from '../components/projects/types';
import { ProcessedProject } from '../types';

interface Options {
    processedProjects: ProcessedProject[];
    /** Commits the drag. Only the dates are sent, so nothing else can be reset by accident. */
    updateTaskSchedule: (projectKey: string, taskKey: string, startDate: string, dueDate: string) => Promise<unknown>;
}

interface Draft {
    taskKey: string;
    projectKey: string;
    originalStartDate: string;
    originalDueDate: string;
    startDate: string;
    dueDate: string;
}

/**
 * Optimistic drag-to-reschedule.
 *
 * Each drag step updates a local preview only, and one request is sent when the drag ends —
 * replacing a per-step write-and-refetch that turned a single drag into N round trips. The
 * preview is overlaid on the rendered projects so the bar follows the cursor without the cache
 * being touched until the drag commits.
 */
export function useTaskResizePreview({ processedProjects, updateTaskSchedule }: Options) {
    const [preview, setPreview] = useState<Draft | null>(null);
    const draftRef = useRef<Draft | null>(null);

    const handleResizeMove = useCallback((
        taskKey: string,
        projectKey: string,
        side: ResizeSide,
        deltaDays: number,
    ) => {
        let draft = draftRef.current;
        if (!draft || draft.taskKey !== taskKey) {
            const task = processedProjects
                .find((project) => project.projectKey === projectKey)?.tasks
                .find((candidate) => candidate.taskKey === taskKey);
            if (!task?.startDate || !task.dueDate) return;
            draft = {
                taskKey,
                projectKey,
                originalStartDate: task.startDate,
                originalDueDate: task.dueDate,
                startDate: task.startDate,
                dueDate: task.dueDate,
            };
        }

        const shift = (date: string) => addDays(date, deltaDays);

        if (side === 'left') {
            const next = shift(draft.startDate);
            // An edge may never cross the other one.
            if (next <= draft.dueDate) draft = { ...draft, startDate: next };
        } else {
            const next = shift(draft.dueDate);
            if (next >= draft.startDate) draft = { ...draft, dueDate: next };
        }

        draftRef.current = draft;
        setPreview(draft);
    }, [processedProjects]);

    const handleResizeEnd = useCallback(() => {
        const draft = draftRef.current;
        draftRef.current = null;
        if (!draft) return;

        if (draft.startDate === draft.originalStartDate && draft.dueDate === draft.originalDueDate) {
            setPreview(null);
            return;
        }

        updateTaskSchedule(draft.projectKey, draft.taskKey, draft.startDate, draft.dueDate)
            .then(() => showToast('Task dates updated', 'success'))
            .catch(() => showToast('Could not update the task dates.', 'error'))
            // Either way the refreshed cache — or the unchanged server state on failure — becomes
            // the source of truth again.
            .finally(() => setPreview(null));
    }, [updateTaskSchedule]);

    const handleResizeCancel = useCallback(() => {
        draftRef.current = null;
        setPreview(null);
    }, []);

    const { startResize, shouldPreventClick } = useTimelineResize({
        onResizeMove: handleResizeMove,
        onResizeEnd: handleResizeEnd,
        onResizeCancel: handleResizeCancel,
        dayWidth: TIMELINE_CONSTANTS.DAY_WIDTH,
    });

    const displayProjects = useMemo(() => {
        if (!preview) return processedProjects;
        return processedProjects.map((project) => (project.projectKey !== preview.projectKey
            ? project
            : {
                ...project,
                tasks: project.tasks.map((task) => (task.taskKey === preview.taskKey
                    ? { ...task, startDate: preview.startDate, dueDate: preview.dueDate }
                    : task)),
            }));
    }, [processedProjects, preview]);

    return { displayProjects, startResize, shouldPreventClick, draggingTaskKey: preview?.taskKey ?? null };
}

export default useTaskResizePreview;
