package com.backend.util;

import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import org.junit.jupiter.api.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Experiment 16: Sensitivity of MORCPSP to dependency graph density.
 *
 * Density ρ is the probability that a given task has at least one predecessor
 * in its own project. The test sweeps ρ ∈ {0.00, 0.15, 0.30, 0.50, 0.70} and
 * reports:
 *  - Average chain length (longest path length / N).
 *  - Z for FIFO / SPT / MORCPSP.
 *  - HIGHEST tardiness for MORCPSP.
 *  - Number of critical-path tasks.
 */
@DisplayName("Chapter 5 / Experiment 16: Impact of dependency density")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ScheduleOptimizerDependencyDensityTest {

    private final ScheduleOptimizer optimizer = new ScheduleOptimizer();
    private static final LocalDate HORIZON = LocalDate.of(2025, 1, 1);
    private static final double ALPHA = 0.8;
    private static final double BETA = 0.2;
    private static final int NUM_SEEDS = 30;
    private static final int N_TASKS = 60;
    private static final int NUM_RESOURCES = 3;
    private static final double CONFLICT_RATIO = 0.60;

    @Test
    @Order(1)
    @DisplayName("16.1: Z and HIGHEST tardiness vs dependency density")
    void experiment16_dependencyDensity() {
        double[] densities = {0.00, 0.15, 0.30, 0.50, 0.70};

        System.out.println("\n=== Experiment 16: Dependency density sweep (N=" + N_TASKS + ") ===\n");
        System.out.printf("%-6s | %-12s | %-13s | %-13s | %-13s | %-10s%n",
                "ρ", "avg chain", "Z FIFO", "Z SPT", "Z MORCPSP", "HIGH tard");

        for (double density : densities) {
            double[] zFifo = new double[NUM_SEEDS];
            double[] zSpt = new double[NUM_SEEDS];
            double[] zMorcpsp = new double[NUM_SEEDS];
            double[] highestTard = new double[NUM_SEEDS];
            double[] chainLengths = new double[NUM_SEEDS];

            for (int seed = 0; seed < NUM_SEEDS; seed++) {
                List<TaskDTO> tasks = generatePortfolioWithDensity(
                        N_TASKS, NUM_RESOURCES, CONFLICT_RATIO, density, seed);
                var fifo = optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
                var spt = optimizer.optimizeSPT(tasks, HORIZON, ALPHA, BETA);
                var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
                zFifo[seed] = fifo.objectiveValue();
                zSpt[seed] = spt.objectiveValue();
                zMorcpsp[seed] = morcpsp.objectiveValue();
                highestTard[seed] = avgTardinessOfPriority(tasks, morcpsp, TaskPriority.HIGHEST);
                chainLengths[seed] = longestChainLength(tasks);
            }
            System.out.printf("%-6.2f | %-12.2f | %7.1f±%5.1f | %7.1f±%5.1f | %7.1f±%5.1f | %5.2f±%5.2f%n",
                    density, mean(chainLengths),
                    mean(zFifo), std(zFifo),
                    mean(zSpt), std(zSpt),
                    mean(zMorcpsp), std(zMorcpsp),
                    mean(highestTard), std(highestTard));
        }
    }

    @Test
    @Order(2)
    @DisplayName("16.2: MORCPSP relative improvement vs FIFO across densities")
    void experiment16_improvementCurve() {
        double[] densities = {0.00, 0.15, 0.30, 0.50, 0.70};

        System.out.println("\n=== Experiment 16.2: MORCPSP improvement over FIFO vs density ===\n");
        System.out.printf("%-6s | %-18s%n", "ρ", "Improvement (%)");

        for (double density : densities) {
            double sumImprov = 0;
            for (int seed = 0; seed < NUM_SEEDS; seed++) {
                List<TaskDTO> tasks = generatePortfolioWithDensity(
                        N_TASKS, NUM_RESOURCES, CONFLICT_RATIO, density, seed);
                var fifo = optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
                var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
                double zF = fifo.objectiveValue();
                double zM = morcpsp.objectiveValue();
                if (zF > 0) sumImprov += (zF - zM) / zF * 100;
            }
            double avg = sumImprov / NUM_SEEDS;
            String bar = "#".repeat((int) Math.max(0, Math.round(avg)));
            System.out.printf("%-6.2f | %5.2f%%  %s%n", density, avg, bar);
        }
    }

    // ---------- Chain length computation (longest path in DAG) ----------

    private double longestChainLength(List<TaskDTO> tasks) {
        Map<String, TaskDTO> byKey = tasks.stream()
                .collect(Collectors.toMap(TaskDTO::taskKey, t -> t));
        Map<String, Integer> inDegree = new HashMap<>();
        Map<String, List<String>> successors = new HashMap<>();
        for (TaskDTO t : tasks) {
            inDegree.putIfAbsent(t.taskKey(), 0);
            if (t.dependencyKeys() == null) continue;
            for (String dep : t.dependencyKeys()) {
                if (byKey.containsKey(dep)) {
                    inDegree.merge(t.taskKey(), 1, Integer::sum);
                    successors.computeIfAbsent(dep, k -> new ArrayList<>()).add(t.taskKey());
                }
            }
        }
        // Topological sort
        List<String> topo = new ArrayList<>();
        Deque<String> queue = new ArrayDeque<>();
        Map<String, Integer> inCopy = new HashMap<>(inDegree);
        for (var e : inCopy.entrySet()) if (e.getValue() == 0) queue.add(e.getKey());
        while (!queue.isEmpty()) {
            String k = queue.poll();
            topo.add(k);
            for (String s : successors.getOrDefault(k, List.of())) {
                int nd = inCopy.merge(s, -1, Integer::sum);
                if (nd == 0) queue.add(s);
            }
        }
        // Longest path via DP
        Map<String, Integer> depth = new HashMap<>();
        int maxDepth = 0;
        for (String key : topo) {
            TaskDTO t = byKey.get(key);
            int d = 1;
            if (t.dependencyKeys() != null) {
                for (String dep : t.dependencyKeys()) {
                    if (depth.containsKey(dep)) d = Math.max(d, depth.get(dep) + 1);
                }
            }
            depth.put(key, d);
            maxDepth = Math.max(maxDepth, d);
        }
        return maxDepth;
    }

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

    /** Generates a portfolio where each task (from index 1 onwards) has a predecessor
     *  with probability = density. All tasks live in a single project chain to maximize
     *  the effect of density on path length. */
    private List<TaskDTO> generatePortfolioWithDensity(int totalTasks, int numResources,
                                                       double conflictRatio, double density,
                                                       int seed) {
        Random rng = new Random(seed);
        int numProjects = 3;
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
                        ? rng.nextInt(8)
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
                if (t > 0 && rng.nextDouble() < density) {
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
