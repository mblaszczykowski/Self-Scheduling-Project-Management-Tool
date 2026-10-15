import { act, renderHook } from '@testing-library/react';
import { useScheduleOptimization } from './useScheduleOptimization';
import { simulateOptimization, applyOptimization } from '../util/api';
import { OptimizationResult, ProcessedProject } from '../types';

jest.mock('../util/api', () => ({ simulateOptimization: jest.fn(), applyOptimization: jest.fn() }));
jest.mock('../util/toast', () => ({ showToast: jest.fn() }));
const simulate = jest.mocked(simulateOptimization);
const apply = jest.mocked(applyOptimization);
const project: ProcessedProject = { id: 1, projectKey: 'WEB', summary: 'Web', tasks: [], members: [], attachments: [], dependencies: [], projectProgress: 0 };
const metrics = { weightedTardiness: 0, makespan: 1, objectiveValue: 0, totalTasks: 1, tasksOnTime: 1, tasksLate: 0, resourceConflicts: 0, feasible: true };
const preview: OptimizationResult = {
    previewToken: 'verified-preview', originalMetrics: metrics, optimizedMetrics: metrics,
    tasksShifted: 1, skippedTaskKeys: [], suggestions: [{ taskKey: 'WEB-1', projectKey: 'WEB',
        suggestedStartDate: '2026-10-16', suggestedDueDate: '2026-10-17', priorityWeight: 1, tardinessDays: 0, isCritical: false, wasShifted: true }],
};

test('ignores a simulation completed after a project dependency changes', async () => {
    let finish: (result: OptimizationResult) => void = () => {};
    simulate.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const onApplied = jest.fn();
    const { result, rerender } = renderHook(({ current }) => useScheduleOptimization({ processedProjects: [current], onApplied }), { initialProps: { current: project } });
    let pending: Promise<void>;
    act(() => { pending = result.current.handleOptimize(); });
    expect(result.current.optimization.loading).toBe(true);
    rerender({ current: { ...project, dependencies: ['OTHER'] } });
    await act(async () => { finish(preview); await pending; });
    expect(result.current.optimization.result).toBeNull();
    expect(result.current.optimization.loading).toBe(false);
});

test('sends the exact preview token and prevents duplicate apply requests', async () => {
    simulate.mockResolvedValue(preview);
    let finish: () => void = () => {};
    apply.mockReturnValue(new Promise(resolve => { finish = () => resolve({ tasksUpdated: 1 }); }));
    const onApplied = jest.fn();
    const { result } = renderHook(() => useScheduleOptimization({ processedProjects: [project], onApplied }));
    await act(async () => { await result.current.handleOptimize(); });
    let pending: Promise<void>;
    act(() => {
        pending = result.current.handleAcceptOptimization();
        result.current.handleAcceptOptimization();
    });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({ projectKeys: ['WEB'], acceptedTaskKeys: ['WEB-1'], previewToken: 'verified-preview' });
    await act(async () => { finish(); await pending; });
    expect(onApplied).toHaveBeenCalledTimes(1);
});
