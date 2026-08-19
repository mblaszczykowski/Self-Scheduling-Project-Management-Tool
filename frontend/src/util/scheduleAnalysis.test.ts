import {
    computeAssigneeLoad,
    computeCompletionTrend,
    computeDependencyChainAnalysis,
    computeOptimizationOpportunity,
    computePriorityDistribution,
    computeProjectVelocity,
    computeResourceConflicts,
    computeScheduleHealth,
    computeSlackDistribution,
    computeStatusDistribution,
    ResourceConflicts,
    ScheduleHealth,
} from './scheduleAnalysis';
import { EnrichedTask, ProcessedProject } from '../types';

// All fixture dates are bare 'YYYY-MM-DD', which parses as UTC midnight, so the day arithmetic
// under test is exact in every timezone the suite might run in.
const TODAY = new Date('2024-06-11');

let nextId = 1;

const task = (overrides: Partial<EnrichedTask> & Pick<EnrichedTask, 'taskKey'>): EnrichedTask => ({
    id: nextId++,
    taskNumber: nextId,
    projectKey: 'P',
    summary: `Summary of ${overrides.taskKey}`,
    status: 'TODO',
    labels: [],
    dependencyKeys: [],
    assigneeName: '',
    attachments: [],
    progress: 0,
    priority: 'MEDIUM',
    duration: 1,
    dependencies: [],
    isDelayed: false,
    isUpcomingDeadline: false,
    isDelayedByDependency: false,
    ...overrides,
});

const project = (projectKey: string, tasks: EnrichedTask[]): ProcessedProject => ({
    id: nextId++,
    projectKey,
    summary: projectKey,
    tasks,
    members: [],
    attachments: [],
    dependencies: [],
    projectProgress: 0,
});

const byKey = (tasks: EnrichedTask[]) => new Map(tasks.map(t => [t.taskKey, t]));

describe('computeSlackDistribution', () => {
    // Float itself is computed server-side (CriticalPathAnalyzer) and arrives as `totalFloat`;
    // what is under test here is the bucketing and which tasks are counted at all.
    test('buckets each task by the float the server reported', () => {
        const result = computeSlackDistribution([
            task({ taskKey: 'A', totalFloat: 0, startDate: '2024-06-01', dueDate: '2024-06-06' }),
            task({ taskKey: 'B', totalFloat: 2, startDate: '2024-06-01', dueDate: '2024-06-06' }),
            task({ taskKey: 'C', totalFloat: 4, startDate: '2024-06-01', dueDate: '2024-06-06' }),
            task({ taskKey: 'D', totalFloat: 8, startDate: '2024-06-01', dueDate: '2024-06-06' }),
            task({ taskKey: 'E', totalFloat: 40, startDate: '2024-06-01', dueDate: '2024-06-06' }),
        ]);

        expect(result.totalScheduled).toBe(5);
        expect(result.zeroSlackCount).toBe(1);
        expect(result.avgSlack).toBe(11);
        expect(result.buckets.map(b => [b.id, b.count])).toEqual([
            ['none', 1],
            ['tight', 1],
            ['moderate', 1],
            ['comfortable', 1],
            ['ample', 1],
        ]);
    });

    test('ignores finished work, however its completion is expressed', () => {
        const result = computeSlackDistribution([
            task({ taskKey: 'OPEN', totalFloat: 0, startDate: '2024-06-01', dueDate: '2024-06-06' }),
            task({ taskKey: 'AT_100', totalFloat: 5, progress: 100, startDate: '2024-06-01', dueDate: '2024-06-06' }),
            task({ taskKey: 'DONE', totalFloat: 5, status: 'DONE', startDate: '2024-06-01', dueDate: '2024-06-06' }),
            task({ taskKey: 'RELEASED', totalFloat: 5, status: 'RELEASED', startDate: '2024-06-01', dueDate: '2024-06-06' }),
            task({ taskKey: 'WITHDRAWN', totalFloat: 5, status: 'WITHDRAWN', startDate: '2024-06-01', dueDate: '2024-06-06' }),
        ]);

        expect(result.totalScheduled).toBe(1);
        expect(result.zeroSlackCount).toBe(1);
    });

    test('ignores tasks the server reported no float for, and undated ones', () => {
        const result = computeSlackDistribution([
            task({ taskKey: 'COUNTED', totalFloat: 3, startDate: '2024-06-01', dueDate: '2024-06-06' }),
            task({ taskKey: 'NO_FLOAT', startDate: '2024-06-01', dueDate: '2024-06-06' }),
            task({ taskKey: 'NULL_FLOAT', totalFloat: null, startDate: '2024-06-01', dueDate: '2024-06-06' }),
            task({ taskKey: 'UNDATED', totalFloat: 3 }),
        ]);

        expect(result.totalScheduled).toBe(1);
        expect(result.buckets.find(b => b.id === 'moderate')?.count).toBe(1);
    });

    test('treats a negative float as zero rather than bucketing it below none', () => {
        const result = computeSlackDistribution([
            task({ taskKey: 'LATE', totalFloat: -4, startDate: '2024-06-01', dueDate: '2024-06-06' }),
        ]);

        expect(result.zeroSlackCount).toBe(1);
        expect(result.avgSlack).toBe(0);
        expect(result.buckets.find(b => b.id === 'none')?.count).toBe(1);
    });

    test('reports an empty distribution when nothing is measurable', () => {
        const result = computeSlackDistribution([task({ taskKey: 'UNDATED' })]);

        expect(result.totalScheduled).toBe(0);
        expect(result.buckets).toEqual([]);
    });
});

