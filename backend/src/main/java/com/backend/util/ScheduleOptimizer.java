package com.backend.util;

import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskStatus;
import com.backend.exception.ValidationException;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implements the Serial Schedule Generation Scheme (SSGS) heuristic
 * for the Multi-Objective Resource-Constrained Project Scheduling Problem (MORCPSP).
 *
 * <p>The algorithm schedules tasks one-by-one in priority order, always picking the
 * next task from the <em>eligible set</em> (tasks whose predecessors are all already
 * scheduled). This is what guarantees precedence feasibility by construction: a task
 * is never placed before any of its predecessors has finished. For each chosen task it
 * finds the earliest feasible start time that satisfies both precedence constraints and
 * resource capacity constraints (one person = one task at a time).
 *
 * <p>SSGS is a single-pass constructive heuristic: given a priority rule, the schedule
 * is fully determined in one pass. The multi-objective weights (alpha, beta) only weigh
 * the reported objective value Z; they do not influence the generated schedule.
 *
 * <p>Time complexity: O(n log n + n*H) where n = tasks, H = horizon days.
 * Space complexity: O(n + K*H) where K = distinct assignees.
 *
 * <p>Stateless utility class — no Spring dependencies.
 */
public class ScheduleOptimizer {

    private static final Set<TaskStatus> TERMINAL_STATUSES = Set.of(
            TaskStatus.DONE, TaskStatus.RELEASED, TaskStatus.WITHDRAWN
    );

    private static final int MAX_HORIZON_DAYS = 3650; // 10 years safety bound
    private static final int MIN_HORIZON_DAYS = 30;   // floor so urgency is well-defined for tiny portfolios
    private static final int DEFAULT_PRIORITY_WEIGHT = 5; // MEDIUM if priority is missing

    // Weight of the (normalized) dependency term in the priority score, relative to the
    // weight·urgency term which lies in [0, 10]. Kept below 10 so business priority
    // remains the dominant driver while downstream fan-out still breaks ties meaningfully.
    private static final double DEPENDENCY_PRIORITY_WEIGHT = 5.0;

    // ======================== Public API ========================

    public record ScheduledTask(
            String taskKey,
            LocalDate suggestedStart,
            LocalDate suggestedDue,
            int tardinessDays
    ) {}

    public record ScheduleResult(
            Map<String, ScheduledTask> tasks,
            double weightedTardiness,
            int makespan,
            double objectiveValue,
            int resourceConflicts,
            int tasksShifted
    ) {}

    private enum SchedulingStrategy { MORCPSP, FIFO, SPT }

    /**
     * Run SSGS optimization on the given tasks using the MORCPSP priority rule.
     * Completed tasks are fixed in the graph (their dates don't change) but their
     * end times are respected as precedence constraints. Tasks without dates are skipped.
     *
     * @param tasks        all tasks across the portfolio
     * @param horizonStart the reference date for day-0 of the schedule
     * @param alpha        weight for the (normalized) weighted-tardiness component
     * @param beta         weight for the (normalized) makespan component
     * @return optimized schedule result with zero resource conflicts
     */
    public ScheduleResult optimize(List<TaskDTO> tasks, LocalDate horizonStart, double alpha, double beta) {
        return schedule(tasks, horizonStart, alpha, beta, SchedulingStrategy.MORCPSP);
    }

    /**
     * FIFO baseline: schedule tasks in order of their original start date
     * (first-come-first-served). Same SSGS core, no intelligent prioritization.
     */
    public ScheduleResult optimizeFIFO(List<TaskDTO> tasks, LocalDate horizonStart, double alpha, double beta) {
        return schedule(tasks, horizonStart, alpha, beta, SchedulingStrategy.FIFO);
    }

    /**
     * SPT baseline: schedule tasks by shortest processing time first.
     * Minimizes average flow time but ignores business priorities.
     */
    public ScheduleResult optimizeSPT(List<TaskDTO> tasks, LocalDate horizonStart, double alpha, double beta) {
        return schedule(tasks, horizonStart, alpha, beta, SchedulingStrategy.SPT);
    }

