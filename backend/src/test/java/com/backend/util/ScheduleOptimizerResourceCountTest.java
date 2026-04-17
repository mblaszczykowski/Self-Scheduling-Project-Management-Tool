package com.backend.util;

import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import org.junit.jupiter.api.*;

import java.time.LocalDate;
import java.util.*;

/**
 * Experiment 15: Sensitivity of MORCPSP to the number of renewable resources K.
 *
 * Fixed portfolio size (N = 100 tasks), varying K in {1, 2, 3, 5, 8, 12, 20}.
 * For each K, the conflict ratio is kept high (0.70) so that the resource
 * constraint is binding. We report Z, weighted tardiness, makespan, HIGHEST
 * tardiness and MORCPSP's relative improvement against FIFO/SPT.
 */
@DisplayName("Chapter 5 / Experiment 15: Impact of resource count K")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ScheduleOptimizerResourceCountTest {

    private final ScheduleOptimizer optimizer = new ScheduleOptimizer();
    private static final LocalDate HORIZON = LocalDate.of(2025, 1, 1);
    private static final double ALPHA = 0.8;
    private static final double BETA = 0.2;
    private static final int NUM_SEEDS = 30;
    private static final int N_TASKS = 100;   // total tasks
    private static final double CONFLICT_RATIO = 0.70;

    @Test
    @Order(1)
    @DisplayName("15.1: Z, tardiness and makespan across K in {1, 2, 3, 5, 8, 12, 20}")
    void experiment15_resourceCount() {
        int[] kValues = {1, 2, 3, 5, 8, 12, 20};

        System.out.println("\n=== Experiment 15: Impact of K (N=" + N_TASKS + ", conflict=" + CONFLICT_RATIO + ") ===\n");
        System.out.printf("%-4s | %-13s | %-13s | %-13s | %-12s | %-12s%n",
                "K", "Z FIFO", "Z SPT", "Z MORCPSP", "HIGH tard M", "Improv vs FIFO/SPT");

        for (int k : kValues) {
            double[] zFifo = new double[NUM_SEEDS];
            double[] zSpt = new double[NUM_SEEDS];
            double[] zMorcpsp = new double[NUM_SEEDS];
            double[] highestTardM = new double[NUM_SEEDS];
            double[] makespanM = new double[NUM_SEEDS];
            double[] origConflicts = new double[NUM_SEEDS];

            for (int seed = 0; seed < NUM_SEEDS; seed++) {
                List<TaskDTO> tasks = generatePortfolioWithResources(N_TASKS, k, CONFLICT_RATIO, seed);
                var fifo = optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
                var spt = optimizer.optimizeSPT(tasks, HORIZON, ALPHA, BETA);
                var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
                var original = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);
                zFifo[seed] = fifo.objectiveValue();
                zSpt[seed] = spt.objectiveValue();
                zMorcpsp[seed] = morcpsp.objectiveValue();
                highestTardM[seed] = avgTardinessOfPriority(tasks, morcpsp, TaskPriority.HIGHEST);
                makespanM[seed] = morcpsp.makespan();
                origConflicts[seed] = original.resourceConflicts();
            }
            double improvFifo = (mean(zFifo) - mean(zMorcpsp)) / mean(zFifo) * 100;
            double improvSpt = (mean(zSpt) - mean(zMorcpsp)) / mean(zSpt) * 100;

            System.out.printf("%-4d | %7.1f±%5.1f | %7.1f±%5.1f | %7.1f±%5.1f | %5.2f±%5.2f | %4.1f%% / %4.1f%%%n",
                    k, mean(zFifo), std(zFifo),
                    mean(zSpt), std(zSpt),
                    mean(zMorcpsp), std(zMorcpsp),
                    mean(highestTardM), std(highestTardM),
                    improvFifo, improvSpt);
            System.out.printf("     | orig conflicts avg: %.1f  makespan MORCPSP avg: %.1f%n",
                    mean(origConflicts), mean(makespanM));
        }
    }

    @Test
    @Order(2)
    @DisplayName("15.2: MORCPSP reveals greatest advantage under tight resources")
    void experiment15_advantageCurve() {
        int[] kValues = {1, 2, 3, 5, 8, 12, 20};

        System.out.println("\n=== Experiment 15.2: Advantage curve (% improvement vs FIFO) ===\n");
        System.out.printf("%-4s | %-20s%n", "K", "MORCPSP improvement vs FIFO (avg)");

        for (int k : kValues) {
            double sumImprov = 0;
            for (int seed = 0; seed < NUM_SEEDS; seed++) {
                List<TaskDTO> tasks = generatePortfolioWithResources(N_TASKS, k, CONFLICT_RATIO, seed);
                var fifo = optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
                var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
                double zF = fifo.objectiveValue();
                double zM = morcpsp.objectiveValue();
                if (zF > 0) sumImprov += (zF - zM) / zF * 100;
            }
            double avg = sumImprov / NUM_SEEDS;
            String bar = "#".repeat((int) Math.max(0, Math.round(avg)));
            System.out.printf("%-4d | %5.2f%%  %s%n", k, avg, bar);
        }
    }

    // ---------- Helpers ----------

    private double avgTardinessOfPriority(List<TaskDTO> tasks, ScheduleOptimizer.ScheduleResult result, TaskPriority priority) {
        double sum = 0;
        int count = 0;
        for (TaskDTO t : tasks) {
            if (t.priority() != priority) continue;
            var s = result.tasks().get(t.taskKey());
            if (s == null) continue;
            sum += s.tardinessDays();
            count++;
        }
        return count == 0 ? 0 : sum / count;
    }

    private double mean(double[] arr) {
        double s = 0;
        for (double v : arr) s += v;
        return s / arr.length;
    }

    private double std(double[] arr) {
        double m = mean(arr);
        double sq = 0;
        for (double v : arr) sq += (v - m) * (v - m);
        return Math.sqrt(sq / Math.max(1, arr.length - 1));
    }

    /** Generates N tasks distributed across 5 projects with exactly K distinct assignees. */
    private List<TaskDTO> generatePortfolioWithResources(int totalTasks, int numResources,
                                                          double conflictRatio, int seed) {
        Random rng = new Random(seed);
        int numProjects = 5;
        int tasksPerProject = totalTasks / numProjects;
        List<TaskDTO> tasks = new ArrayList<>();
        TaskPriority[] priorities = TaskPriority.values();
        double[] cumDist = {0.10, 0.30, 0.70, 0.90, 1.00};

        for (int p = 0; p < numProjects; p++) {
            String projKey = "P" + (char) ('A' + p);
            for (int t = 0; t < tasksPerProject; t++) {
                String key = projKey + "-" + (t + 1);
                int dur = 2 + rng.nextInt(7);
                int startOffset = rng.nextDouble() < conflictRatio
                        ? rng.nextInt(10)
                        : t * 3 + rng.nextInt(3);
                LocalDate start = HORIZON.plusDays(startOffset);
                LocalDate end = start.plusDays(dur);
                String assignee = "dev" + (rng.nextInt(numResources) + 1) + "@company.com";
                double r = rng.nextDouble();
                TaskPriority priority = TaskPriority.MEDIUM;
                for (int i = 0; i < cumDist.length; i++) {
                    if (r < cumDist[i]) {
                        priority = priorities[4 - i];
                        break;
                    }
                }
                List<String> deps = new ArrayList<>();
                if (t > 0 && rng.nextDouble() < 0.30) {
                    deps.add(projKey + "-" + (1 + rng.nextInt(t)));
                }
                tasks.add(new TaskDTO(null, null, key, projKey, key, null,
                        TaskStatus.IN_PROGRESS, start, end, assignee,
                        null, deps, null, null, null, null, null, priority));
            }
        }
        return tasks;
    }
}