describe('computeResourceConflicts', () => {
    const tasks = [
        task({ taskKey: 'A-1', assignee: 'alice@x.com', startDate: '2024-06-01', dueDate: '2024-06-10' }),
        task({ taskKey: 'A-2', assignee: 'alice@x.com', startDate: '2024-06-08', dueDate: '2024-06-12', isCritical: true }),
        task({ taskKey: 'A-3', assignee: 'alice@x.com', startDate: '2024-06-20', dueDate: '2024-06-25' }),
        task({ taskKey: 'B-1', assignee: 'bob@x.com', startDate: '2024-06-01', dueDate: '2024-06-05' }),
        task({ taskKey: 'B-2', assignee: 'bob@x.com', startDate: '2024-06-03', dueDate: '2024-06-04' }),
        // Neither of these can double-book anyone: nobody owns the first, and the second is over.
        task({ taskKey: 'X-1', startDate: '2024-06-01', dueDate: '2024-06-10' }),
        task({ taskKey: 'X-2', assignee: 'alice@x.com', progress: 100, startDate: '2024-06-01', dueDate: '2024-06-10' }),
    ];

    const result = computeResourceConflicts(tasks);

    test('reports one conflict per overlapping pair', () => {
        expect(result.totalConflicts).toBe(2);
        expect(result.affectedAssignees).toEqual(['alice@x.com', 'bob@x.com']);
    });

    test('measures the overlap in days and orders the worst first', () => {
        expect(result.conflicts[0]).toEqual({
            assignee: 'alice@x.com',
            task1: 'A-1',
            task2: 'A-2',
            overlapDays: 3,
            involvesCritical: true,
        });
        // B-1 06-01..06-05 and B-2 06-03..06-04 share 06-03 and 06-04.
        expect(result.conflicts[1].overlapDays).toBe(2);
    });

    test('counts the conflicts that touch the critical path', () => {
        expect(result.criticalConflicts).toBe(1);
    });

    test('back-to-back tasks are not a conflict', () => {
        const backToBack = [
            task({ taskKey: 'C-1', assignee: 'carol@x.com', startDate: '2024-06-01', dueDate: '2024-06-05' }),
            task({ taskKey: 'C-2', assignee: 'carol@x.com', startDate: '2024-06-06', dueDate: '2024-06-09' }),
        ];

        expect(computeResourceConflicts(backToBack).totalConflicts).toBe(0);
    });

    // Due dates are inclusive, so a task ending on the 5th and one starting on the 5th both want
    // carol that day. The optimizer agrees — its decoder occupies [start, start + duration) with
    // an inclusive duration, so it refuses to place the second task on that boundary day — and
    // the dashboard used to disagree with it, reporting zero conflicts for a board the scheduler
    // considered infeasible.
    test('sharing only the boundary day is still a double-booking', () => {
        const touching = [
            task({ taskKey: 'C-1', assignee: 'carol@x.com', startDate: '2024-06-01', dueDate: '2024-06-05' }),
            task({ taskKey: 'C-2', assignee: 'carol@x.com', startDate: '2024-06-05', dueDate: '2024-06-09' }),
        ];

        const result = computeResourceConflicts(touching);
        expect(result.totalConflicts).toBe(1);
        expect(result.conflicts[0].overlapDays).toBe(1);
    });

    test('three mutually overlapping tasks yield all three pairs', () => {
        const overlapping = ['D-1', 'D-2', 'D-3'].map(taskKey =>
            task({ taskKey, assignee: 'dave@x.com', startDate: '2024-06-01', dueDate: '2024-06-10' }));

        expect(computeResourceConflicts(overlapping).totalConflicts).toBe(3);
    });
});

