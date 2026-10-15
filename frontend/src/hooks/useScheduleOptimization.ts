import { useCallback, useEffect, useRef, useState } from 'react';
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
    suggestionMap: Map<string, OptimizationSuggestion> | null;
}

const INITIAL_STATE: OptimizationState = {
    loading: false, applying: false, result: null, showGhostBars: false,
    error: null, suggestionMap: null,
};

interface Options {
    processedProjects: ProcessedProject[];
    onApplied: () => void | Promise<unknown>;
}

const scheduleFingerprint = (projects: ProcessedProject[]): string => JSON.stringify(
    projects.map(project => ({
        key: project.projectKey,
        dependencies: project.dependencies,
        tasks: project.tasks.map(task => ({
            key: task.taskKey, updated: task.updated, start: task.startDate, due: task.dueDate,
            dependencies: task.dependencyKeys, progress: task.progress, status: task.status,
        })),
    })),
);

export function useScheduleOptimization({ processedProjects, onApplied }: Options) {
    const [optimization, setOptimization] = useState<OptimizationState>(INITIAL_STATE);
    const operationRef = useRef(0);
    const busyRef = useRef(false);
    const applyingRef = useRef(false);
    const fingerprint = scheduleFingerprint(processedProjects);
    const fingerprintRef = useRef(fingerprint);
    fingerprintRef.current = fingerprint;
    useEffect(() => () => { operationRef.current++; }, []);

    const handleOptimize = useCallback(async () => {
        if (busyRef.current) return;
        if (processedProjects.length > 50) {
            showToast('Filter to a project before optimizing more than 50 projects.', 'info');
            return;
        }
        if (processedProjects.length === 0) return;
        busyRef.current = true;
        const operation = ++operationRef.current;
        const simulatedFingerprint = fingerprintRef.current;
        setOptimization({ ...INITIAL_STATE, loading: true });
        try {
            const projectKeys = processedProjects.map((project) => project.projectKey);
            const result = await simulateOptimization({ projectKeys });
            if (operation !== operationRef.current || simulatedFingerprint !== fingerprintRef.current) return;

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
            if (operation !== operationRef.current) return;
            const message = getErrorMessage(err);
            showToast(message, 'error');
            setOptimization((previous) => ({ ...previous, loading: false, error: message }));
        } finally {
            if (operation === operationRef.current) busyRef.current = false;
        }
    }, [processedProjects]);

    const handleAcceptOptimization = useCallback(async () => {
        const suggestionMap = optimization.suggestionMap;
        if (!suggestionMap || suggestionMap.size === 0 || busyRef.current) return;
        busyRef.current = true;
        applyingRef.current = true;

        setOptimization((previous) => ({ ...previous, applying: true }));
        try {
            const { tasksUpdated } = await applyOptimization({
                projectKeys: processedProjects.map((project) => project.projectKey),
                acceptedTaskKeys: [...suggestionMap.keys()],
                previewToken: optimization.result?.previewToken,
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
        } finally {
            busyRef.current = false;
            applyingRef.current = false;
        }
    }, [optimization.suggestionMap, optimization.result?.previewToken, processedProjects, onApplied]);

    const handleRejectOptimization = useCallback(() => {
        if (busyRef.current) return;
        operationRef.current++;
        setOptimization(INITIAL_STATE);
    }, []);

    const previousFingerprintRef = useRef<string | null>(null);
    useEffect(() => {
        const changed = previousFingerprintRef.current !== null
            && previousFingerprintRef.current !== fingerprint;
        previousFingerprintRef.current = fingerprint;
        if (!changed || applyingRef.current) return;
        // A simulation that finishes after any schedule edit is no longer a usable preview.
        operationRef.current++;
        busyRef.current = false;
        setOptimization(previous => previous.applying ? previous : INITIAL_STATE);
    }, [fingerprint]);

    return { optimization, handleOptimize, handleAcceptOptimization, handleRejectOptimization };
}

export default useScheduleOptimization;