    private ScheduleResult schedule(List<TaskDTO> tasks, LocalDate horizonStart,
                                    double alpha, double beta, SchedulingStrategy strategy) {
        if (tasks == null || tasks.isEmpty()) {
            return emptyResult();
        }

        var taskMap = buildTaskMap(tasks, horizonStart);
        if (taskMap.isEmpty()) {
            return emptyResult();
        }

        buildSuccessorLinks(taskMap);

        var activeTasks = taskMap.values().stream()
                .filter(t -> !t.isCompleted)
                .collect(Collectors.toCollection(ArrayList::new));

        if (activeTasks.isEmpty()) {
            return emptyResult();
        }

        var order = comparatorFor(strategy, taskMap, activeTasks);

        // SSGS core: eligible-set serial decoder.
        // Constraint S_j >= 0 (eq 3.3) means active tasks cannot start before T_0.
        // With horizonStart = today, this naturally prevents scheduling into the past;
        // DONE tasks may have negative scheduledEnd (their historical end), but
        // Math.max(0, earliestPrecedence) clamps the successor's start to today.
        runSSGS(taskMap, activeTasks, order);

        return buildResult(activeTasks, horizonStart, alpha, beta);
    }

    /**
     * Evaluate the objective function for the current (original) schedule.
     * Used to compute "before optimization" metrics, including counting
     * how many resource conflicts exist in the current arrangement.
     */
    public ScheduleResult evaluateOriginal(List<TaskDTO> tasks, LocalDate horizonStart, double alpha, double beta) {
        if (tasks == null || tasks.isEmpty()) {
            return emptyResult();
        }

        var taskMap = buildTaskMap(tasks, horizonStart);
        if (taskMap.isEmpty()) {
            return emptyResult();
        }

        var activeTasks = taskMap.values().stream()
                .filter(t -> !t.isCompleted)
                .collect(Collectors.toCollection(ArrayList::new));

        if (activeTasks.isEmpty()) {
            return emptyResult();
        }

        // Use original positions (may be negative for past-dated tasks).
        for (var task : activeTasks) {
            task.scheduledStart = task.originalStartOffset;
            task.scheduledEnd = task.originalStartOffset + task.duration;
        }

        return buildResult(activeTasks, horizonStart, alpha, beta);
    }

    // ======================== Internal data structure ========================

    private static class SchedulableTask {
        String taskKey;
        int duration;              // in days (inclusive: Jan 1 to Jan 3 = 3)
        int originalStartOffset;   // days from horizonStart to original startDate
        int dueDateOffset;         // days from horizonStart to end of dueDate (exclusive)
        int priorityWeight;        // 1-10 scale
        String assignee;           // email or null
        List<String> predecessors;
        List<String> successors = new ArrayList<>();
        boolean isCompleted;
        int scheduledStart;        // day offset (computed by optimizer)
        int scheduledEnd;          // scheduledStart + duration (exclusive end)
        double priorityScore;      // composite score for scheduling order
    }

    // ======================== Task map construction ========================

    private Map<String, SchedulableTask> buildTaskMap(List<TaskDTO> tasks, LocalDate horizonStart) {
        var map = new LinkedHashMap<String, SchedulableTask>();

        for (var dto : tasks) {
            if (dto.startDate() == null || dto.dueDate() == null) continue;
            if (dto.taskKey() == null) continue;

            var st = new SchedulableTask();
            st.taskKey = dto.taskKey();
            st.duration = calculateDuration(dto.startDate(), dto.dueDate());
            st.originalStartOffset = (int) ChronoUnit.DAYS.between(horizonStart, dto.startDate());
            // dueDateOffset is exclusive end: if dueDate is Jan 3, work finishes at end of Jan 3,
            // which is the start of Jan 4. This matches scheduledEnd semantics.
            st.dueDateOffset = (int) ChronoUnit.DAYS.between(horizonStart, dto.dueDate()) + 1;
            // Map priority to w_j ∈ [1,10] as per MORCPSP model:
            // LOWEST=1, LOW=3, MEDIUM=5, HIGH=8, HIGHEST=10
            st.priorityWeight = dto.priority() != null ? mapPriorityToWeight(dto.priority()) : DEFAULT_PRIORITY_WEIGHT;
            st.assignee = dto.assignee();
            st.predecessors = dto.dependencyKeys() != null
                    ? new ArrayList<>(dto.dependencyKeys()) : new ArrayList<>();
            st.isCompleted = dto.status() != null && TERMINAL_STATUSES.contains(dto.status());

            if (st.isCompleted) {
                // Completed tasks keep their original positions as fixed constraints
                st.scheduledStart = st.originalStartOffset;
                st.scheduledEnd = st.originalStartOffset + st.duration;
            }

            map.put(st.taskKey, st);
        }

        return map;
    }