describe('computeScheduleHealth', () => {
    // Every task below spans 2024-06-01 → 2024-06-11 unless stated, so on TODAY it is 100% elapsed.
    const tasks = [
        task({ taskKey: 'CRIT', startDate: '2024-06-01', dueDate: '2024-06-11', progress: 40 }),
        task({ taskKey: 'BEHIND', startDate: '2024-06-01', dueDate: '2024-06-11', progress: 80 }),
        task({ taskKey: 'SLIGHT', startDate: '2024-06-01', dueDate: '2024-06-11', progress: 90 }),
        task({ taskKey: 'ONTRACK', startDate: '2024-06-06', dueDate: '2024-06-16', progress: 60 }),
        task({ taskKey: 'FUTURE', startDate: '2024-06-16', dueDate: '2024-06-26' }),
        task({ taskKey: 'FINISHED', startDate: '2024-06-01', dueDate: '2024-06-11', progress: 100 }),
        task({ taskKey: 'UNDATED', progress: 10 }),
    ];

    const result = computeScheduleHealth(tasks, TODAY);

    test('buckets active tasks by how far behind their own dates they are', () => {
        expect(result.totalActive).toBe(5); // FINISHED and UNDATED are not tracked
        expect(result.onTrack).toBe(1);
        expect(result.slightlyBehind).toBe(1);
        expect(result.behind).toBe(1);
        expect(result.criticallyBehind).toBe(1);
        expect(result.notStarted).toBe(1);
    });

    test('scores slightly-behind work at partial credit', () => {
        // (onTrack 1 + notStarted 1 + slightlyBehind 1 × 0.7) / 5 active
        expect(result.scheduleHealthScore).toBe(54);
    });

    test('lists the worst offenders with their progress gap', () => {
        expect(result.worstBehind).toEqual([
            { taskKey: 'CRIT', progress: 40, expected: 100, gap: 60 },
            { taskKey: 'BEHIND', progress: 80, expected: 100, gap: 20 },
        ]);
    });

    // Nothing scheduled means nothing behind, so this reports healthy rather than 0% — the same
    // convention computeCriticalPathHealth uses for an empty set. The two cards sat side by side
    // reading 100% and 0% off the same empty portfolio before this agreed.
    test('an empty schedule scores as healthy, not as critically behind', () => {
        expect(computeScheduleHealth([], TODAY))
            .toMatchObject({ scheduleHealthScore: 100, totalActive: 0 });
    });
});

