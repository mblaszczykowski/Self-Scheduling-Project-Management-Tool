import { daysBetween } from './helpers';
import { OptimizationSuggestion } from '../types';

/** A shifted suggestion paired with the shift, in signed days, computed once. */
export interface ShiftedSuggestion {
    suggestion: OptimizationSuggestion;
    /** Positive when the suggested start moves later than the original, negative when earlier. */
    shiftDays: number;
}

export interface OptimizationSummary {
    shifted: ShiftedSuggestion[];
    byAssignee: Record<string, ShiftedSuggestion[]>;
    /** Rounded average of the absolute shift across every shifted suggestion. */
    avgShift: number;
    /** Largest absolute shift among the shifted suggestions. */
    maxShift: number;
    /** Assignees with at least one shifted task, excluding the 'Unassigned' bucket. */
    affectedPeople: number;
}

/**
 * Groups the optimizer's shifted suggestions by assignee and summarises how much the schedule
 * moved. Mirrors `computeAssigneeLoad` in `statsCompute.ts` in shape: a pure aggregation over a
 * task-shaped list, kept out of the component so it is unit-testable on its own.
 */
export const summarizeOptimization = (suggestions: OptimizationSuggestion[]): OptimizationSummary => {
    const shifted: ShiftedSuggestion[] = suggestions
        .filter((suggestion) => suggestion.wasShifted)
        .map((suggestion) => ({
            suggestion,
            shiftDays: daysBetween(suggestion.originalStartDate, suggestion.suggestedStartDate),
        }));

    const byAssignee: Record<string, ShiftedSuggestion[]> = {};
    let totalAbsShiftDays = 0;
    let maxShift = 0;

    shifted.forEach((entry) => {
        const key = entry.suggestion.assignee || 'Unassigned';
        if (!byAssignee[key]) byAssignee[key] = [];
        byAssignee[key].push(entry);

        const absShift = Math.abs(entry.shiftDays);
        totalAbsShiftDays += absShift;
        if (absShift > maxShift) maxShift = absShift;
    });

    return {
        shifted,
        byAssignee,
        avgShift: shifted.length > 0 ? Math.round(totalAbsShiftDays / shifted.length) : 0,
        maxShift,
        affectedPeople: Object.keys(byAssignee).filter((k) => k !== 'Unassigned').length,
    };
};