    private void buildSuccessorLinks(Map<String, SchedulableTask> taskMap) {
        for (var task : taskMap.values()) {
            for (var predKey : task.predecessors) {
                var pred = taskMap.get(predKey);
                if (pred != null) {
                    pred.successors.add(task.taskKey);
                }
            }
        }
    }

    // ======================== Priority ordering ========================

    private Comparator<SchedulableTask> comparatorFor(SchedulingStrategy strategy,
                                                      Map<String, SchedulableTask> taskMap,
                                                      List<SchedulableTask> activeTasks) {
        return switch (strategy) {
            case FIFO -> Comparator.comparingInt((SchedulableTask t) -> t.originalStartOffset)
                    .thenComparing(t -> t.taskKey);
            case SPT -> Comparator.comparingInt((SchedulableTask t) -> t.duration)
                    .thenComparing(t -> t.taskKey);
            case MORCPSP -> {
                int horizonLength = computeHorizonLength(taskMap);
                var successorCounts = computeAllTransitiveSuccessorCounts(taskMap);
                computePriorityScores(activeTasks, successorCounts, horizonLength);
                // Higher score first; tie-break by earlier due date, then higher weight, then key.
                yield (a, b) -> {
                    int cmp = Double.compare(b.priorityScore, a.priorityScore);
                    if (cmp != 0) return cmp;
                    cmp = Integer.compare(a.dueDateOffset, b.dueDateOffset);
                    if (cmp != 0) return cmp;
                    cmp = Integer.compare(b.priorityWeight, a.priorityWeight);
                    if (cmp != 0) return cmp;
                    return a.taskKey.compareTo(b.taskKey);
                };
            }
        };
    }

    /**
     * Compute transitive successor counts for ALL tasks in one pass using
     * reverse topological order. O(n + edges) instead of O(n^2).
     */
    private Map<String, Integer> computeAllTransitiveSuccessorCounts(Map<String, SchedulableTask> taskMap) {
        var counts = new HashMap<String, Integer>();
        var visited = new HashSet<String>();
        var order = new ArrayList<String>();

        for (var key : taskMap.keySet()) {
            topoSortDFS(key, taskMap, visited, order);
        }

        // Process in reverse topological order (leaves first)
        for (var key : order) {
            var task = taskMap.get(key);
            int count = 0;
            for (var succKey : task.successors) {
                count += 1 + counts.getOrDefault(succKey, 0);
            }
            counts.put(key, count);
        }

        return counts;
    }

    private void topoSortDFS(String key, Map<String, SchedulableTask> taskMap,
                             Set<String> visited, List<String> order) {
        if (visited.contains(key)) return;
        visited.add(key);
        var task = taskMap.get(key);
        if (task == null) return;
        for (var succKey : task.successors) {
            topoSortDFS(succKey, taskMap, visited, order);
        }
        order.add(key); // post-order: successors are added before this task
    }

    /**
     * Compute composite scheduling scores. Higher score = schedule earlier.
     *
     * <p>score = w_j · urgency + DEPENDENCY_PRIORITY_WEIGHT · (succs / maxSuccs)
     * <ul>
     *   <li>urgency ∈ [0,1]: tasks with earlier due dates score higher</li>
     *   <li>dependency term ∈ [0,1] (normalized by the largest fan-out): tasks with
     *       more downstream dependents score higher, but the term cannot grow without
     *       bound and swamp the business-priority signal</li>
     * </ul>
     */
    private void computePriorityScores(List<SchedulableTask> activeTasks,
                                       Map<String, Integer> successorCounts,
                                       int horizonLength) {
        int maxSuccs = activeTasks.stream()
                .mapToInt(t -> successorCounts.getOrDefault(t.taskKey, 0))
                .max()
                .orElse(0);

        for (var task : activeTasks) {
            int succs = successorCounts.getOrDefault(task.taskKey, 0);

            double urgencyFactor = horizonLength > 0
                    ? Math.max(0.0, (double) (horizonLength - task.dueDateOffset) / horizonLength)
                    : 0.0;
            double dependencyFactor = maxSuccs > 0 ? (double) succs / maxSuccs : 0.0;

            task.priorityScore = task.priorityWeight * urgencyFactor
                    + DEPENDENCY_PRIORITY_WEIGHT * dependencyFactor;
        }
    }

    // ======================== SSGS core ========================

