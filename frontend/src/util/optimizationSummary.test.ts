import { summarizeOptimization } from './optimizationSummary';
import { OptimizationSuggestion } from '../types';

const suggestion = (
    overrides: Partial<OptimizationSuggestion> & Pick<OptimizationSuggestion, 'taskKey'>,
): OptimizationSuggestion => ({
    projectKey: 'P',
    suggestedStartDate: '2024-06-01',
    suggestedDueDate: '2024-06-05',
    priorityWeight: 5,
    tardinessDays: 0,
    isCritical: false,
    wasShifted: true,
    ...overrides,
});

describe('summarizeOptimization', () => {
    test('an empty suggestion list summarises to all zeros', () => {
        expect(summarizeOptimization([])).toEqual({
            shifted: [],
            byAssignee: {},
            avgShift: 0,
            maxShift: 0,
            affectedPeople: 0,
        });
    });

    test('suggestions the optimizer left in place are excluded entirely', () => {
        const unshifted = suggestion({
            taskKey: 'T5', assignee: 'carol@x.com',
            originalStartDate: '2024-06-01', suggestedStartDate: '2024-06-02',
            wasShifted: false,
        });
        const result = summarizeOptimization([unshifted]);
        expect(result.shifted).toEqual([]);
        expect(result.byAssignee).toEqual({});
    });

    test('shiftDays is signed: positive when the suggested start is later, negative when earlier', () => {
        const later = suggestion({
            taskKey: 'T1', originalStartDate: '2024-06-01', suggestedStartDate: '2024-06-04',
        });
        const earlier = suggestion({
            taskKey: 'T2', originalStartDate: '2024-06-10', suggestedStartDate: '2024-06-08',
        });
        const result = summarizeOptimization([later, earlier]);
        expect(result.shifted.map((s) => [s.suggestion.taskKey, s.shiftDays])).toEqual([
            ['T1', 3],
            ['T2', -2],
        ]);
    });

    test('groups by assignee, falling back to Unassigned, and excludes Unassigned from affectedPeople', () => {
        const s1 = suggestion({
            taskKey: 'T1', assignee: 'alice@x.com',
            originalStartDate: '2024-06-01', suggestedStartDate: '2024-06-04', // +3
        });
        const s2 = suggestion({
            taskKey: 'T2', assignee: 'alice@x.com',
            originalStartDate: '2024-06-10', suggestedStartDate: '2024-06-08', // -2
        });
        const s3 = suggestion({
            taskKey: 'T3', assignee: 'bob@x.com',
            originalStartDate: '2024-06-05', suggestedStartDate: '2024-06-05', // 0
        });
        const s4 = suggestion({
            taskKey: 'T4', assignee: null,
            originalStartDate: '2024-06-01', suggestedStartDate: '2024-06-06', // +5
        });

        const result = summarizeOptimization([s1, s2, s3, s4]);

        expect(Object.keys(result.byAssignee).sort()).toEqual(['Unassigned', 'alice@x.com', 'bob@x.com']);
        expect(result.byAssignee['alice@x.com'].map((s) => s.suggestion.taskKey)).toEqual(['T1', 'T2']);
        expect(result.byAssignee['bob@x.com'].map((s) => s.suggestion.taskKey)).toEqual(['T3']);
        expect(result.byAssignee['Unassigned'].map((s) => s.suggestion.taskKey)).toEqual(['T4']);
        expect(result.affectedPeople).toBe(2);

        // Absolute shifts are 3, 2, 0, 5: mean 2.5 rounds to 3, max is 5.
        expect(result.avgShift).toBe(3);
        expect(result.maxShift).toBe(5);
    });
});
