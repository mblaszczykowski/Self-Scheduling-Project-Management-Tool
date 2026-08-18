import { useCallback, useEffect, useState } from 'react';
import { applyOptimization, simulateOptimization } from '../util/api';
import { getErrorMessage } from '../util/helpers';
import { showToast } from '../util/toast';
import { OptimizationResult, OptimizationSuggestion, ProcessedProject } from '../types';

export interface OptimizationState {
    loading: boolean;
    applying: boolean;
    result: OptimizationResult | null;
    showGhostBars: boolean;
    error: string | null;
    /** Shifted suggestions by task key, for O(1) ghost-bar lookups while rendering the timeline. */
    suggestionMap: Map<string, OptimizationSuggestion> | null;
}

const INITIAL_STATE: OptimizationState = {
    loading: false, applying: false, result: null, showGhostBars: false,
    error: null, suggestionMap: null,
};

interface Options {
    processedProjects: ProcessedProject[];
    /** Invalidates the project cache after an applied schedule. */
    onApplied: () => void | Promise<unknown>;
}

export function useScheduleOptimization({ processedProjects, onApplied }: Options) {
    const [optimization, setOptimization] = useState<OptimizationState>(INITIAL_STATE);

    const handleOptimize = useCallback(async () => {
        setOptimization((previous) => ({ ...previous, loading: true, error: null }));
        try {
            const projectKeys = processedProjects.map((project) => project.projectKey);
            // alpha/beta are omitted so the server's configured defaults apply; hard-coding them
            // here made that configuration dead.
            const result = await simulateOptimization({ projectKeys });

            const suggestionMap = new Map<string, OptimizationSuggestion>();
            result.suggestions.filter((suggestion) => suggestion.wasShifted)
                .forEach((suggestion) => suggestionMap.set(suggestion.taskKey, suggestion));

            if (suggestionMap.size === 0) {
                showToast('Schedule is already optimal — no changes needed.', 'info');
                setOptimization((previous) => ({ ...previous, loading: false, result }));
                return;
            }

            setOptimization({
                loading: false, applying: false, result, showGhostBars: true,
                error: null, suggestionMap,
            });
        } catch (err) {
            const message = getErrorMessage(err);
            showToast(message, 'error');
            setOptimization((previous) => ({ ...previous, loading: false, error: message }));
        }
    }, [processedProjects]);

    const handleAcceptOptimization = useCallback(async () => {
        const suggestionMap = optimization.suggestionMap;
        if (!suggestionMap || suggestionMap.size === 0) return;

        setOptimization((previous) => ({ ...previous, applying: true }));
        try {
            // The server recomputes the schedule from these inputs rather than trusting dates the
            // browser echoes back, so what is persisted is feasible by construction.
            const { tasksUpdated } = await applyOptimization({
                projectKeys: processedProjects.map((project) => project.projectKey),
                acceptedTaskKeys: [...suggestionMap.keys()],
            });
            setOptimization(INITIAL_STATE);
            await onApplied();
            showToast(tasksUpdated > 0
                ? `Rescheduled ${tasksUpdated} task${tasksUpdated === 1 ? '' : 's'}.`
                : 'Nothing left to reschedule.', 'success');
        } catch (err) {
            const message = getErrorMessage(err);
            showToast(message, 'error');
            setOptimization((previous) => ({ ...previous, applying: false, error: message }));
        }
    }, [optimization.suggestionMap, processedProjects, onApplied]);

    const handleRejectOptimization = useCallback(() => setOptimization(INITIAL_STATE), []);

    // A proposal describes one particular arrangement of tasks; once that changes it is stale.
    useEffect(() => {
        setOptimization((previous) => (previous.result
            ? { ...previous, result: null, showGhostBars: false, suggestionMap: null }
            : previous));
    }, [processedProjects]);

    return { optimization, handleOptimize, handleAcceptOptimization, handleRejectOptimization };
}

export default useScheduleOptimization;
