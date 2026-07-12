import { useState, useCallback, useEffect } from 'react';
import { simulateOptimization, applyOptimization } from '../util/api';
import { showToast } from '../util/toast';
import { getErrorMessage } from '../util/helpers';
import { Project, OptimizationResult, OptimizationSuggestion } from '../types';

export interface OptimizationState {
    loading: boolean;
    applying: boolean;
    result: OptimizationResult | null;
    showGhostBars: boolean;
    error: string | null;
    suggestionMap: Map<string, OptimizationSuggestion> | null;
}

const INITIAL_STATE: OptimizationState = {
    loading: false, applying: false, result: null, showGhostBars: false,
    error: null, suggestionMap: null,
};

interface UseScheduleOptimizationOptions {
    processedProjects: Project[];
    projects: Project[];
    refreshProjects: () => void;
}

export function useScheduleOptimization({ processedProjects, projects, refreshProjects }: UseScheduleOptimizationOptions) {
    const [optimization, setOptimization] = useState<OptimizationState>(INITIAL_STATE);

    const handleOptimize = useCallback(async () => {
        setOptimization(prev => ({ ...prev, loading: true, error: null }));
        try {
            const projectKeys = processedProjects.map(p => p.projectKey);
            const result: OptimizationResult = await simulateOptimization({ projectKeys, alpha: 0.8, beta: 0.2 });

            // Pre-build Map for O(1) ghost bar lookups in TimelineView
            const suggestionMap = new Map<string, OptimizationSuggestion>();
            if (result?.suggestions) {
                for (const s of result.suggestions) {
                    if (s.wasShifted) suggestionMap.set(s.taskKey, s);
                }
            }

            const shiftedCount = suggestionMap.size;
            if (shiftedCount === 0) {
                showToast('Schedule is already optimal — no changes needed.', 'info');
                setOptimization(prev => ({ ...prev, loading: false }));
                return;
            }

            setOptimization({
                loading: false, applying: false, result, showGhostBars: true,
                error: null, suggestionMap,
            });
        } catch (err) {
            const msg = getErrorMessage(err);
            showToast(msg, 'error');
            setOptimization(prev => ({ ...prev, loading: false, error: msg }));
        }
    }, [processedProjects]);

    const handleAcceptOptimization = useCallback(async () => {
        if (!optimization.result?.suggestions) return;
        setOptimization(prev => ({ ...prev, applying: true }));
        try {
            await applyOptimization(optimization.result.suggestions);
            setOptimization(INITIAL_STATE);
            refreshProjects();
            showToast('Schedule optimized successfully.', 'success');
        } catch (err) {
            const msg = getErrorMessage(err);
            showToast(msg, 'error');
            setOptimization(prev => ({ ...prev, applying: false, error: msg }));
        }
    }, [optimization.result, refreshProjects]);

    const handleRejectOptimization = useCallback(() => {
        setOptimization(INITIAL_STATE);
    }, []);

    // Clear optimization results when underlying data changes
    useEffect(() => {
        if (optimization.result) {
            setOptimization(prev => ({
                ...prev, result: null, showGhostBars: false, suggestionMap: null,
            }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projects]);

    return { optimization, handleOptimize, handleAcceptOptimization, handleRejectOptimization };
}
