package com.backend.util;

import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskStatus;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implements the Serial Schedule Generation Scheme (SSGS) heuristic
 * for the Multi-Objective Resource-Constrained Project Scheduling Problem (MORCPSP).
 *
 * The algorithm schedules tasks one-by-one in priority order, finding the earliest
 * feasible start time that satisfies both precedence constraints and resource
 * capacity constraints (one person = one task at a time).
 *
 * Time complexity: O(n^2 + n*H) where n = tasks, H = horizon days.
 * Space complexity: O(n + K*H) where K = distinct assignees.
 *
 * Stateless utility class — no Spring dependencies.
 */
public class ScheduleOptimizer {

    private static final Set<TaskStatus> TERMINAL_STATUSES = Set.of(
            TaskStatus.DONE, TaskStatus.RELEASED, TaskStatus.WITHDRAWN
    );

    private static final int MAX_HORIZON_DAYS = 3650; // 10 years safety bound

    // ======================== Public API ========================

    public record ScheduledTask(
            String taskKey,
            LocalDate suggestedStart,
            LocalDate suggestedDue,
            int tardinessDays,
            boolean isCritical
    ) {}

    public record ScheduleResult(
            Map<String, ScheduledTask> tasks,
            double weightedTardiness,
            int makespan,
            double objectiveValue,
            int resourceConflicts,
            int tasksShifted
    ) {}

    /**
     * Run SSGS optimization on the given tasks.
     * Completed tasks are fixed in the graph (their dates don't change)
     * but their end times are respected as precedence constraints.
     * Tasks without dates are skipped entirely.
     *
     * @param tasks        all tasks across the portfolio
     * @param horizonStart the reference date for day-0 of the schedule
     * @param alpha        weight for weighted tardiness component (e.g. 0.8)
     * @param beta         weight for makespan component (e.g. 0.2)
     * @return optimized schedule result with zero resource conflicts
     */
    public ScheduleResult optimize(List<TaskDTO> tasks, LocalDate horizonStart, double alpha, double beta) {
        if (tasks == null || tasks.isEmpty()) {
            return emptyResult();
        }

        var taskMap = buildTaskMap(tasks, horizonStart);
        if (taskMap.isEmpty()) {
            return emptyResult();
        }

        buildSuccessorLinks(taskMap);

        int horizonLength = computeHorizonLength(taskMap);
        var successorCounts = computeAllTransitiveSuccessorCounts(taskMap);

        var activeTasks = taskMap.values().stream()
                .filter(t -> !t.isCompleted)
                .collect(Collectors.toCollection(ArrayList::new));

        if (activeTasks.isEmpty()) {
            return emptyResult();
        }

        var priorityList = buildPriorityList(activeTasks, successorCounts, horizonLength);

        // SSGS core: schedule tasks one-by-one in priority order
        var resourceSchedule = new HashMap<String, BitSet>();

        for (var task : priorityList) {
            int earliestPrecedence = computeEarliestPrecedenceStart(task, taskMap);
            int start = Math.max(0, earliestPrecedence);

            if (task.assignee != null && !task.assignee.isBlank()) {
                start = findEarliestResourceSlot(task.assignee, task.duration, start, resourceSchedule);
                var bits = resourceSchedule.computeIfAbsent(task.assignee, k -> new BitSet());
                bits.set(start, start + task.duration);
            }

            task.scheduledStart = start;
            task.scheduledEnd = start + task.duration;
        }

        return buildResult(activeTasks, horizonStart, alpha, beta);
    }

    /**
     * FIFO baseline: schedule tasks in order of their original start date (first-come-first-served).
     * Same SSGS core with resource constraints, but no intelligent prioritization.
     */
    public ScheduleResult optimizeFIFO(List<TaskDTO> tasks, LocalDate horizonStart, double alpha, double beta) {
        return optimizeWithStrategy(tasks, horizonStart, alpha, beta, SchedulingStrategy.FIFO);
    }