describe('computeDependencyChainAnalysis', () => {
    test('measures depth through the deepest branch of a diamond', () => {
        // Deliberately listed successors-first, so the DFS descends rather than reading a memo.
        const tasks = [
            task({ taskKey: 'D', dependencies: ['B', 'C'] }),
            task({ taskKey: 'B', dependencies: ['A'] }),
            task({ taskKey: 'C', dependencies: ['A'] }),
            task({ taskKey: 'A' }),
        ];

        const result = computeDependencyChainAnalysis(tasks, byKey(tasks));

        expect(result.longestChainLength).toBe(2);
        expect(result.bottlenecks[0]).toEqual({
            taskKey: 'A',
            summary: 'Summary of A',
            isCritical: false,
            progress: 0,
            dependentCount: 2,
        });
    });

    test('completed tasks are not bottlenecks', () => {
        const tasks = [
            task({ taskKey: 'A', progress: 100 }),
            task({ taskKey: 'B', dependencies: ['A'] }),
        ];

        expect(computeDependencyChainAnalysis(tasks, byKey(tasks)).bottlenecks).toEqual([]);
    });

    test('a cycle terminates instead of recursing forever', () => {
        const tasks = [
            task({ taskKey: 'A', dependencies: ['B'] }),
            task({ taskKey: 'B', dependencies: ['A'] }),
        ];

        // The guard stops the walk when it meets a key already on the path, so depth is bounded
        // by the number of tasks rather than growing without end.
        expect(computeDependencyChainAnalysis(tasks, byKey(tasks)).longestChainLength).toBe(2);
    });
});

describe('computeProjectVelocity', () => {
    test('derives the daily progress rate each project still needs', () => {
        const tasks = [
            task({ taskKey: 'V-1', startDate: '2024-06-01', dueDate: '2024-06-21', progress: 50 }),
            task({ taskKey: 'V-2', startDate: '2024-06-01', dueDate: '2024-06-13', progress: 0 }),
            task({ taskKey: 'V-3', startDate: '2024-06-01', dueDate: '2024-06-13', progress: 100 }),
        ];

        const [velocity] = computeProjectVelocity([project('P', tasks)], TODAY);

        expect(velocity).toEqual({
            projectKey: 'P',
            activeTasks: 2,
            avgVelocityNeeded: 13, // 150 points of progress left over 12 remaining task-days
            urgentCount: 1, // V-2 needs 50%/day
            status: 'tight',
        });
    });

    test('work with no time left reports the out-of-time rate', () => {
        const overdue = [task({ taskKey: 'O-1', startDate: '2024-06-01', dueDate: '2024-06-05', progress: 10 })];

        expect(computeProjectVelocity([project('P', overdue)], TODAY)[0].avgVelocityNeeded).toBe(999);
    });

    test('projects with nothing active are left out entirely', () => {
        const done = [task({ taskKey: 'X', startDate: '2024-06-01', dueDate: '2024-06-05', progress: 100 })];

        expect(computeProjectVelocity([project('P', done)], TODAY)).toEqual([]);
    });
});

describe('distributions', () => {
    const tasks = [
        task({ taskKey: 'A', status: 'IN_PROGRESS', priority: 'HIGH' }),
        task({ taskKey: 'B', status: 'TODO', priority: 'LOWEST' }),
        task({ taskKey: 'C', status: 'IN_PROGRESS', priority: 'HIGH' }),
        task({ taskKey: 'D', status: 'DONE', priority: 'MEDIUM' }),
    ];

    test('statuses keep the order they first appear in', () => {
        expect(computeStatusDistribution(tasks)).toEqual([
            { status: 'IN_PROGRESS', count: 2 },
            { status: 'TODO', count: 1 },
            { status: 'DONE', count: 1 },
        ]);
    });

    test('priorities read low-to-high, with empty levels dropped', () => {
        expect(computePriorityDistribution(tasks)).toEqual([
            { priority: 'LOWEST', count: 1 },
            { priority: 'MEDIUM', count: 1 },
            { priority: 'HIGH', count: 2 },
        ]);
    });
});

