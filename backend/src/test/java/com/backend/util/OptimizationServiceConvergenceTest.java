package com.backend.util;

import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import org.junit.jupiter.api.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Experiment 14: Convergence analysis of the iterative optimization loop.
 *
 * OptimizationService runs ScheduleOptimizer up to 10 iterations, applying
 * results back to input DTOs between iterations. This experiment measures:
 *  - Distribution of iterations required for convergence.
 *  - Decay of the tasksShifted metric across iterations.
 *  - Improvement in Z after each iteration.
 *  - How convergence depends on the conflict ratio.
 */
@DisplayName("Chapter 5 / Experiment 14: Iterative convergence")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class OptimizationServiceConvergenceTest {

    private final ScheduleOptimizer optimizer = new ScheduleOptimizer();
    private static final LocalDate HORIZON = LocalDate.of(2025, 1, 1);
    private static final double ALPHA = 0.8;
    private static final double BETA = 0.2;
    private static final int MAX_ITERATIONS = 10;

    @Test
    @Order(1)
    @DisplayName("14.1: Iteration distribution by conflict ratio")
    void experiment14_iterationDistribution() {
        double[] conflictRatios = {0.0, 0.2, 0.4, 0.6, 0.8, 1.0};
        int seedsPerConfig = 100;

        System.out.println("\n=== Experiment 14.1: Iterations to convergence by conflict ratio ===\n");
        System.out.printf("%-8s | %-8s | %-12s | %-12s | %s%n",
                "Confl.", "avg iter", "max iter", "% conv ≤ 3", "distribution (iter 1..10)");

        for (double conflictRatio : conflictRatios) {
            int[] iterHist = new int[MAX_ITERATIONS + 1];
            int totalIter = 0;
            int maxIter = 0;
            for (int seed = 0; seed < seedsPerConfig; seed++) {
                List<TaskDTO> tasks = generatePortfolioWithSeed(3, 15, 3, conflictRatio, seed);
                int iterations = countIterationsToConvergence(tasks);
                iterHist[iterations]++;
                totalIter += iterations;
                maxIter = Math.max(maxIter, iterations);
            }
            double avg = (double) totalIter / seedsPerConfig;
            int within3 = iterHist[1] + iterHist[2] + iterHist[3];
            System.out.printf("%-8.2f | %-8.2f | %-12d | %-12.1f%% | ",
                    conflictRatio, avg, maxIter, 100.0 * within3 / seedsPerConfig);
            for (int i = 1; i <= MAX_ITERATIONS; i++) System.out.print(iterHist[i] + " ");
            System.out.println();
        }
    }

    @Test
    @Order(2)
    @DisplayName("14.2: tasksShifted decay and Z improvement per iteration")
    void experiment14_iterationDecay() {
        int seedsPerConfig = 50;
        double conflictRatio = 0.80;

        double[][] shiftedHist = new double[seedsPerConfig][MAX_ITERATIONS];
        double[][] zHist = new double[seedsPerConfig][MAX_ITERATIONS];
        int[] actualIterations = new int[seedsPerConfig];

        for (int seed = 0; seed < seedsPerConfig; seed++) {
            List<TaskDTO> tasks = generatePortfolioWithSeed(3, 15, 3, conflictRatio, seed);
            Arrays.fill(shiftedHist[seed], Double.NaN);
            Arrays.fill(zHist[seed], Double.NaN);
            actualIterations[seed] = recordIterations(tasks, shiftedHist[seed], zHist[seed]);
        }

        System.out.println("\n=== Experiment 14.2: Decay of tasksShifted and Z (conflict = 0.80, n=" + seedsPerConfig + ") ===\n");
        System.out.printf("%-8s | %-25s | %-25s | %-10s%n",
                "Iter", "tasksShifted (mean ± std)", "Z (mean ± std)", "% runs active");

        for (int i = 0; i < MAX_ITERATIONS; i++) {
            List<Double> shifts = new ArrayList<>();
            List<Double> zs = new ArrayList<>();
            for (int s = 0; s < seedsPerConfig; s++) {
                if (!Double.isNaN(shiftedHist[s][i])) shifts.add(shiftedHist[s][i]);
                if (!Double.isNaN(zHist[s][i])) zs.add(zHist[s][i]);
            }
            if (shifts.isEmpty()) continue;
            double sMean = shifts.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            double sStd = std(shifts);
            double zMean = zs.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            double zStd = std(zs);
            System.out.printf("%-8d | %7.2f ± %6.2f         | %7.1f ± %6.1f          | %.1f%%%n",
                    i + 1, sMean, sStd, zMean, zStd,
                    100.0 * shifts.size() / seedsPerConfig);
        }
        long unconverged = Arrays.stream(actualIterations).filter(i -> i == MAX_ITERATIONS).count();
        System.out.printf("%nReached iteration cap (%d) without convergence: %d/%d (%.1f%%)%n",
                MAX_ITERATIONS, unconverged, seedsPerConfig, 100.0 * unconverged / seedsPerConfig);
    }

    @Test
    @Order(3)
    @DisplayName("14.3: Single-run vs iterative convergence improvement")
    void experiment14_singleRunVsIterative() {
        int seedsPerConfig = 100;
        double[] conflictRatios = {0.0, 0.3, 0.6, 0.9};

        System.out.println("\n=== Experiment 14.3: Value of iterative loop vs single SSGS pass ===\n");
        System.out.printf("%-8s | %-15s | %-15s | %-10s%n",
                "Confl.", "Z single (avg)", "Z iter (avg)", "Improv. %");

        for (double confl : conflictRatios) {
            double zSingle = 0, zIter = 0;
            for (int seed = 0; seed < seedsPerConfig; seed++) {
                List<TaskDTO> tasks = generatePortfolioWithSeed(3, 15, 3, confl, seed);
                var single = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
                zSingle += single.objectiveValue();
                zIter += runIterativelyGetZ(tasks);
            }
            zSingle /= seedsPerConfig;
            zIter /= seedsPerConfig;
            double improv = zSingle > 0 ? (zSingle - zIter) / zSingle * 100 : 0;
            System.out.printf("%-8.2f | %-15.1f | %-15.1f | %.2f%%%n",
                    confl, zSingle, zIter, improv);
        }
    }

    // ---------- Iterative loop replication (mirrors OptimizationService) ----------

    private int countIterationsToConvergence(List<TaskDTO> tasks) {
        List<TaskDTO> current = tasks;
        ScheduleOptimizer.ScheduleResult prev = null;
        for (int iter = 1; iter <= MAX_ITERATIONS; iter++) {
            var result = optimizer.optimize(current, HORIZON, ALPHA, BETA);
            if (prev != null && result.tasksShifted() == 0) return iter;
            prev = result;
            if (result.tasksShifted() == 0) return iter;
            current = applyResultToDTOs(current, result);
        }
        return MAX_ITERATIONS;
    }

    private int recordIterations(List<TaskDTO> tasks, double[] shiftedHist, double[] zHist) {
        List<TaskDTO> current = tasks;
        ScheduleOptimizer.ScheduleResult prev = null;
        for (int iter = 1; iter <= MAX_ITERATIONS; iter++) {
            var result = optimizer.optimize(current, HORIZON, ALPHA, BETA);
            shiftedHist[iter - 1] = result.tasksShifted();
            zHist[iter - 1] = result.objectiveValue();
            if (prev != null && result.tasksShifted() == 0) return iter;
            prev = result;
            if (result.tasksShifted() == 0) return iter;
            current = applyResultToDTOs(current, result);
        }
        return MAX_ITERATIONS;
    }

    private double runIterativelyGetZ(List<TaskDTO> tasks) {
        List<TaskDTO> current = tasks;
        ScheduleOptimizer.ScheduleResult last = null;
        ScheduleOptimizer.ScheduleResult prev = null;
        for (int iter = 0; iter < MAX_ITERATIONS; iter++) {
            var result = optimizer.optimize(current, HORIZON, ALPHA, BETA);
            if (prev != null && result.tasksShifted() == 0) { last = result; break; }
            prev = result;
            last = result;
            if (result.tasksShifted() == 0) break;
            current = applyResultToDTOs(current, result);
        }
        return last != null ? last.objectiveValue() : Double.NaN;
    }

    /** Applies scheduled dates from a ScheduleResult back to TaskDTO inputs. */
    private List<TaskDTO> applyResultToDTOs(List<TaskDTO> originals, ScheduleOptimizer.ScheduleResult result) {
        List<TaskDTO> updated = new ArrayList<>(originals.size());
        for (TaskDTO t : originals) {
            var s = result.tasks().get(t.taskKey());
            if (s == null || (s.suggestedStart().equals(t.startDate()) && s.suggestedDue().equals(t.dueDate()))) {
                updated.add(t);
            } else {
                updated.add(new TaskDTO(t.id(), t.taskNumber(), t.taskKey(), t.projectKey(),
                        t.summary(), t.description(), t.status(),
                        s.suggestedStart(), s.suggestedDue(),
                        t.assignee(), t.labels(), t.dependencyKeys(),
                        t.isCritical(), t.attachments(), t.created(), t.updated(),
                        t.progress(), t.priority()));
            }
        }
        return updated;
    }

    // ---------- Helpers ----------

    private double std(List<Double> arr) {
        double m = arr.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double sq = 0;
        for (double v : arr) sq += (v - m) * (v - m);
        return arr.size() < 2 ? 0 : Math.sqrt(sq / (arr.size() - 1));
    }

    private List<TaskDTO> generatePortfolioWithSeed(int numProjects, int tasksPerProject,
                                                    int numResources, double conflictRatio, int seed) {
        Random rng = new Random(seed);
        List<TaskDTO> tasks = new ArrayList<>();
        TaskPriority[] priorities = TaskPriority.values();
        double[] cumDist = {0.10, 0.30, 0.70, 0.90, 1.00};

        for (int p = 0; p < numProjects; p++) {
            String projKey = "P" + (char) ('A' + p);
            for (int t = 0; t < tasksPerProject; t++) {
                String key = projKey + "-" + (t + 1);
                int dur = 2 + rng.nextInt(7);
                int startOffset = rng.nextDouble() < conflictRatio
                        ? rng.nextInt(5)
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
