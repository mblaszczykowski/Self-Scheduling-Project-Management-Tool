package com.backend.util;

import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import org.junit.jupiter.api.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Experimental evaluation of MORCPSP SSGS heuristic vs FIFO and SPT baselines.
 * Produces data for Chapter 5 of the master thesis.
 *
 * Run this test class and copy the console output into the LaTeX document.
 */
@DisplayName("Chapter 5: Experimental Evaluation")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ScheduleOptimizerExperimentTest {

    private final ScheduleOptimizer optimizer = new ScheduleOptimizer();
    private static final LocalDate HORIZON = LocalDate.of(2025, 1, 1);
    private static final double ALPHA = 0.8;
    private static final double BETA = 0.2;

    // ========================================================================
    // Test data generators
    // ========================================================================

    private TaskDTO task(String key, String start, String end, String assignee,
                         TaskPriority priority, List<String> deps) {
        return new TaskDTO(null, null, key, "PROJ", key, null,
                TaskStatus.IN_PROGRESS,
                LocalDate.parse(start), LocalDate.parse(end),
                assignee, null, deps, null, null, null, null, null, priority);
    }

    /**
     * Generate a realistic portfolio with controlled resource conflicts.
     *
     * @param numProjects     number of projects
     * @param tasksPerProject tasks per project
     * @param numResources    number of developers
     * @param conflictRatio   ratio of tasks that overlap (0.0 - 1.0)
     */
    private List<TaskDTO> generatePortfolio(int numProjects, int tasksPerProject,
                                             int numResources, double conflictRatio) {
        var tasks = new ArrayList<TaskDTO>();
        var rng = new Random(42); // fixed seed for reproducibility
        String[] resources = new String[numResources];
        for (int i = 0; i < numResources; i++) {
            resources[i] = "dev" + (i + 1) + "@company.com";
        }

        TaskPriority[] priorities = {
                TaskPriority.HIGHEST, TaskPriority.HIGH, TaskPriority.MEDIUM,
                TaskPriority.LOW, TaskPriority.LOWEST
        };
        // Distribution: 10% HIGHEST, 20% HIGH, 40% MEDIUM, 20% LOW, 10% LOWEST
        double[] pWeights = {0.10, 0.30, 0.70, 0.90, 1.00};

        int taskNum = 0;
        for (int p = 0; p < numProjects; p++) {
            String projKey = "P" + (char)('A' + p);
            LocalDate projStart = HORIZON.plusDays(p * 5); // stagger project starts

            for (int t = 0; t < tasksPerProject; t++) {
                taskNum++;
                String taskKey = projKey + "-" + (t + 1);

                // Duration: 2-8 days
                int duration = 2 + rng.nextInt(7);
                // Start date: within first 2 weeks of project, with controlled overlap
                int startOffset;
                if (rng.nextDouble() < conflictRatio) {
                    // Force overlap: start within a narrow window
                    startOffset = rng.nextInt(5);
                } else {
                    startOffset = t * 3 + rng.nextInt(3); // spread out
                }
                LocalDate startDate = projStart.plusDays(startOffset);
                LocalDate dueDate = startDate.plusDays(duration - 1);

                // Assignee
                String assignee = resources[rng.nextInt(numResources)];

                // Priority distribution
                double roll = rng.nextDouble();
                TaskPriority priority = TaskPriority.MEDIUM;
                for (int i = 0; i < pWeights.length; i++) {
                    if (roll < pWeights[i]) {
                        priority = priorities[i];
                        break;
                    }
                }

                // Dependencies: ~30% of tasks depend on a previous task in same project
                List<String> deps = new ArrayList<>();
                if (t > 0 && rng.nextDouble() < 0.3) {
                    int depIdx = rng.nextInt(t); // depend on a random earlier task
                    deps.add(projKey + "-" + (depIdx + 1));
                }

                tasks.add(task(taskKey, startDate.toString(), dueDate.toString(),
                        assignee, priority, deps));
            }
        }
        return tasks;
    }

    /**
     * Compute average tardiness per priority level for a given schedule result.
     */
    private Map<TaskPriority, Double> avgTardinessByPriority(
            List<TaskDTO> tasks, ScheduleOptimizer.ScheduleResult result) {

        var grouped = new LinkedHashMap<TaskPriority, List<Integer>>();
        for (var prio : TaskPriority.values()) {
            grouped.put(prio, new ArrayList<>());
        }

        for (var dto : tasks) {
            var scheduled = result.tasks().get(dto.taskKey());
            if (scheduled == null) continue;
            var prio = dto.priority() != null ? dto.priority() : TaskPriority.MEDIUM;
            grouped.get(prio).add(scheduled.tardinessDays());
        }

        var averages = new LinkedHashMap<TaskPriority, Double>();
        for (var entry : grouped.entrySet()) {
            var list = entry.getValue();
            double avg = list.isEmpty() ? 0.0 : list.stream().mapToInt(i -> i).average().orElse(0.0);
            averages.put(entry.getKey(), avg);
        }
        return averages;
    }

    // ========================================================================
    // EXPERIMENT 1: Tardiness by priority (Small portfolio - 3 projects, 45 tasks)
    // ========================================================================

    @Test
    @Order(1)
    @DisplayName("Experiment 1: Average tardiness by priority level (3 projects, 45 tasks, 3 devs)")
    void experiment1_tardinessByPriority() {
        var tasks = generatePortfolio(3, 15, 3, 0.6);

        var fifo = optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
        var spt = optimizer.optimizeSPT(tasks, HORIZON, ALPHA, BETA);
        var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
        var original = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);

        var fifoTard = avgTardinessByPriority(tasks, fifo);
        var sptTard = avgTardinessByPriority(tasks, spt);
        var morcpspTard = avgTardinessByPriority(tasks, morcpsp);

        System.out.println("\n========================================================================");
        System.out.println("EXPERIMENT 1: Average Tardiness by Priority Level");
        System.out.println("Portfolio: 3 projects × 15 tasks = 45 tasks, 3 developers, 60% conflict ratio");
        System.out.println("Original conflicts: " + original.resourceConflicts());
        System.out.println("========================================================================");
        System.out.printf("%-12s | %-10s | %-10s | %-10s | %-10s | %-10s%n",
                "Strategy", "HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST");
        System.out.println("-------------|------------|------------|------------|------------|------------");
        printTardinessRow("FIFO", fifoTard);
        printTardinessRow("SPT", sptTard);
        printTardinessRow("MORCPSP", morcpspTard);

        System.out.println("\n--- Overall Metrics ---");
        System.out.printf("%-12s | WT=%-10.1f | Cmax=%-5d | Z=%-10.1f | Conflicts=%-3d%n",
                "FIFO", fifo.weightedTardiness(), fifo.makespan(), fifo.objectiveValue(), fifo.resourceConflicts());
        System.out.printf("%-12s | WT=%-10.1f | Cmax=%-5d | Z=%-10.1f | Conflicts=%-3d%n",
                "SPT", spt.weightedTardiness(), spt.makespan(), spt.objectiveValue(), spt.resourceConflicts());
        System.out.printf("%-12s | WT=%-10.1f | Cmax=%-5d | Z=%-10.1f | Conflicts=%-3d%n",
                "MORCPSP", morcpsp.weightedTardiness(), morcpsp.makespan(), morcpsp.objectiveValue(), morcpsp.resourceConflicts());

        // Verify all strategies produce zero conflicts
        org.junit.jupiter.api.Assertions.assertEquals(0, fifo.resourceConflicts());
        org.junit.jupiter.api.Assertions.assertEquals(0, spt.resourceConflicts());
        org.junit.jupiter.api.Assertions.assertEquals(0, morcpsp.resourceConflicts());

        // MORCPSP should have best overall objective Z (weighted multi-criteria optimization)
        org.junit.jupiter.api.Assertions.assertTrue(
                morcpsp.objectiveValue() <= fifo.objectiveValue(),
                "MORCPSP objective Z should be <= FIFO");
        // MORCPSP should have best weighted tardiness
        org.junit.jupiter.api.Assertions.assertTrue(
                morcpsp.weightedTardiness() <= fifo.weightedTardiness(),
                "MORCPSP weighted tardiness should be <= FIFO");
    }

    private void printTardinessRow(String name, Map<TaskPriority, Double> tardiness) {
        System.out.printf("%-12s | %-10.1f | %-10.1f | %-10.1f | %-10.1f | %-10.1f%n",
                name,
                tardiness.get(TaskPriority.HIGHEST),
                tardiness.get(TaskPriority.HIGH),
                tardiness.get(TaskPriority.MEDIUM),
                tardiness.get(TaskPriority.LOW),
                tardiness.get(TaskPriority.LOWEST));
    }

    // ========================================================================
    // EXPERIMENT 2: Computational performance scaling
    // ========================================================================

    @Test
    @Order(2)
    @DisplayName("Experiment 2: Computational performance (10 to 500 tasks)")
    void experiment2_performance() {
        int[] sizes = {10, 25, 50, 100, 200, 500};
        int warmupRuns = 3;
        int measuredRuns = 10;

        System.out.println("\n========================================================================");
        System.out.println("EXPERIMENT 2: Computational Performance");
        System.out.println("Warm-up: " + warmupRuns + " runs, Measured: " + measuredRuns + " runs each");
        System.out.println("========================================================================");
        System.out.printf("%-8s | %-12s | %-12s | %-12s%n", "N tasks", "FIFO (ms)", "SPT (ms)", "MORCPSP (ms)");
        System.out.println("---------|--------------|--------------|-------------");

        for (int n : sizes) {
            int projects = Math.max(1, n / 15);
            int tasksPerProj = n / projects;
            var tasks = generatePortfolio(projects, tasksPerProj, 3, 0.5);

            // Warm up JIT
            for (int i = 0; i < warmupRuns; i++) {
                optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
                optimizer.optimizeSPT(tasks, HORIZON, ALPHA, BETA);
                optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            }

            // Measure
            long fifoTotal = 0, sptTotal = 0, morcpspTotal = 0;
            for (int i = 0; i < measuredRuns; i++) {
                long t0 = System.nanoTime();
                optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
                fifoTotal += System.nanoTime() - t0;

                t0 = System.nanoTime();
                optimizer.optimizeSPT(tasks, HORIZON, ALPHA, BETA);
                sptTotal += System.nanoTime() - t0;

                t0 = System.nanoTime();
                optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
                morcpspTotal += System.nanoTime() - t0;
            }

            double fifoMs = fifoTotal / (measuredRuns * 1_000_000.0);
            double sptMs = sptTotal / (measuredRuns * 1_000_000.0);
            double morcpspMs = morcpspTotal / (measuredRuns * 1_000_000.0);

            System.out.printf("%-8d | %-12.2f | %-12.2f | %-12.2f%n", tasks.size(), fifoMs, sptMs, morcpspMs);
        }
    }

    // ========================================================================
    // EXPERIMENT 3: Objective function comparison (varying conflict intensity)
    // ========================================================================

    @Test
    @Order(3)
    @DisplayName("Experiment 3: Objective Z vs conflict intensity")
    void experiment3_objectiveVsConflicts() {
        double[] conflictRatios = {0.0, 0.2, 0.4, 0.6, 0.8, 1.0};

        System.out.println("\n========================================================================");
        System.out.println("EXPERIMENT 3: Objective Function Z vs Conflict Intensity");
        System.out.println("Portfolio: 3 projects × 15 tasks = 45 tasks, 3 developers");
        System.out.println("α=0.8, β=0.2");
        System.out.println("========================================================================");
        System.out.printf("%-10s | %-8s | %-12s %-12s %-12s | %-12s %-12s %-12s%n",
                "Conflict%", "OrigConf", "Z(FIFO)", "Z(SPT)", "Z(MORCPSP)",
                "WT(FIFO)", "WT(SPT)", "WT(MORCPSP)");
        System.out.println("-----------|----------|" + "-".repeat(39) + "|" + "-".repeat(39));

        for (double ratio : conflictRatios) {
            var tasks = generatePortfolio(3, 15, 3, ratio);
            var original = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);
            var fifo = optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
            var spt = optimizer.optimizeSPT(tasks, HORIZON, ALPHA, BETA);
            var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            System.out.printf("%-10.0f%% | %-8d | %-12.1f %-12.1f %-12.1f | %-12.1f %-12.1f %-12.1f%n",
                    ratio * 100, original.resourceConflicts(),
                    fifo.objectiveValue(), spt.objectiveValue(), morcpsp.objectiveValue(),
                    fifo.weightedTardiness(), spt.weightedTardiness(), morcpsp.weightedTardiness());
        }
    }

    // ========================================================================
    // EXPERIMENT 4: Makespan and resource utilization
    // ========================================================================

    @Test
    @Order(4)
    @DisplayName("Experiment 4: Makespan comparison across strategies")
    void experiment4_makespanComparison() {
        double[] conflictRatios = {0.0, 0.2, 0.4, 0.6, 0.8, 1.0};

        System.out.println("\n========================================================================");
        System.out.println("EXPERIMENT 4: Makespan (Cmax) vs Conflict Intensity");
        System.out.println("========================================================================");
        System.out.printf("%-10s | %-8s | %-12s %-12s %-12s%n",
                "Conflict%", "OrigCmax", "Cmax(FIFO)", "Cmax(SPT)", "Cmax(MORCPSP)");
        System.out.println("-----------|----------|" + "-".repeat(39));

        for (double ratio : conflictRatios) {
            var tasks = generatePortfolio(3, 15, 3, ratio);
            var original = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);
            var fifo = optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
            var spt = optimizer.optimizeSPT(tasks, HORIZON, ALPHA, BETA);
            var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            System.out.printf("%-10.0f%% | %-8d | %-12d %-12d %-12d%n",
                    ratio * 100, original.makespan(),
                    fifo.makespan(), spt.makespan(), morcpsp.makespan());
        }
    }

    // ========================================================================
    // EXPERIMENT 5: HIGHEST priority protection (the thesis claim)
    // ========================================================================

    @Test
    @Order(5)
    @DisplayName("Experiment 5: Critical task protection - HIGHEST priority zero-tardiness rate")
    void experiment5_criticalTaskProtection() {
        System.out.println("\n========================================================================");
        System.out.println("EXPERIMENT 5: HIGHEST Priority Zero-Tardiness Rate");
        System.out.println("Tests the thesis claim: MORCPSP eliminates tardiness for critical tasks");
        System.out.println("========================================================================");
        System.out.printf("%-10s | %-8s | %-18s %-18s %-18s%n",
                "Conflict%", "OrigConf", "FIFO(on-time/total)", "SPT(on-time/total)", "MORCPSP(on-time/total)");
        System.out.println("-----------|----------|" + "-".repeat(57));

        double[] conflictRatios = {0.2, 0.4, 0.6, 0.8, 1.0};
        for (double ratio : conflictRatios) {
            var tasks = generatePortfolio(3, 15, 3, ratio);
            var original = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);
            var fifo = optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
            var spt = optimizer.optimizeSPT(tasks, HORIZON, ALPHA, BETA);
            var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            // Count HIGHEST priority tasks and how many are on-time for each strategy
            var highestTasks = tasks.stream()
                    .filter(t -> t.priority() == TaskPriority.HIGHEST)
                    .map(TaskDTO::taskKey)
                    .toList();
            int total = highestTasks.size();

            long fifoOnTime = highestTasks.stream()
                    .filter(k -> fifo.tasks().containsKey(k) && fifo.tasks().get(k).tardinessDays() == 0)
                    .count();
            long sptOnTime = highestTasks.stream()
                    .filter(k -> spt.tasks().containsKey(k) && spt.tasks().get(k).tardinessDays() == 0)
                    .count();
            long morcpspOnTime = highestTasks.stream()
                    .filter(k -> morcpsp.tasks().containsKey(k) && morcpsp.tasks().get(k).tardinessDays() == 0)
                    .count();

            System.out.printf("%-10.0f%% | %-8d | %-18s %-18s %-18s%n",
                    ratio * 100, original.resourceConflicts(),
                    fifoOnTime + "/" + total, sptOnTime + "/" + total, morcpspOnTime + "/" + total);
        }
    }

    // ========================================================================
    // EXPERIMENT 6: Large-scale portfolio
    // ========================================================================

    @Test
    @Order(6)
    @DisplayName("Experiment 6: Large portfolio (10 projects, 150 tasks, 5 devs)")
    void experiment6_largePortfolio() {
        var tasks = generatePortfolio(10, 15, 5, 0.5);
        var original = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);
        var fifo = optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
        var spt = optimizer.optimizeSPT(tasks, HORIZON, ALPHA, BETA);
        var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

        System.out.println("\n========================================================================");
        System.out.println("EXPERIMENT 6: Large Portfolio Comparison");
        System.out.println("10 projects × 15 tasks = 150 tasks, 5 developers, 50% conflicts");
        System.out.println("========================================================================");

        System.out.printf("%-12s | %-14s | %-10s | %-14s | %-10s | %-10s%n",
                "Strategy", "Weighted Tard.", "Makespan", "Objective Z", "Conflicts", "Tasks Late");
        System.out.println("-------------|----------------|------------|----------------|------------|----------");
        System.out.printf("%-12s | %-14.1f | %-10d | %-14.1f | %-10d | %-10d%n",
                "Original", original.weightedTardiness(), original.makespan(),
                original.objectiveValue(), original.resourceConflicts(),
                tasks.size() - countOnTime(tasks, original));
        System.out.printf("%-12s | %-14.1f | %-10d | %-14.1f | %-10d | %-10d%n",
                "FIFO", fifo.weightedTardiness(), fifo.makespan(),
                fifo.objectiveValue(), fifo.resourceConflicts(),
                tasks.size() - countOnTime(tasks, fifo));
        System.out.printf("%-12s | %-14.1f | %-10d | %-14.1f | %-10d | %-10d%n",
                "SPT", spt.weightedTardiness(), spt.makespan(),
                spt.objectiveValue(), spt.resourceConflicts(),
                tasks.size() - countOnTime(tasks, spt));
        System.out.printf("%-12s | %-14.1f | %-10d | %-14.1f | %-10d | %-10d%n",
                "MORCPSP", morcpsp.weightedTardiness(), morcpsp.makespan(),
                morcpsp.objectiveValue(), morcpsp.resourceConflicts(),
                tasks.size() - countOnTime(tasks, morcpsp));

        // Tardiness by priority
        System.out.println("\n--- Average Tardiness by Priority ---");
        var fifoT = avgTardinessByPriority(tasks, fifo);
        var sptT = avgTardinessByPriority(tasks, spt);
        var morT = avgTardinessByPriority(tasks, morcpsp);
        System.out.printf("%-12s | %-10s | %-10s | %-10s | %-10s | %-10s%n",
                "Strategy", "HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST");
        System.out.println("-------------|------------|------------|------------|------------|------------");
        printTardinessRow("FIFO", fifoT);
        printTardinessRow("SPT", sptT);
        printTardinessRow("MORCPSP", morT);
    }

    private int countOnTime(List<TaskDTO> tasks, ScheduleOptimizer.ScheduleResult result) {
        int count = 0;
        for (var dto : tasks) {
            var s = result.tasks().get(dto.taskKey());
            if (s != null && s.tardinessDays() == 0) count++;
        }
        return count;
    }

    // ========================================================================
    // EXPERIMENT 7: Statistical robustness (30 seeds)
    // ========================================================================

    @Test
    @Order(7)
    @DisplayName("Experiment 7: Statistical robustness - 30 random seeds (N=45)")
    void experiment7_statisticalRobustness() {
        int NUM_SEEDS = 30;

        double[] fifoZ = new double[NUM_SEEDS];
        double[] sptZ = new double[NUM_SEEDS];
        double[] morcpspZ = new double[NUM_SEEDS];
        double[] fifoHighest = new double[NUM_SEEDS];
        double[] sptHighest = new double[NUM_SEEDS];
        double[] morcpspHighest = new double[NUM_SEEDS];

        for (int seed = 0; seed < NUM_SEEDS; seed++) {
            var tasks = generatePortfolioWithSeed(3, 15, 3, 0.6, seed);
            var fifo = optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
            var spt = optimizer.optimizeSPT(tasks, HORIZON, ALPHA, BETA);
            var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            fifoZ[seed] = fifo.objectiveValue();
            sptZ[seed] = spt.objectiveValue();
            morcpspZ[seed] = morcpsp.objectiveValue();

            fifoHighest[seed] = avgTardinessByPriority(tasks, fifo).get(TaskPriority.HIGHEST);
            sptHighest[seed] = avgTardinessByPriority(tasks, spt).get(TaskPriority.HIGHEST);
            morcpspHighest[seed] = avgTardinessByPriority(tasks, morcpsp).get(TaskPriority.HIGHEST);
        }

        System.out.println("\n========================================================================");
        System.out.println("EXPERIMENT 7: Statistical Robustness (30 seeds, N=45, 60% conflicts)");
        System.out.println("========================================================================");
        System.out.printf("%-12s | %-22s | %-22s%n", "Strategy", "Objective Z (mean±std)", "HIGHEST tard. (mean±std)");
        System.out.println("-------------|------------------------|------------------------");
        System.out.printf("%-12s | %8.1f ± %-10.1f | %8.1f ± %-10.1f%n", "FIFO", mean(fifoZ), std(fifoZ), mean(fifoHighest), std(fifoHighest));
        System.out.printf("%-12s | %8.1f ± %-10.1f | %8.1f ± %-10.1f%n", "SPT", mean(sptZ), std(sptZ), mean(sptHighest), std(sptHighest));
        System.out.printf("%-12s | %8.1f ± %-10.1f | %8.1f ± %-10.1f%n", "MORCPSP", mean(morcpspZ), std(morcpspZ), mean(morcpspHighest), std(morcpspHighest));

        // Win rate: how often MORCPSP has the best Z
        int morcpspWins = 0, sptWins = 0, fifoWins = 0;
        for (int i = 0; i < NUM_SEEDS; i++) {
            double best = Math.min(Math.min(fifoZ[i], sptZ[i]), morcpspZ[i]);
            if (morcpspZ[i] == best) morcpspWins++;
            else if (sptZ[i] == best) sptWins++;
            else fifoWins++;
        }
        System.out.printf("\nWin rate (best Z): FIFO=%d/%d  SPT=%d/%d  MORCPSP=%d/%d%n",
                fifoWins, NUM_SEEDS, sptWins, NUM_SEEDS, morcpspWins, NUM_SEEDS);
    }

    // ========================================================================
    // EXPERIMENT 8: Sensitivity analysis (α, β parameters)
    // ========================================================================

    @Test
    @Order(8)
    @DisplayName("Experiment 8: Sensitivity to α/β weights")
    void experiment8_sensitivityAlphaBeta() {
        double[][] params = {
                {1.0, 0.0},  // pure tardiness
                {0.8, 0.2},  // default
                {0.5, 0.5},  // balanced
                {0.2, 0.8},  // makespan-heavy
                {0.0, 1.0},  // pure makespan
        };

        var tasks = generatePortfolio(3, 15, 3, 0.6);

        System.out.println("\n========================================================================");
        System.out.println("EXPERIMENT 8: Sensitivity Analysis — α/β Parameter Impact");
        System.out.println("Portfolio: 3×15=45 tasks, 3 devs, 60% conflicts");
        System.out.println("========================================================================");
        System.out.printf("%-8s | %-12s %-12s %-12s | %-12s %-12s %-12s | %-10s %-10s %-10s%n",
                "α / β", "Z(FIFO)", "Z(SPT)", "Z(MORCPSP)",
                "WT(FIFO)", "WT(SPT)", "WT(MORCPSP)",
                "Cmax(F)", "Cmax(S)", "Cmax(M)");
        System.out.println("-".repeat(130));

        for (var ab : params) {
            double a = ab[0], b = ab[1];
            var fifo = optimizer.optimizeFIFO(tasks, HORIZON, a, b);
            var spt = optimizer.optimizeSPT(tasks, HORIZON, a, b);
            var morcpsp = optimizer.optimize(tasks, HORIZON, a, b);

            System.out.printf("%.1f/%.1f  | %-12.1f %-12.1f %-12.1f | %-12.1f %-12.1f %-12.1f | %-10d %-10d %-10d%n",
                    a, b,
                    fifo.objectiveValue(), spt.objectiveValue(), morcpsp.objectiveValue(),
                    fifo.weightedTardiness(), spt.weightedTardiness(), morcpsp.weightedTardiness(),
                    fifo.makespan(), spt.makespan(), morcpsp.makespan());
        }
    }

    // ========================================================================
    // EXPERIMENT 9: Large scale performance (up to 2000 tasks)
    // ========================================================================

    @Test
    @Order(9)
    @DisplayName("Experiment 9: Large-scale performance (up to 2000 tasks)")
    void experiment9_largeScalePerformance() {
        int[] sizes = {100, 250, 500, 1000, 2000};
        int warmup = 3, runs = 5;

        System.out.println("\n========================================================================");
        System.out.println("EXPERIMENT 9: Large-Scale Performance (up to N=2000)");
        System.out.println("Warm-up: " + warmup + ", Measured: " + runs + " runs");
        System.out.println("========================================================================");
        System.out.printf("%-8s | %-8s | %-12s | %-12s | %-12s | %-14s | %-10s%n",
                "N", "Devs", "FIFO (ms)", "SPT (ms)", "MORCPSP (ms)", "MORCPSP Z", "Conflicts");
        System.out.println("-".repeat(90));

        for (int n : sizes) {
            int devs = Math.max(3, n / 30);
            int projects = Math.max(1, n / 20);
            int tpp = n / projects;
            var tasks = generatePortfolio(projects, tpp, devs, 0.5);
            var original = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);

            // warmup
            for (int i = 0; i < warmup; i++) optimizer.optimize(tasks, HORIZON, ALPHA, BETA);

            long fifoT = 0, sptT = 0, morT = 0;
            ScheduleOptimizer.ScheduleResult morcpspResult = null;
            for (int i = 0; i < runs; i++) {
                long t0 = System.nanoTime(); optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA); fifoT += System.nanoTime() - t0;
                t0 = System.nanoTime(); optimizer.optimizeSPT(tasks, HORIZON, ALPHA, BETA); sptT += System.nanoTime() - t0;
                t0 = System.nanoTime(); morcpspResult = optimizer.optimize(tasks, HORIZON, ALPHA, BETA); morT += System.nanoTime() - t0;
            }

            System.out.printf("%-8d | %-8d | %-12.2f | %-12.2f | %-12.2f | %-14.1f | %-10d%n",
                    tasks.size(), devs,
                    fifoT / (runs * 1e6), sptT / (runs * 1e6), morT / (runs * 1e6),
                    morcpspResult.objectiveValue(), original.resourceConflicts());
        }
    }

    // ========================================================================
    // EXPERIMENT 10: Priority distribution impact
    // ========================================================================

    @Test
    @Order(10)
    @DisplayName("Experiment 10: Impact of priority distribution")
    void experiment10_priorityDistribution() {
        System.out.println("\n========================================================================");
        System.out.println("EXPERIMENT 10: Impact of Priority Distribution on MORCPSP");
        System.out.println("N=45, 3 devs, 60% conflicts. Varying % of HIGHEST priority tasks.");
        System.out.println("========================================================================");
        System.out.printf("%-12s | %-10s | %-14s | %-14s | %-18s%n",
                "HIGH% dist", "Conflicts", "Z(MORCPSP)", "WT(MORCPSP)", "HIGHEST tard.(avg)");
        System.out.println("-".repeat(78));

        // Test different priority distributions: 5%, 20%, 50%, 80% HIGHEST
        double[][] distributions = {
                {0.05, 0.15, 0.50, 0.20, 0.10},  // 5% HIGHEST (few critical)
                {0.20, 0.20, 0.30, 0.20, 0.10},  // 20% HIGHEST (moderate)
                {0.50, 0.20, 0.20, 0.05, 0.05},  // 50% HIGHEST (many critical)
                {0.80, 0.10, 0.05, 0.03, 0.02},  // 80% HIGHEST (almost all critical)
        };
        String[] labels = {"5% HIGH", "20% HIGH", "50% HIGH", "80% HIGH"};

        for (int d = 0; d < distributions.length; d++) {
            var tasks = generatePortfolioWithDistribution(3, 15, 3, 0.6, 42, distributions[d]);
            var original = optimizer.evaluateOriginal(tasks, HORIZON, ALPHA, BETA);
            var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            var tard = avgTardinessByPriority(tasks, morcpsp);

            System.out.printf("%-12s | %-10d | %-14.1f | %-14.1f | %-18.1f%n",
                    labels[d], original.resourceConflicts(),
                    morcpsp.objectiveValue(), morcpsp.weightedTardiness(),
                    tard.get(TaskPriority.HIGHEST));
        }
    }

    // ========================================================================
    // Helper: generate with custom seed
    // ========================================================================

    private List<TaskDTO> generatePortfolioWithSeed(int numProjects, int tasksPerProject,
                                                     int numResources, double conflictRatio, int seed) {
        var origSeed = 42;
        // Temporarily use different seed via a copy of the generator logic
        var tasks = new ArrayList<TaskDTO>();
        var rng = new Random(seed);
        String[] resources = new String[numResources];
        for (int i = 0; i < numResources; i++) resources[i] = "dev" + (i + 1) + "@company.com";
        TaskPriority[] priorities = TaskPriority.values();
        double[] pWeights = {0.10, 0.30, 0.70, 0.90, 1.00};

        int taskNum = 0;
        for (int p = 0; p < numProjects; p++) {
            String projKey = "P" + (char)('A' + (p % 26)) + (p >= 26 ? String.valueOf(p / 26) : "");
            LocalDate projStart = HORIZON.plusDays(p * 5);
            for (int t = 0; t < tasksPerProject; t++) {
                taskNum++;
                String taskKey = projKey + "-" + (t + 1);
                int duration = 2 + rng.nextInt(7);
                int startOffset = rng.nextDouble() < conflictRatio ? rng.nextInt(5) : t * 3 + rng.nextInt(3);
                LocalDate startDate = projStart.plusDays(startOffset);
                LocalDate dueDate = startDate.plusDays(duration - 1);
                String assignee = resources[rng.nextInt(numResources)];
                double roll = rng.nextDouble();
                TaskPriority priority = TaskPriority.MEDIUM;
                for (int i = 0; i < pWeights.length; i++) {
                    if (roll < pWeights[i]) { priority = priorities[i]; break; }
                }
                List<String> deps = new ArrayList<>();
                if (t > 0 && rng.nextDouble() < 0.3) deps.add(projKey + "-" + (1 + rng.nextInt(t)));
                tasks.add(task(taskKey, startDate.toString(), dueDate.toString(), assignee, priority, deps));
            }
        }
        return tasks;
    }

    private List<TaskDTO> generatePortfolioWithDistribution(int numProjects, int tasksPerProject,
                                                             int numResources, double conflictRatio,
                                                             int seed, double[] priorityDist) {
        var tasks = new ArrayList<TaskDTO>();
        var rng = new Random(seed);
        String[] resources = new String[numResources];
        for (int i = 0; i < numResources; i++) resources[i] = "dev" + (i + 1) + "@company.com";
        TaskPriority[] priorities = TaskPriority.values();

        // Build cumulative distribution
        double[] cumDist = new double[priorityDist.length];
        cumDist[0] = priorityDist[0];
        for (int i = 1; i < priorityDist.length; i++) cumDist[i] = cumDist[i - 1] + priorityDist[i];

        for (int p = 0; p < numProjects; p++) {
            String projKey = "P" + (char)('A' + (p % 26));
            LocalDate projStart = HORIZON.plusDays(p * 5);
            for (int t = 0; t < tasksPerProject; t++) {
                String taskKey = projKey + "-" + (t + 1);
                int duration = 2 + rng.nextInt(7);
                int startOffset = rng.nextDouble() < conflictRatio ? rng.nextInt(5) : t * 3 + rng.nextInt(3);
                LocalDate startDate = projStart.plusDays(startOffset);
                LocalDate dueDate = startDate.plusDays(duration - 1);
                String assignee = resources[rng.nextInt(numResources)];
                double roll = rng.nextDouble();
                TaskPriority priority = priorities[priorities.length - 1]; // default lowest
                for (int i = 0; i < cumDist.length; i++) {
                    if (roll < cumDist[i]) { priority = priorities[i]; break; }
                }
                List<String> deps = new ArrayList<>();
                if (t > 0 && rng.nextDouble() < 0.3) deps.add(projKey + "-" + (1 + rng.nextInt(t)));
                tasks.add(task(taskKey, startDate.toString(), dueDate.toString(), assignee, priority, deps));
            }
        }
        return tasks;
    }

    // ========================================================================
    // Statistics helpers
    // ========================================================================

    private double mean(double[] arr) {
        double sum = 0;
        for (double v : arr) sum += v;
        return sum / arr.length;
    }

    private double std(double[] arr) {
        double m = mean(arr);
        double sum = 0;
        for (double v : arr) sum += (v - m) * (v - m);
        return Math.sqrt(sum / arr.length);
    }
}