describe('computeCompletionTrend', () => {
    test('buckets completions into eight trailing weeks, newest last', () => {
        const tasks = [
            task({ taskKey: 'A', status: 'DONE', updated: '2024-06-11T10:00:00' }),
            task({ taskKey: 'B', status: 'RELEASED', updated: '2024-06-09T10:00:00' }),
            task({ taskKey: 'C', status: 'IN_PROGRESS', updated: '2024-06-10T10:00:00' }),
            task({ taskKey: 'D', status: 'DONE', updated: '2023-01-01T10:00:00' }),
        ];

        const trend = computeCompletionTrend(tasks, new Date('2024-06-11T12:00:00'));

        expect(trend).toHaveLength(8);
        expect(trend[7]).toEqual({ label: '6/11', count: 2 });
        expect(trend.slice(0, 7).every(w => w.count === 0)).toBe(true);
    });

    test('withdrawn work is not counted as completed', () => {
        const tasks = [
            task({ taskKey: 'DELIVERED', status: 'DONE', updated: '2024-06-11T10:00:00' }),
            task({ taskKey: 'CANCELLED', status: 'WITHDRAWN', updated: '2024-06-11T10:00:00' }),
        ];

        // WITHDRAWN is terminal but cancelled; counting it would inflate "weekly completed tasks".
        const trend = computeCompletionTrend(tasks, new Date('2024-06-11T12:00:00'));

        expect(trend[7]).toEqual({ label: '6/11', count: 1 });
    });
});

describe('computeAssigneeLoad', () => {
    test('ranks by critical and overdue work ahead of raw task count', () => {
        const tasks = [
            task({ taskKey: 'A-1', assignee: 'alice@x.com', isCritical: true }),
            task({ taskKey: 'A-2', assignee: 'alice@x.com', isDelayed: true }),
            ...['B-1', 'B-2', 'B-3', 'B-4'].map(taskKey => task({ taskKey, assignee: 'bob@x.com' })),
            task({ taskKey: 'C-1', assignee: 'carol@x.com', progress: 100, isCritical: true }),
            task({ taskKey: 'U-1', isCritical: true }),
        ];

        const load = computeAssigneeLoad(tasks);

        // Alice weighs 10 + 5 + 2 = 17, Bob only 4; carol's finished work and the unassigned task
        // are not a load on anyone.
        expect(load).toEqual([
            { assignee: 'alice@x.com', total: 2, critical: 1, overdue: 1 },
            { assignee: 'bob@x.com', total: 4, critical: 0, overdue: 0 },
        ]);
    });
});

describe('computeOptimizationOpportunity', () => {
    const conflicts = (over: Partial<ResourceConflicts>): ResourceConflicts => ({
        totalConflicts: 0, criticalConflicts: 0, conflicts: [], affectedAssignees: [], ...over,
    });
    const health = (over: Partial<ScheduleHealth>): ScheduleHealth => ({
        scheduleHealthScore: 100, onTrack: 0, slightlyBehind: 0, behind: 0, criticallyBehind: 0,
        notStarted: 0, totalActive: 5, worstBehind: [], ...over,
    });

    test('caps each symptom so none can claim the whole score', () => {
        const result = computeOptimizationOpportunity(
            conflicts({ totalConflicts: 3, criticalConflicts: 1 }),
            health({ behind: 1, criticallyBehind: 1 }),
            [task({ taskKey: 'A', isDelayed: true }), task({ taskKey: 'B', isDelayed: true })],
        );

        // 3 conflicts would score 36 but the cap is 35; + 16 behind + 20 overdue + 15 critical.
        expect(result.score).toBe(86);
        expect(result.recommendation).toBe('Strongly recommended — significant improvements possible');
        expect(result.factors).toEqual([
            { label: 'Resource conflicts', value: 3, impact: 'high' },
            { label: 'Tasks behind schedule', value: 2, impact: 'high' },
            { label: 'Overdue tasks', value: 2, impact: 'high' },
            { label: 'Critical path conflicts', value: 1, impact: 'high' },
        ]);
    });

    test('symptoms that are absent contribute no factor at all', () => {
        const result = computeOptimizationOpportunity(
            conflicts({ totalConflicts: 1 }),
            health({}),
            [task({ taskKey: 'A' })],
        );

        expect(result.factors).toEqual([{ label: 'Resource conflicts', value: 1, impact: 'medium' }]);
        expect(result.score).toBe(12);
        expect(result.recommendation).toBe('Schedule looks good — optimization not needed');
    });

    test('nothing active means nothing to optimize', () => {
        const result = computeOptimizationOpportunity(
            conflicts({ totalConflicts: 9 }),
            health({ totalActive: 0 }),
            [],
        );

        expect(result).toEqual({ score: 0, factors: [], recommendation: 'No active tasks to optimize' });
    });
});