    /**
     * Eligible-set serial decoder. Maintains, for each active task, the number of its
     * predecessors that are still unscheduled; a task becomes eligible when that count
     * reaches zero. At each step the highest-priority eligible task (per {@code order})
     * is scheduled at its earliest feasible start, then its successors are released.
     *
     * <p>Because a task is only scheduled once all its predecessors are placed,
     * {@link #computeEarliestPrecedenceStart} always sees finalized predecessor end times,
     * so the produced schedule respects every precedence constraint.
     *
     * @throws ValidationException if the active tasks contain a dependency cycle
     *                             (some tasks can never become eligible)
     */
    private void runSSGS(Map<String, SchedulableTask> taskMap,
                         List<SchedulableTask> activeTasks,
                         Comparator<SchedulableTask> order) {
        // Count unscheduled predecessors. Completed predecessors are already fixed,
        // so they don't block; predecessors missing from the map are ignored.
        var unscheduledPreds = new HashMap<String, Integer>();
        for (var task : activeTasks) {
            int count = 0;
            for (var predKey : task.predecessors) {
                var pred = taskMap.get(predKey);
                if (pred != null && !pred.isCompleted) count++;
            }
            unscheduledPreds.put(task.taskKey, count);
        }

        var ready = new PriorityQueue<>(order);
        for (var task : activeTasks) {
            if (unscheduledPreds.get(task.taskKey) == 0) ready.add(task);
        }

        var resourceSchedule = new HashMap<String, BitSet>();
        int scheduledCount = 0;

        while (!ready.isEmpty()) {
            var task = ready.poll();

            int start = Math.max(0, computeEarliestPrecedenceStart(task, taskMap));
            if (task.assignee != null && !task.assignee.isBlank()) {
                start = findEarliestResourceSlot(task.assignee, task.duration, start, resourceSchedule);
                resourceSchedule.computeIfAbsent(task.assignee, k -> new BitSet())
                        .set(start, start + task.duration);
            }
            task.scheduledStart = start;
            task.scheduledEnd = start + task.duration;
            scheduledCount++;

            // Release successors whose last unscheduled predecessor just finished.
            for (var succKey : task.successors) {
                var succ = taskMap.get(succKey);
                if (succ == null || succ.isCompleted) continue;
                var remaining = unscheduledPreds.get(succKey);
                if (remaining == null || remaining == 0) continue;
                unscheduledPreds.put(succKey, remaining - 1);
                if (remaining - 1 == 0) ready.add(succ);
            }
        }

        if (scheduledCount < activeTasks.size()) {
            throw new ValidationException("Circular task dependency detected: schedule cannot be generated");
        }
    }

    /**
     * Find earliest start respecting all predecessor completion times.
     */
    private int computeEarliestPrecedenceStart(SchedulableTask task, Map<String, SchedulableTask> taskMap) {
        int earliest = 0;
        for (var predKey : task.predecessors) {
            var pred = taskMap.get(predKey);
            if (pred != null) {
                earliest = Math.max(earliest, pred.scheduledEnd);
            }
        }
        return earliest;
    }

    /**
     * Find earliest day >= 'earliest' where 'assignee' has 'duration' consecutive free days.
     * Uses BitSet for O(1) per-day availability check.
     *
     * <p>Guaranteed to terminate: BitSet.nextClearBit always returns a valid index,
     * and unset bits beyond the BitSet length are implicitly 0 (free).
     */
    private int findEarliestResourceSlot(String assignee, int duration, int earliest,
                                         Map<String, BitSet> resourceSchedule) {
        var bits = resourceSchedule.get(assignee);
        if (bits == null) return earliest;

        int candidate = earliest;
        int safety = 0;
        while (safety++ < MAX_HORIZON_DAYS) {
            int nextBusy = bits.nextSetBit(candidate);
            // No busy days in [candidate, ...) or next busy day is past our window
            if (nextBusy < 0 || nextBusy >= candidate + duration) {
                return candidate;
            }
            // Jump past the busy stretch
            candidate = bits.nextClearBit(nextBusy);
        }

        // Safety fallback: should never happen in practice
        return candidate;
    }

    // ======================== Metrics & result ========================

