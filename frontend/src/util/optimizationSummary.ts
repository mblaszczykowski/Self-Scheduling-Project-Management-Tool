import { daysBetween } from './helpers';
import { OptimizationSuggestion } from '../types';

export interface ShiftedSuggestion {
    suggestion: OptimizationSuggestion;
    shiftDays: number;
}

export interface OptimizationSummary {
    shifted: ShiftedSuggestion[];
    byAssignee: Record<string, ShiftedSuggestion[]>;
    avgShift: number;
    maxShift: number;
    affectedPeople: number;
}

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
