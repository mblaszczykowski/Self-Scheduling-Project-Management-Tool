package com.backend.scheduling;

import java.util.Collection;

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

    public record Horizon(int length, double maxWeightedTardiness, int earliestDueOffset) {
        public static Horizon of(Collection<ScheduleTask> tasks, int minHorizonDays) {
            var scored = tasks.stream().filter(task -> !task.fixed()).toList();
            if (scored.isEmpty()) {
                return new Horizon(minHorizonDays, 0.0, 0);
            }
            int maxDue = scored.stream().mapToInt(ScheduleTask::dueOffset).max().orElse(0);
            int earliestDue = scored.stream().mapToInt(ScheduleTask::dueOffset).min().orElse(0);
            int totalWork = scored.stream().mapToInt(ScheduleTask::duration).sum();
            int lastRelease = Math.max(0,
                    scored.stream().mapToInt(ScheduleTask::releaseOffset).max().orElse(0));
            int lastFixedFinish = tasks.stream()
                    .filter(ScheduleTask::fixed)
                    .mapToInt(task -> task.plannedStart() + task.duration())
                    .max().orElse(0);
            int earliestPossibleTail = Math.max(lastRelease, lastFixedFinish);
            int length = Math.max(minHorizonDays, Math.max(maxDue, earliestPossibleTail + totalWork));

            double worstTardiness = 0.0;
            for (var task : scored) {
                worstTardiness += (double) task.priorityWeight() * Math.max(0, length - task.dueOffset());
            }
            return new Horizon(length, worstTardiness, earliestDue);
        }

        public double urgencyOf(int dueOffset) {
            int span = length - earliestDueOffset;
            if (span <= 0) {
                return 1.0;
            }
            return SchedulingSupport.clampToUnit((double) (length - dueOffset) / span);
        }
    }
}
