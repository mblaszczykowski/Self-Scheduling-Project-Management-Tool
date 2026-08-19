import {
    computeBlockedTasks,
    computeCriticalPathHealth,
    computeCriticalPathTimeline,
    computeCrossProjectDependencies,
    computeProjectCompletion,
    computeTaskCounts,
    computeUpcomingCriticalDeadlines,
} from './statsCompute';
import { EnrichedTask, ProcessedProject } from '../types';

// Bare 'YYYY-MM-DD' parses as UTC midnight, which keeps the day arithmetic exact in any timezone.
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

const project = (overrides: Partial<ProcessedProject> & Pick<ProcessedProject, 'projectKey'>): ProcessedProject => ({
    id: nextId++,
    summary: `Summary of ${overrides.projectKey}`,
    tasks: [],
    members: [],
    attachments: [],
    dependencies: [],
    projectProgress: 0,
    ...overrides,
});

const byKey = (tasks: EnrichedTask[]) => new Map(tasks.map(t => [t.taskKey, t]));

describe('computeTaskCounts', () => {
    test('counts critical and delayed work off the flags the enrichment derived', () => {
        const tasks = [
            task({ taskKey: 'A', isCritical: true, isDelayed: true }),
            task({ taskKey: 'B', isCritical: true }),
            task({ taskKey: 'C', isDelayed: true }),
            task({ taskKey: 'D' }),
        ];

        expect(computeTaskCounts(tasks)).toEqual({ criticalTasks: 2, delayedTasks: 2 });
    });
});

describe('computeCriticalPathHealth', () => {
    const tasks = [
        task({ taskKey: 'K1', isCritical: true, isDelayed: true }),
        task({
            taskKey: 'K2', isCritical: true, isUpcomingDeadline: true, progress: 10,
            startDate: '2024-06-01', dueDate: '2024-06-11',
        }),
        task({ taskKey: 'K3', isCritical: true, isUpcomingDeadline: true, progress: 100 }),
        task({ taskKey: 'K4', isDelayed: true }),
    ];

    const result = computeCriticalPathHealth(tasks, TODAY);

    test('scores the share of critical work that is not yet late', () => {
        expect(result.criticalTasksList).toHaveLength(3);
        expect(result.criticalOnTime).toBe(2);
        expect(result.criticalHealthScore).toBe(67);
    });

    test('at risk means due soon and already behind its own dates', () => {
        // K2 is 100% elapsed at 10% done; K3 is due soon too, but finished.
        expect(result.criticalAtRisk.map(t => t.taskKey)).toEqual(['K2']);
        expect(result.criticalDelayed.map(t => t.taskKey)).toEqual(['K1']);
    });

    test('no critical tasks scores 100 rather than dividing by zero', () => {
        expect(computeCriticalPathHealth([], TODAY).criticalHealthScore).toBe(100);
    });
});

describe('computeCriticalPathTimeline', () => {
    const projects = [
        project({
            projectKey: 'P1',
            tasks: [
                task({ taskKey: 'C1', isCritical: true, isDelayed: true, startDate: '2024-06-01', dueDate: '2024-06-11' }),
                task({ taskKey: 'C2', isCritical: true, startDate: '2024-06-05', dueDate: '2024-06-21' }),
                task({ taskKey: 'N1', startDate: '2024-01-01', dueDate: '2024-12-31' }),
            ],
        }),
        project({
            projectKey: 'P2',
            tasks: [task({ taskKey: 'C3', isCritical: true, startDate: '2024-06-01', dueDate: '2024-06-06' })],
        }),
        project({ projectKey: 'P3', tasks: [task({ taskKey: 'N2' })] }),
    ];

    const result = computeCriticalPathTimeline(projects);

    // Inclusive of both endpoints, like calculateDuration: P1 runs 06-01 through 06-21 (21 days),
    // P2 runs 06-01 through 06-06 (6). The exclusive form reported a same-day path as 0 days.
    test('spans the critical tasks only, longest path first', () => {
        expect(result.map(p => [p.projectKey, p.criticalPathDays])).toEqual([['P1', 21], ['P2', 6]]);
    });

    test('a project with no critical tasks is left out', () => {
        expect(result.map(p => p.projectKey)).not.toContain('P3');
    });

    test('a late critical task marks the whole path delayed', () => {
        expect(result[0]).toMatchObject({ status: 'delayed', delayedCritical: 1, criticalTaskCount: 2 });
        expect(result[1]).toMatchObject({ status: 'ontrack', delayedCritical: 0 });
    });
});

