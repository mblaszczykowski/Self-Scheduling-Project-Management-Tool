package com.backend.util;

import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import org.junit.jupiter.api.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;

/**
 * Experiment 13: Comparison of the MORCPSP composite priority rule with
 * classical priority rules from RCPSP literature (Kolisch & Hartmann 2006):
 *  - LFT   (Latest Finish Time)
 *  - MTS   (Most Total Successors)
 *  - GRPW  (Greatest Rank Positional Weight)
 *  - WRUP  (Weighted Resource Utilization and Precedence)
 *
 * Each rule is decoded by the same SSGS kernel, so the comparison isolates
 * the effect of the priority rule alone.
 */
@DisplayName("Chapter 5 / Experiment 13: Priority rules comparison")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ScheduleOptimizerPriorityRulesTest {

    private final ScheduleOptimizer optimizer = new ScheduleOptimizer();
    private static final LocalDate HORIZON = LocalDate.of(2025, 1, 1);
    private static final double ALPHA = 0.8;
    private static final double BETA = 0.2;
    private static final int NUM_SEEDS = 30;

    @Test
    @Order(1)
    @DisplayName("13.1: LFT, MTS, GRPW, WRUP vs MORCPSP on Z and HIGHEST tardiness")
    void experiment13_priorityRulesComparison() {
        String[] rules = {"LFT", "MTS", "GRPW", "WRUP", "MORCPSP"};
        double[][] zValues = new double[rules.length][NUM_SEEDS];
        double[][] highestTard = new double[rules.length][NUM_SEEDS];
        int[] wins = new int[rules.length];

        for (int seed = 0; seed < NUM_SEEDS; seed++) {
            List<TaskDTO> tasks = generatePortfolioWithSeed(3, 15, 3, 0.60, seed);

            // Classical rules (custom SSGS)
            zValues[0][seed] = decodeByRule(tasks, this::scoreLFT);
            zValues[1][seed] = decodeByRule(tasks, this::scoreMTS);
            zValues[2][seed] = decodeByRule(tasks, this::scoreGRPW);
            zValues[3][seed] = decodeByRule(tasks, this::scoreWRUP);

            highestTard[0][seed] = decodeTardinessByRule(tasks, this::scoreLFT, TaskPriority.HIGHEST);
            highestTard[1][seed] = decodeTardinessByRule(tasks, this::scoreMTS, TaskPriority.HIGHEST);
            highestTard[2][seed] = decodeTardinessByRule(tasks, this::scoreGRPW, TaskPriority.HIGHEST);
            highestTard[3][seed] = decodeTardinessByRule(tasks, this::scoreWRUP, TaskPriority.HIGHEST);

            // MORCPSP (existing production optimizer)
            var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            zValues[4][seed] = morcpsp.objectiveValue();
            highestTard[4][seed] = avgTardinessOfPriority(tasks, morcpsp, TaskPriority.HIGHEST);

            // winner for this instance
            int winner = 0;
            for (int r = 1; r < rules.length; r++) {
                if (zValues[r][seed] < zValues[winner][seed]) winner = r;
            }
            wins[winner]++;
        }

        System.out.println("\n=== Experiment 13: Priority rules comparison (n=" + NUM_SEEDS + ") ===\n");
        System.out.printf("%-8s | %-22s | %-22s | %-10s%n",
                "Rule", "Z (mean ± std)", "HIGHEST tard (mean ± std)", "Wins");
        for (int r = 0; r < rules.length; r++) {
            System.out.printf("%-8s | %7.1f ± %6.1f     | %5.2f ± %5.2f          | %d/%d%n",
                    rules[r],
                    mean(zValues[r]), std(zValues[r]),
                    mean(highestTard[r]), std(highestTard[r]),
                    wins[r], NUM_SEEDS);
        }

        System.out.println("\n--- Pairwise comparison: MORCPSP improvement over each rule ---");
        for (int r = 0; r < rules.length - 1; r++) {
            double improvement = (mean(zValues[r]) - mean(zValues[4])) / mean(zValues[r]) * 100;
            System.out.printf("MORCPSP vs %-6s:  Z reduced by %.2f%%%n", rules[r], improvement);
        }
    }

    // ---------- Priority rules (scoring functions) ----------

    /** LFT: lower LF_j → higher priority. We negate so higher score = higher priority. */
    private double scoreLFT(RuleContext ctx, String taskKey) {
        return -ctx.latestFinish.get(taskKey);
    }

    /** MTS: more transitive successors → higher priority. */
    private double scoreMTS(RuleContext ctx, String taskKey) {
        return ctx.transitiveSuccessors.get(taskKey);
    }

    /** GRPW: duration of j + sum of durations of all transitive successors. */
    private double scoreGRPW(RuleContext ctx, String taskKey) {
        return ctx.grpw.get(taskKey);
    }

    /** WRUP: weighted resource utilization and precedence.
     *  Simplified: p_j / R + |Succ_j*|   (R = number of distinct resources in the portfolio). */
    private double scoreWRUP(RuleContext ctx, String taskKey) {
        int duration = ctx.durations.get(taskKey);
        int numResources = Math.max(1, ctx.numResources);
        return (double) duration / numResources + ctx.transitiveSuccessors.get(taskKey);
    }

    // ---------- Decoding: priority-aware Kahn's algorithm + SSGS ----------

    private double decodeByRule(List<TaskDTO> tasks, RuleFunction rule) {
        return runRule(tasks, rule).z;
    }

    private double decodeTardinessByRule(List<TaskDTO> tasks, RuleFunction rule, TaskPriority priority) {
        var out = runRule(tasks, rule);
        double sum = 0;
        int count = 0;
        for (TaskDTO t : tasks) {
            if (t.priority() != priority) continue;
            int[] s = out.scheduled.get(t.taskKey());
            if (s == null) continue;
            int endOffset = s[1] - 1;
            long dueOffset = ChronoUnit.DAYS.between(HORIZON, t.dueDate());
            sum += Math.max(0, endOffset - (int) dueOffset);
            count++;
        }
        return count == 0 ? 0 : sum / count;
    }

    private RuleOutput runRule(List<TaskDTO> tasks, RuleFunction rule) {
        RuleContext ctx = buildRuleContext(tasks);
        ToDoubleFunction<String> priorityFn = key -> rule.score(ctx, key);
        List<String> order = priorityTopoOrder(ctx, priorityFn);
        return decodeSSGS(ctx, order);
    }

    /** Kahn's algorithm with priority selection among ready activities. */
    private List<String> priorityTopoOrder(RuleContext ctx, ToDoubleFunction<String> priorityFn) {
        Map<String, Integer> inDeg = new HashMap<>(ctx.inDegree);
        List<String> result = new ArrayList<>(ctx.byKey.size());
        Set<String> remaining = new HashSet<>(ctx.byKey.keySet());

        while (!remaining.isEmpty()) {
            String best = null;
            double bestScore = Double.NEGATIVE_INFINITY;
            for (String k : remaining) {
                if (inDeg.get(k) != 0) continue;
                double s = priorityFn.applyAsDouble(k);
                if (s > bestScore) { bestScore = s; best = k; }
            }
            if (best == null) {
                // cycle or stuck; pick any remaining to avoid infinite loop
                best = remaining.iterator().next();
            }
            result.add(best);
            remaining.remove(best);
            for (String succ : ctx.successors.getOrDefault(best, List.of())) {
                inDeg.merge(succ, -1, Integer::sum);
            }
        }
        return result;
    }

    private RuleOutput decodeSSGS(RuleContext ctx, List<String> order) {
        Map<String, int[]> scheduled = new HashMap<>();
        Map<String, BitSet> resources = new HashMap<>();
        for (String key : order) {
            TaskDTO t = ctx.byKey.get(key);
            int dur = ctx.durations.get(key);
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
        for (TaskDTO t : ctx.byKey.values()) {
            int[] s = scheduled.get(t.taskKey());
            int endOffset = s[1] - 1;
            makespan = Math.max(makespan, s[1]);
            long dueOffset = ChronoUnit.DAYS.between(HORIZON, t.dueDate());
            int tardiness = Math.max(0, endOffset - (int) dueOffset);
            int w = ScheduleOptimizer.mapPriorityToWeight(t.priority());
            weightedTardiness += w * tardiness;
        }
        double z = ALPHA * weightedTardiness + BETA * makespan;
        return new RuleOutput(z, scheduled);
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

    // ---------- Rule context: precomputed data needed by all rules ----------

    private RuleContext buildRuleContext(List<TaskDTO> tasks) {
        Map<String, TaskDTO> byKey = tasks.stream()
                .collect(Collectors.toMap(TaskDTO::taskKey, t -> t));
        Map<String, Integer> inDegree = new HashMap<>();
        Map<String, List<String>> successors = new HashMap<>();
        Map<String, Integer> durations = new HashMap<>();

        for (TaskDTO t : tasks) {
            int dur = (int) ChronoUnit.DAYS.between(t.startDate(), t.dueDate()) + 1;
            durations.put(t.taskKey(), dur);
            inDegree.putIfAbsent(t.taskKey(), 0);
            if (t.dependencyKeys() == null) continue;
            for (String dep : t.dependencyKeys()) {
                if (byKey.containsKey(dep)) {
                    inDegree.merge(t.taskKey(), 1, Integer::sum);
                    successors.computeIfAbsent(dep, k -> new ArrayList<>()).add(t.taskKey());
                }
            }
        }

        // Topological sort (Kahn's)
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

        // CPM forward pass: earliestFinish
        Map<String, Integer> earliestFinish = new HashMap<>();
        for (String key : topo) {
            TaskDTO t = byKey.get(key);
            int es = 0;
            if (t.dependencyKeys() != null) {
                for (String dep : t.dependencyKeys()) {
                    Integer ef = earliestFinish.get(dep);
                    if (ef != null) es = Math.max(es, ef);
                }
            }
            earliestFinish.put(key, es + durations.get(key));
        }
        int projectLength = earliestFinish.values().stream().max(Integer::compareTo).orElse(0);

        // CPM backward pass: latestFinish
        Map<String, Integer> latestFinish = new HashMap<>();
        for (int i = topo.size() - 1; i >= 0; i--) {
            String key = topo.get(i);
            List<String> succs = successors.getOrDefault(key, List.of());
            int lf;
            if (succs.isEmpty()) {
                lf = projectLength;
            } else {
                lf = Integer.MAX_VALUE;
                for (String s : succs) {
                    lf = Math.min(lf, latestFinish.get(s) - durations.get(s));
                }
            }
            latestFinish.put(key, lf);
        }

        // Transitive successor count (reverse topological)
        Map<String, Integer> transitiveSuccessors = new HashMap<>();
        for (int i = topo.size() - 1; i >= 0; i--) {
            String key = topo.get(i);
            int count = 0;
            for (String s : successors.getOrDefault(key, List.of())) {
                count += 1 + transitiveSuccessors.getOrDefault(s, 0);
            }
            transitiveSuccessors.put(key, count);
        }

        // GRPW: sum of p_j + all descendants' p
        Map<String, Integer> grpw = new HashMap<>();
        for (int i = topo.size() - 1; i >= 0; i--) {
            String key = topo.get(i);
            int sum = durations.get(key);
            for (String s : successors.getOrDefault(key, List.of())) {
                sum += grpw.getOrDefault(s, 0);
            }
            grpw.put(key, sum);
        }

        int numResources = (int) tasks.stream()
                .map(TaskDTO::assignee)
                .filter(Objects::nonNull)
                .distinct()
                .count();

        return new RuleContext(byKey, inDegree, successors, durations,
                earliestFinish, latestFinish, transitiveSuccessors, grpw, numResources);
    }

    // ---------- Data structures ----------

    @FunctionalInterface
    interface RuleFunction {
        double score(RuleContext ctx, String taskKey);
    }

    static class RuleContext {
        final Map<String, TaskDTO> byKey;
        final Map<String, Integer> inDegree;
        final Map<String, List<String>> successors;
        final Map<String, Integer> durations;
        final Map<String, Integer> earliestFinish;
        final Map<String, Integer> latestFinish;
        final Map<String, Integer> transitiveSuccessors;
        final Map<String, Integer> grpw;
        final int numResources;

        RuleContext(Map<String, TaskDTO> byKey, Map<String, Integer> inDegree,
                    Map<String, List<String>> successors, Map<String, Integer> durations,
                    Map<String, Integer> earliestFinish, Map<String, Integer> latestFinish,
                    Map<String, Integer> transitiveSuccessors, Map<String, Integer> grpw,
                    int numResources) {
            this.byKey = byKey;
            this.inDegree = inDegree;
            this.successors = successors;
            this.durations = durations;
            this.earliestFinish = earliestFinish;
            this.latestFinish = latestFinish;
            this.transitiveSuccessors = transitiveSuccessors;
            this.grpw = grpw;
            this.numResources = numResources;
        }
    }

    record RuleOutput(double z, Map<String, int[]> scheduled) {}

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
        return Math.sqrt(sq / (arr.length - 1));
    }

    // ---------- Portfolio generation ----------

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
