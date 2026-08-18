package com.backend.scheduling;

import java.util.Collection;

/**
 * The one implementation of the multi-objective value Z.
 *
 * <p>{@code Z = alpha * (WT / WT_max) + beta * (C_max / H)}, where both terms are genuinely in
 * [0, 1] — so with {@code alpha + beta = 1}, Z is too, and two portfolios of different sizes are
 * comparable.
 *
 * <ul>
 *   <li>{@code H = max(max d_j, max r_j + sum p_j)} bounds C_max by construction: nothing starts
 *       before its release date r_j, and the worst a decoder can do from there is run everything
 *       back to back.</li>
 *   <li>{@code WT_max = sum(w_j * max(0, H - d_j))} is then a real upper bound on weighted
 *       tardiness, because no task can finish later than H. Normalising by {@code sum(w_j * p_j)}
 *       instead — as an earlier version did — has no upper bound at all, which is how a
 *       "normalised" objective ended up reporting 23.9.</li>
 *   <li>WT_max is 0 only when every task is due exactly at H, and since C_max &le; H no task can
 *       then be late at all — so scoring that case as zero tardiness is correct rather than a
 *       silent divide-by-zero fallback.</li>
 * </ul>
 *
 * <p>Shared by production and by the research harnesses. They used to hold their own copies, and
 * comparing a normalised Z against a raw one produced conclusions like "99.95% better than the
 * exhaustively computed optimum".
 */
public final class ScheduleObjective {

    private ScheduleObjective() {}

    public static double value(double weightedTardiness, int makespan, Horizon horizon,
                               double alpha, double beta) {
        double tardinessTerm = horizon.maxWeightedTardiness() > 0
                ? weightedTardiness / horizon.maxWeightedTardiness()
                : 0.0;
        double makespanTerm = horizon.length() > 0
                ? (double) makespan / horizon.length()
                : 0.0;
        return alpha * SchedulingSupport.clampToUnit(tardinessTerm)
                + beta * SchedulingSupport.clampToUnit(makespanTerm);
    }

    /**
     * The normalisation constants for one problem instance.
     *
     * @param length               H, the scheduling horizon in days
     * @param maxWeightedTardiness WT_max, the worst weighted tardiness any schedule could produce
     * @param earliestDueOffset    the smallest due-date offset, which may be negative for overdue
     *                             work; used to keep the urgency term monotone rather than
     *                             saturating every overdue task at the same value
     */
    public record Horizon(int length, double maxWeightedTardiness, int earliestDueOffset) {

        public static Horizon of(Collection<ScheduleTask> tasks, int minHorizonDays) {
            if (tasks.isEmpty()) {
                return new Horizon(minHorizonDays, 0.0, 0);
            }
            int maxDue = tasks.stream().mapToInt(ScheduleTask::dueOffset).max().orElse(0);
            int earliestDue = tasks.stream().mapToInt(ScheduleTask::dueOffset).min().orElse(0);
            int totalWork = tasks.stream().mapToInt(ScheduleTask::duration).sum();
            // Nothing starts before its release date, so in the worst case everything runs
            // back to back after the last one. Leaving the release out made H too small to be a
            // bound at all: a chain released late finished past H, the makespan term exceeded 1
            // and was silently clamped, and WT_max collapsed to 0 — see maxWeightedTardiness.
            int lastRelease = Math.max(0,
                    tasks.stream().mapToInt(ScheduleTask::releaseOffset).max().orElse(0));
            int length = Math.max(minHorizonDays, Math.max(maxDue, lastRelease + totalWork));

            double worstTardiness = 0.0;
            for (var task : tasks) {
                worstTardiness += (double) task.priorityWeight() * Math.max(0, length - task.dueOffset());
            }
            return new Horizon(length, worstTardiness, earliestDue);
        }

        /**
         * Urgency of a due date on a [0, 1] scale, higher meaning more urgent, monotone in the due
         * date even for work that is already overdue.
         */
        public double urgencyOf(int dueOffset) {
            int span = length - earliestDueOffset;
            if (span <= 0) {
                return 1.0;
            }
            return SchedulingSupport.clampToUnit((double) (length - dueOffset) / span);
        }
    }
}