describe('computeUpcomingCriticalDeadlines', () => {
    test('keeps unfinished work due within the next week, soonest first', () => {
        const criticalTasks = [
            task({ taskKey: 'U2', dueDate: '2024-06-15' }),
            task({ taskKey: 'U1', dueDate: '2024-06-12' }),
            task({ taskKey: 'TOO_FAR', dueDate: '2024-06-25' }),
            task({ taskKey: 'ALREADY_PAST', dueDate: '2024-06-10' }),
            task({ taskKey: 'FINISHED', dueDate: '2024-06-13', progress: 100 }),
            task({ taskKey: 'UNDATED' }),
        ];

        const result = computeUpcomingCriticalDeadlines(criticalTasks, TODAY);

        expect(result.map(t => t.taskKey)).toEqual(['U1', 'U2']);
    });

    test('a withdrawn task is finished even below 100%, so it is not an upcoming deadline', () => {
        const criticalTasks = [
            task({ taskKey: 'OPEN', dueDate: '2024-06-12', progress: 40 }),
            task({ taskKey: 'CANCELLED', dueDate: '2024-06-12', status: 'WITHDRAWN', progress: 40 }),
        ];

        expect(computeUpcomingCriticalDeadlines(criticalTasks, TODAY).map(t => t.taskKey))
            .toEqual(['OPEN']);
    });
});

describe('computeBlockedTasks', () => {
    test('a task is blocked while any dependency is unfinished', () => {
        const tasks = [
            task({ taskKey: 'C', progress: 50 }),
            task({ taskKey: 'D', isCritical: true, dependencies: ['C'] }),
            task({ taskKey: 'E', dependencies: ['F'] }),
            task({ taskKey: 'F', progress: 100 }),
            task({ taskKey: 'G', progress: 100, dependencies: ['C'] }),
        ];

        const result = computeBlockedTasks(tasks, byKey(tasks));

        // E's only dependency is done, and G is done itself.
        expect(result.blockedTasks.map(t => t.taskKey)).toEqual(['D']);
        expect(result.blockedCriticalTasks.map(t => t.taskKey)).toEqual(['D']);
    });

    test('a dependency on a task outside the loaded set does not block', () => {
        const tasks = [task({ taskKey: 'H', dependencies: ['MISSING-1'] })];

        expect(computeBlockedTasks(tasks, byKey(tasks)).blockedTasks).toEqual([]);
    });

    test('a withdrawn dependency no longer blocks, and a withdrawn task is not itself blocked', () => {
        const tasks = [
            task({ taskKey: 'CANCELLED_DEP', status: 'WITHDRAWN', progress: 0 }),
            task({ taskKey: 'WAITING', dependencies: ['CANCELLED_DEP'] }),
            task({ taskKey: 'OPEN_DEP', progress: 10 }),
            task({ taskKey: 'CANCELLED_SELF', status: 'WITHDRAWN', progress: 0, dependencies: ['OPEN_DEP'] }),
        ];

        // Cancelled work is finished work: it cannot hold anything up, and it cannot itself wait.
        expect(computeBlockedTasks(tasks, byKey(tasks)).blockedTasks.map(t => t.taskKey)).toEqual([]);
    });
});

describe('computeCrossProjectDependencies', () => {
    test('resolves each dependency key to the project summary when it is loaded', () => {
        const projects = [
            project({ projectKey: 'P1', summary: 'Alpha', dependencies: ['P2', 'UNKNOWN'] }),
            project({ projectKey: 'P2', summary: 'Beta' }),
        ];

        expect(computeCrossProjectDependencies(projects)).toEqual([{
            projectKey: 'P1',
            summary: 'Alpha',
            dependencyCount: 2,
            dependsOn: [{ key: 'P2', summary: 'Beta' }, { key: 'UNKNOWN', summary: undefined }],
        }]);
    });
});

describe('computeProjectCompletion', () => {
    test('reports the progress the enrichment already averaged per project', () => {
        const projects = [
            project({ projectKey: 'P', summary: 'P', projectProgress: 50 }),
            project({ projectKey: 'Q', summary: 'Q' }),
        ];

        expect(computeProjectCompletion(projects)).toEqual([
            { projectKey: 'P', summary: 'P', completionPercentage: 50 },
            { projectKey: 'Q', summary: 'Q', completionPercentage: 0 },
        ]);
    });
});