    private ScheduleResult buildResult(List<SchedulableTask> activeTasks, LocalDate horizonStart,
                                       double alpha, double beta) {
        double weightedTardiness = 0;
        int makespan = 0;
        int tasksShifted = 0;
        double weightedTardinessReference = 0;

        var scheduledTasks = new HashMap<String, ScheduledTask>();

        for (var task : activeTasks) {
            int effectiveEnd = Math.max(task.scheduledEnd, 0);
            int tardiness = Math.max(0, effectiveEnd - task.dueDateOffset);
            weightedTardiness += task.priorityWeight * tardiness;
            makespan = Math.max(makespan, effectiveEnd);
            weightedTardinessReference += (double) task.priorityWeight * task.duration;

            // Convert offsets back to dates (dueDate is inclusive, so subtract 1 from end offset).
            LocalDate sugStart = horizonStart.plusDays(task.scheduledStart);
            LocalDate sugDue = horizonStart.plusDays(Math.max(task.scheduledEnd - 1, task.scheduledStart));

            if (task.scheduledStart != task.originalStartOffset) tasksShifted++;

            scheduledTasks.put(task.taskKey, new ScheduledTask(task.taskKey, sugStart, sugDue, tardiness));
        }

        double objective = normalizedObjective(weightedTardiness, weightedTardinessReference,
                makespan, horizonLengthOf(activeTasks), alpha, beta);
        int conflicts = countResourceConflicts(activeTasks);

        return new ScheduleResult(scheduledTasks, weightedTardiness, makespan, objective, conflicts, tasksShifted);
    }

    /**
     * Normalized multi-objective value (eq 3.7):
     *   Z = alpha · (WT / WT_ref) + beta · (C_max / H)
     * Both components are mapped to a comparable [0, ~1] scale so that alpha and beta
     * express a genuine trade-off rather than being dominated by raw magnitude.
     * WT_ref = Σ w_j·p_j (weighted total processing time); H = scheduling horizon.
     */
    private double normalizedObjective(double weightedTardiness, double weightedTardinessReference,
                                       int makespan, int horizonLength, double alpha, double beta) {
        double tardinessTerm = weightedTardinessReference > 0
                ? weightedTardiness / weightedTardinessReference : 0.0;
        double makespanTerm = horizonLength > 0 ? (double) makespan / horizonLength : 0.0;
        return alpha * tardinessTerm + beta * makespanTerm;
    }

    /**
     * Count how many tasks have at least one day of resource overlap with
     * another already-placed task assigned to the same person.
     */
    private int countResourceConflicts(List<SchedulableTask> tasks) {
        var resourceDays = new HashMap<String, BitSet>();
        int conflicts = 0;

        for (var task : tasks) {
            if (task.assignee == null || task.assignee.isBlank()) continue;

            int start = Math.max(0, task.scheduledStart);
            int end = Math.max(start, task.scheduledEnd);
            if (start >= end) continue;

            var bits = resourceDays.computeIfAbsent(task.assignee, k -> new BitSet());

            boolean hasConflict = false;
            for (int day = start; day < end; day++) {
                if (bits.get(day)) {
                    hasConflict = true;
                    break;
                }
            }
            if (hasConflict) conflicts++;

            bits.set(start, end);
        }

        return conflicts;
    }

    /**
     * Horizon length H per MORCPSP model (eq 3.6):
     *   H = max( max d_j , sum p_j )
     * The first term ensures (H - d_j)/H ∈ [0,1]; the second is an upper bound
     * for C_max when all tasks share a single resource.
     */
    private int computeHorizonLength(Map<String, SchedulableTask> taskMap) {
        return horizonLengthOf(taskMap.values().stream().filter(t -> !t.isCompleted).toList());
    }

    private int horizonLengthOf(Collection<SchedulableTask> activeTasks) {
        int maxDue = activeTasks.stream().mapToInt(t -> t.dueDateOffset).max().orElse(MIN_HORIZON_DAYS);
        int sumDuration = activeTasks.stream().mapToInt(t -> t.duration).sum();
        int h = Math.max(maxDue, sumDuration);
        return Math.min(Math.max(h, MIN_HORIZON_DAYS), MAX_HORIZON_DAYS);
    }

    /**
     * Map TaskPriority enum to w_j ∈ [1,10] as defined in the MORCPSP model.
     * Full mapping: LOWEST=1, LOW=3, MEDIUM=5, HIGH=8, HIGHEST=10.
     */
    public static int mapPriorityToWeight(com.backend.entities.TaskPriority priority) {
        return switch (priority) {
            case LOWEST -> 1;
            case LOW -> 3;
            case MEDIUM -> 5;
            case HIGH -> 8;
            case HIGHEST -> 10;
        };
    }

    private int calculateDuration(LocalDate startDate, LocalDate dueDate) {
        if (startDate == null || dueDate == null) return 1;
        long days = ChronoUnit.DAYS.between(startDate, dueDate);
        return Math.max(1, (int) days + 1); // inclusive: Jan 1 to Jan 3 = 3 days
    }

    private ScheduleResult emptyResult() {
        return new ScheduleResult(Map.of(), 0, 0, 0, 0, 0);
    }
}
