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
 * Experiment 12: Optimality gap of MORCPSP heuristic.
 *
 * For small instances, the optimum Z* is computed by exhaustive enumeration
 * of all topological orderings. For larger instances, random-restart
 * topological sampling (10^5 draws) serves as a strong lower bound proxy.
 *
 * The gap is defined as:   gap = (Z_MORCPSP - Z*) / Z* * 100%
 *
 * Topological orders are enumerated via backtracking (Kahn's algorithm variant).
 * Each ordering is decoded with a self-contained SSGS scheduler that mirrors
 * the semantics of {@link ScheduleOptimizer}.
 */
@DisplayName("Chapter 5 / Experiment 12: Optimality gap (brute-force)")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ScheduleOptimizerOptimalityGapTest {

    private final ScheduleOptimizer optimizer = new ScheduleOptimizer();
    private static final LocalDate HORIZON = LocalDate.of(2025, 1, 1);
    private static final double ALPHA = 0.8;
    private static final double BETA = 0.2;

    @Test
    @Order(1)
    @DisplayName("12.1: Optimality gap on small instances (N = 5..8, exhaustive enumeration)")
    void experiment12_optimalityGapExhaustive() {
        int[] sizes = {5, 6, 7, 8};
        int instancesPerSize = 30;

        System.out.println("\n=== Experiment 12.1: Exhaustive optimality gap ===\n");
        System.out.printf("%-4s | %-10s | %-10s | %-10s | %-8s | %-8s%n",
                "N", "#instances", "Z* (avg)", "Z_MORCPSP (avg)", "gap %", "max gap %");

        for (int n : sizes) {
            double sumOpt = 0, sumMorcpsp = 0, sumGap = 0, maxGap = 0;
            int optimalCount = 0;

            for (int seed = 0; seed < instancesPerSize; seed++) {
                List<TaskDTO> tasks = generateSmallInstance(n, 2, seed);
                double zOpt = findOptimumExhaustive(tasks);
                var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
                double zMorcpsp = morcpsp.objectiveValue();
                double gap = zOpt > 0 ? (zMorcpsp - zOpt) / zOpt * 100.0 : 0.0;
                sumOpt += zOpt;
                sumMorcpsp += zMorcpsp;
                sumGap += gap;
                if (gap > maxGap) maxGap = gap;
                if (Math.abs(zMorcpsp - zOpt) < 1e-6) optimalCount++;
            }

            System.out.printf("%-4d | %-10d | %-10.1f | %-10.1f      | %6.2f%%   | %6.2f%%%n",
                    n, instancesPerSize, sumOpt / instancesPerSize, sumMorcpsp / instancesPerSize,
                    sumGap / instancesPerSize, maxGap);
            System.out.printf("     | Optimal solutions found: %d/%d (%.1f%%)%n",
                    optimalCount, instancesPerSize, 100.0 * optimalCount / instancesPerSize);
        }
    }

    @Test
    @Order(2)
    @DisplayName("12.2: Optimality gap on medium instances (N = 10..15, random topological sampling)")
    void experiment12_optimalityGapSampling() {
        int[] sizes = {10, 12, 15};
        int instancesPerSize = 20;
        int samples = 100_000;

        System.out.println("\n=== Experiment 12.2: Sampling-based lower bound (100k topological orders) ===\n");
        System.out.printf("%-4s | %-10s | %-12s | %-12s | %-8s%n",
                "N", "#instances", "Z_lb (avg)", "Z_MORCPSP (avg)", "gap %");

        for (int n : sizes) {
            double sumLb = 0, sumMorcpsp = 0, sumGap = 0;
            for (int seed = 0; seed < instancesPerSize; seed++) {
                List<TaskDTO> tasks = generateSmallInstance(n, 3, seed);
                double zLb = findBestBySampling(tasks, samples, seed);
                var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
                double zMorcpsp = morcpsp.objectiveValue();
                double gap = zLb > 0 ? (zMorcpsp - zLb) / zLb * 100.0 : 0.0;
                sumLb += zLb;
                sumMorcpsp += zMorcpsp;
                sumGap += gap;
            }
            System.out.printf("%-4d | %-10d | %-12.1f | %-12.1f    | %6.2f%%%n",
                    n, instancesPerSize, sumLb / instancesPerSize, sumMorcpsp / instancesPerSize,
                    sumGap / instancesPerSize);
        }
    }

    // ---------- Exhaustive enumeration over topological orders ----------

    private double findOptimumExhaustive(List<TaskDTO> tasks) {
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
        double[] bestZ = {Double.POSITIVE_INFINITY};
        List<String> current = new ArrayList<>();
        enumerate(byKey, inDegree, successors, current, bestZ);
        return bestZ[0];
    }

    private void enumerate(Map<String, TaskDTO> byKey,
                           Map<String, Integer> inDegree,
                           Map<String, List<String>> successors,
                           List<String> current,
                           double[] bestZ) {
        if (current.size() == byKey.size()) {
            double z = computeZForOrder(byKey, current);
            if (z < bestZ[0]) bestZ[0] = z;
            return;
        }
        List<String> ready = new ArrayList<>();
        for (String key : byKey.keySet()) {
            if (!current.contains(key) && inDegree.get(key) == 0) ready.add(key);
        }
        for (String key : ready) {
            current.add(key);
            List<String> succs = successors.getOrDefault(key, Collections.emptyList());
            for (String s : succs) inDegree.merge(s, -1, Integer::sum);
            enumerate(byKey, inDegree, successors, current, bestZ);
            current.remove(current.size() - 1);
            for (String s : succs) inDegree.merge(s, 1, Integer::sum);
        }
    }

    // ---------- Random-restart topological sampling ----------

    private double findBestBySampling(List<TaskDTO> tasks, int samples, int seed) {
        Map<String, TaskDTO> byKey = tasks.stream()
                .collect(Collectors.toMap(TaskDTO::taskKey, t -> t));
        Map<String, Integer> inDegreeTemplate = new HashMap<>();
        Map<String, List<String>> successors = new HashMap<>();
        for (TaskDTO t : tasks) {
            inDegreeTemplate.putIfAbsent(t.taskKey(), 0);
            if (t.dependencyKeys() == null) continue;
            for (String dep : t.dependencyKeys()) {
                if (byKey.containsKey(dep)) {
                    inDegreeTemplate.merge(t.taskKey(), 1, Integer::sum);
                    successors.computeIfAbsent(dep, k -> new ArrayList<>()).add(t.taskKey());
                }
            }
        }

        Random rng = new Random(seed * 31L + 17);
        double best = Double.POSITIVE_INFINITY;

        for (int s = 0; s < samples; s++) {
            Map<String, Integer> inDeg = new HashMap<>(inDegreeTemplate);
            List<String> order = new ArrayList<>(byKey.size());
            while (order.size() < byKey.size()) {
                List<String> ready = new ArrayList<>();
                for (var e : inDeg.entrySet()) {
                    if (e.getValue() == 0 && !order.contains(e.getKey())) ready.add(e.getKey());
                }
                String chosen = ready.get(rng.nextInt(ready.size()));
                order.add(chosen);
                inDeg.put(chosen, -1);
                for (String succ : successors.getOrDefault(chosen, Collections.emptyList())) {
                    inDeg.merge(succ, -1, Integer::sum);
                }
            }
            double z = computeZForOrder(byKey, order);
            if (z < best) best = z;
        }
        return best;
    }

    // ---------- Self-contained SSGS decoder (mirrors ScheduleOptimizer semantics) ----------

    private double computeZForOrder(Map<String, TaskDTO> byKey, List<String> order) {
        Map<String, int[]> scheduled = new HashMap<>(); // key -> [start, end exclusive]
        Map<String, BitSet> resources = new HashMap<>();

        for (String key : order) {
            TaskDTO t = byKey.get(key);
            int dur = (int) ChronoUnit.DAYS.between(t.startDate(), t.dueDate()) + 1;
            int es = 0;
            if (t.dependencyKeys() != null) {
                for (String dep : t.dependencyKeys()) {
                    int[] s = scheduled.get(dep);
                    if (s != null) es = Math.max(es, s[1]);
                }
            }
            int start;
            if (t.assignee() != null) {
                BitSet bs = resources.computeIfAbsent(t.assignee(), k -> new BitSet());
                start = findSlot(bs, es, dur);
                bs.set(start, start + dur);
            } else {
                start = es;
            }
            scheduled.put(key, new int[]{start, start + dur});
        }

        double weightedTardiness = 0;
        int makespan = 0;
        for (TaskDTO t : byKey.values()) {
            int[] s = scheduled.get(t.taskKey());
            int endOffset = s[1] - 1; // inclusive last day
            makespan = Math.max(makespan, s[1]);
            long dueOffset = ChronoUnit.DAYS.between(HORIZON, t.dueDate());
            int tardiness = Math.max(0, endOffset - (int) dueOffset);
            int w = ScheduleOptimizer.mapPriorityToWeight(t.priority());
            weightedTardiness += w * tardiness;
        }
        return ALPHA * weightedTardiness + BETA * makespan;
    }

    private int findSlot(BitSet bs, int earliest, int duration) {
        int candidate = earliest;
        int safety = 0;
        while (safety++ < 3650) {
            int nextBusy = bs.nextSetBit(candidate);
            if (nextBusy < 0 || nextBusy >= candidate + duration) return candidate;
            candidate = bs.nextClearBit(nextBusy);
        }
        return earliest;
    }

    // ---------- Instance generation ----------

    private List<TaskDTO> generateSmallInstance(int n, int numResources, int seed) {
        Random rng = new Random(seed);
        TaskPriority[] priorities = TaskPriority.values();
        double[] cumDist = {0.20, 0.40, 0.70, 0.90, 1.00}; // skewed: more HIGH/HIGHEST for interesting gaps
        List<TaskDTO> tasks = new ArrayList<>();

        for (int i = 0; i < n; i++) {
            String key = "T-" + (i + 1);
            int dur = 2 + rng.nextInt(5);
            int startOffset = rng.nextInt(Math.max(1, n));
            LocalDate start = HORIZON.plusDays(startOffset);
            LocalDate end = start.plusDays(dur - 1);
            String assignee = "dev" + (rng.nextInt(numResources) + 1) + "@x";
            double r = rng.nextDouble();
            TaskPriority priority = TaskPriority.MEDIUM;
            for (int k = 0; k < cumDist.length; k++) {
                if (r < cumDist[k]) {
                    priority = priorities[4 - k];
                    break;
                }
            }
            List<String> deps = new ArrayList<>();
            if (i > 0 && rng.nextDouble() < 0.25) {
                deps.add("T-" + (1 + rng.nextInt(i)));
            }
            tasks.add(new TaskDTO(null, null, key, "PROJ", key, null,
                    TaskStatus.IN_PROGRESS, start, end, assignee,
                    null, deps, null, null, null, null, null, priority));
        }
        return tasks;
    }
}