    /**
     * SPT baseline: schedule tasks by shortest processing time first.
     * Minimizes average flow time but ignores business priorities.
     */
    public ScheduleResult optimizeSPT(List<TaskDTO> tasks, LocalDate horizonStart, double alpha, double beta) {
        return optimizeWithStrategy(tasks, horizonStart, alpha, beta, SchedulingStrategy.SPT);
    }

    private enum SchedulingStrategy { MORCPSP, FIFO, SPT }

    private ScheduleResult optimizeWithStrategy(List<TaskDTO> tasks, LocalDate horizonStart,
                                                 double alpha, double beta, SchedulingStrategy strategy) {
        if (tasks == null || tasks.isEmpty()) return emptyResult();

        var taskMap = buildTaskMap(tasks, horizonStart);
        if (taskMap.isEmpty()) return emptyResult();

        buildSuccessorLinks(taskMap);

        var activeTasks = taskMap.values().stream()
                .filter(t -> !t.isCompleted)
                .collect(Collectors.toCollection(ArrayList::new));

        if (activeTasks.isEmpty()) return emptyResult();

        // Apply strategy-specific ordering
        switch (strategy) {
            case FIFO -> activeTasks.sort(Comparator.comparingInt(t -> t.originalStartOffset));
            case SPT -> activeTasks.sort(Comparator.comparingInt(t -> t.duration));
            case MORCPSP -> {
                int horizonLength = computeHorizonLength(taskMap);
                var successorCounts = computeAllTransitiveSuccessorCounts(taskMap);
                buildPriorityList(activeTasks, successorCounts, horizonLength);
            }
        }

        // Same SSGS core for all strategies
        var resourceSchedule = new HashMap<String, BitSet>();
        for (var task : activeTasks) {
            int earliestPrecedence = computeEarliestPrecedenceStart(task, taskMap);
            int start = Math.max(0, earliestPrecedence);

            if (task.assignee != null && !task.assignee.isBlank()) {
                start = findEarliestResourceSlot(task.assignee, task.duration, start, resourceSchedule);
                var bits = resourceSchedule.computeIfAbsent(task.assignee, k -> new BitSet());
                bits.set(start, start + task.duration);
            }

            task.scheduledStart = start;
            task.scheduledEnd = start + task.duration;
        }

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
                .collect(Collectors.toList());

        if (activeTasks.isEmpty()) {
            return emptyResult();
        }

        // Use original positions
        for (var task : activeTasks) {
            task.scheduledStart = task.originalStartOffset;
            task.scheduledEnd = task.originalStartOffset + task.duration;
        }

        int conflicts = countResourceConflicts(activeTasks);

        double weightedTardiness = 0;
        int makespan = 0;

        var scheduledTasks = new HashMap<String, ScheduledTask>();

        for (var task : activeTasks) {
            int effectiveEnd = Math.max(task.scheduledEnd, 0);
            int tardiness = Math.max(0, effectiveEnd - task.dueDateOffset);
            weightedTardiness += task.priorityWeight * tardiness;
            makespan = Math.max(makespan, effectiveEnd);

            // Convert back to dates (dueDate is inclusive, so subtract 1 from end offset)
            LocalDate sugStart = horizonStart.plusDays(task.scheduledStart);
            LocalDate sugDue = horizonStart.plusDays(Math.max(task.scheduledEnd - 1, task.scheduledStart));

            scheduledTasks.put(task.taskKey, new ScheduledTask(
                    task.taskKey, sugStart, sugDue, tardiness, false
            ));
        }

        double objective = alpha * weightedTardiness + beta * makespan;
        return new ScheduleResult(scheduledTasks, weightedTardiness, makespan, objective, conflicts, 0);
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
            st.priorityWeight = dto.priority() != null ? mapPriorityToWeight(dto.priority()) : 5;
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

    // ======================== Priority list ========================

    /**
     * Compute transitive successor counts for ALL tasks in one pass using
     * reverse topological order. O(n + edges) instead of O(n^2).
     */
    private Map<String, Integer> computeAllTransitiveSuccessorCounts(Map<String, SchedulableTask> taskMap) {
        var counts = new HashMap<String, Integer>();
        var visited = new HashSet<String>();
        var order = new ArrayList<String>();

        // Topological sort (DFS)
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
     * Build priority list using composite scoring.
     * Higher score = schedule earlier (gets resource access first).
     *
     * Score = w_j * urgencyFactor + dependencyFactor
     * - urgencyFactor: tasks with earlier due dates score higher
     * - dependencyFactor: tasks with more downstream dependents score higher
     */
    private List<SchedulableTask> buildPriorityList(
            List<SchedulableTask> activeTasks,
            Map<String, Integer> successorCounts,
            int horizonLength
    ) {
        for (var task : activeTasks) {
            int succs = successorCounts.getOrDefault(task.taskKey, 0);

            double urgencyFactor = horizonLength > 0
                    ? Math.max(0.0, (double) (horizonLength - task.dueDateOffset) / horizonLength)
                    : 0.0;
            double dependencyFactor = succs * 0.5;

            task.priorityScore = task.priorityWeight * urgencyFactor + dependencyFactor;
        }

        activeTasks.sort((a, b) -> {
            int cmp = Double.compare(b.priorityScore, a.priorityScore);
            if (cmp != 0) return cmp;
            // Tie-break: earlier due date first, then higher weight
            cmp = Integer.compare(a.dueDateOffset, b.dueDateOffset);
            if (cmp != 0) return cmp;
            return Integer.compare(b.priorityWeight, a.priorityWeight);
        });

        return activeTasks;
    }

    // ======================== SSGS core ========================

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
     * Guaranteed to terminate: BitSet.nextClearBit always returns a valid index,
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

    private ScheduleResult buildResult(
            List<SchedulableTask> activeTasks,
            LocalDate horizonStart,
            double alpha, double beta
    ) {
        double weightedTardiness = 0;
        int makespan = 0;
        int tasksShifted = 0;

        var scheduledTasks = new HashMap<String, ScheduledTask>();

        for (var task : activeTasks) {
            int tardiness = Math.max(0, task.scheduledEnd - task.dueDateOffset);
            weightedTardiness += task.priorityWeight * tardiness;
            makespan = Math.max(makespan, task.scheduledEnd);

            // Convert offsets back to dates
            // suggestedStart = horizonStart + scheduledStart days
            // suggestedDue = horizonStart + (scheduledEnd - 1) days (inclusive end date)
            LocalDate sugStart = horizonStart.plusDays(task.scheduledStart);
            LocalDate sugDue = horizonStart.plusDays(Math.max(task.scheduledEnd - 1, task.scheduledStart));

            boolean shifted = task.scheduledStart != task.originalStartOffset;
            if (shifted) tasksShifted++;

            scheduledTasks.put(task.taskKey, new ScheduledTask(
                    task.taskKey, sugStart, sugDue, tardiness, false
            ));
        }

        double objective = alpha * weightedTardiness + beta * makespan;
        int conflicts = countResourceConflicts(activeTasks);

        return new ScheduleResult(scheduledTasks, weightedTardiness, makespan, objective, conflicts, tasksShifted);
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

            // Check if any day in [start, end) is already occupied
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

    private int computeHorizonLength(Map<String, SchedulableTask> taskMap) {
        int maxOffset = taskMap.values().stream()
                .mapToInt(t -> Math.max(t.dueDateOffset, t.originalStartOffset + t.duration))
                .max()
                .orElse(365);
        return Math.min(Math.max(maxOffset, 30), MAX_HORIZON_DAYS);
    }

    /**
     * Map TaskPriority enum to w_j ∈ [1,10] as defined in the MORCPSP model.
     * Paper specifies: HIGHEST=10, MEDIUM=5, LOW=1.
     * Full mapping: LOWEST=1, LOW=3, MEDIUM=5, HIGH=8, HIGHEST=10
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
