import {
    computeScheduleHealth,
    computeVelocityNeeded,
    getBlockingInfo,
    getProgressColor,
    relativeDue,
} from './taskListDisplay';
import { formatShortDate } from './helpers';
import { EnrichedTask } from '../types';

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

describe('relativeDue', () => {
    test('no due date renders a placeholder', () => {
        expect(relativeDue(null, 'TODO', 0, TODAY)).toEqual({ text: '—', cls: 'text-slate-400' });
    });

    test('a terminal status shows the plain date even when the due date is in the past', () => {
        const result = relativeDue('2024-06-01', 'DONE', 40, TODAY);
        expect(result.text).toBe(formatShortDate('2024-06-01'));
        expect(result.cls).toBe('text-slate-500 dark:text-slate-400');
    });

    test('100% progress with a non-terminal status also counts as finished', () => {
        const result = relativeDue('2024-06-01', 'IN_PROGRESS', 100, TODAY);
        expect(result.text).toBe(formatShortDate('2024-06-01'));
    });

    test('2 days overdue', () => {
        expect(relativeDue('2024-06-09', 'TODO', 10, TODAY))
            .toEqual({ text: '2d overdue', cls: 'text-red-600 dark:text-red-400 font-semibold' });
    });

    test('due yesterday', () => {
        expect(relativeDue('2024-06-10', 'TODO', 10, TODAY))
            .toEqual({ text: 'Yesterday', cls: 'text-red-600 dark:text-red-400 font-semibold' });
    });

    test('due today', () => {
        expect(relativeDue('2024-06-11', 'TODO', 10, TODAY))
            .toEqual({ text: 'Today', cls: 'text-amber-600 dark:text-amber-400 font-semibold' });
    });

    test('due tomorrow', () => {
        expect(relativeDue('2024-06-12', 'TODO', 10, TODAY))
            .toEqual({ text: 'Tomorrow', cls: 'text-amber-600 dark:text-amber-400' });
    });

    test('due within 3 days', () => {
        expect(relativeDue('2024-06-14', 'TODO', 10, TODAY))
            .toEqual({ text: 'in 3d', cls: 'text-amber-600 dark:text-amber-400' });
    });

    test('due within 7 days but past the 3-day amber window', () => {
        expect(relativeDue('2024-06-16', 'TODO', 10, TODAY))
            .toEqual({ text: 'in 5d', cls: 'text-slate-700 dark:text-slate-300' });
    });

    test('far enough out that the plain date is shown', () => {
        const result = relativeDue('2024-06-25', 'TODO', 10, TODAY);
        expect(result.text).toBe(formatShortDate('2024-06-25'));
        expect(result.cls).toBe('text-slate-500 dark:text-slate-400');
    });
});

describe('getProgressColor', () => {
    test('100% progress is green', () => {
        expect(getProgressColor(task({ taskKey: 'A', progress: 100 }))).toBe('bg-green-500');
    });

    test('a terminal status is green even below 100%, matching isTaskComplete', () => {
        expect(getProgressColor(task({ taskKey: 'A', status: 'DONE', progress: 40 }))).toBe('bg-green-500');
    });

    test('delayed and incomplete is red', () => {
        expect(getProgressColor(task({ taskKey: 'A', progress: 40, isDelayed: true }))).toBe('bg-red-400');
    });

    test('an upcoming deadline under 80% progress is amber', () => {
        expect(getProgressColor(task({ taskKey: 'A', progress: 50, isUpcomingDeadline: true }))).toBe('bg-amber-400');
    });

    test('50% or more with no other flag is blue', () => {
        expect(getProgressColor(task({ taskKey: 'A', progress: 60 }))).toBe('bg-blue-500');
    });

    test('under 50% with no other flag is the neutral grey', () => {
        expect(getProgressColor(task({ taskKey: 'A', progress: 10 }))).toBe('bg-slate-300 dark:bg-slate-600');
    });
});

describe('computeScheduleHealth', () => {
    test('missing either date is unmeasurable', () => {
        expect(computeScheduleHealth(task({ taskKey: 'A', startDate: '2024-06-01' }), TODAY)).toBeNull();
        expect(computeScheduleHealth(task({ taskKey: 'A' }), TODAY)).toBeNull();
    });

    test('a finished task has no health to report, whether finished by progress or by status', () => {
        expect(computeScheduleHealth(
            task({ taskKey: 'A', startDate: '2024-06-01', dueDate: '2024-06-20', progress: 100 }), TODAY,
        )).toBeNull();
        expect(computeScheduleHealth(
            task({ taskKey: 'A', startDate: '2024-06-01', dueDate: '2024-06-20', status: 'DONE', progress: 40 }), TODAY,
        )).toBeNull();
    });

    test('a task that has not started yet', () => {
        const result = computeScheduleHealth(
            task({ taskKey: 'A', startDate: '2024-06-15', dueDate: '2024-06-20', progress: 0 }), TODAY,
        );
        expect(result).toEqual({ status: 'not-started', label: 'Not started', expected: 0 });
    });

    test('exactly at the start date, on-track at 0% progress', () => {
        const result = computeScheduleHealth(
            task({ taskKey: 'A', startDate: '2024-06-11', dueDate: '2024-06-21', progress: 0 }), TODAY,
        );
        expect(result).toEqual({ status: 'on-track', label: 'On track', expected: 0 });
    });

    test('a same-day span floors the span to one day rather than dividing by zero', () => {
        const partWayThroughToday = new Date('2024-06-11T18:00:00.000Z');
        const result = computeScheduleHealth(
            task({ taskKey: 'A', startDate: '2024-06-11', dueDate: '2024-06-11', progress: 20 }), partWayThroughToday,
        );
        expect(result).toEqual({ status: 'critical', label: '55% behind', expected: 75 });
    });

    const boundaryTask = (progress: number) =>
        task({ taskKey: 'A', startDate: '2024-06-01', dueDate: '2024-06-11', progress });

    test('a gap of exactly 15 points is "slight", not "behind"', () => {
        expect(computeScheduleHealth(boundaryTask(85), TODAY))
            .toEqual({ status: 'slight', label: '15% behind', expected: 100 });
    });

    test('a gap of 16 points crosses into "behind"', () => {
        expect(computeScheduleHealth(boundaryTask(84), TODAY))
            .toEqual({ status: 'behind', label: '16% behind', expected: 100 });
    });

    test('a gap of exactly 30 points is still "behind", not "critical"', () => {
        expect(computeScheduleHealth(boundaryTask(70), TODAY))
            .toEqual({ status: 'behind', label: '30% behind', expected: 100 });
    });

    test('a gap of 31 points crosses into "critical"', () => {
        expect(computeScheduleHealth(boundaryTask(69), TODAY))
            .toEqual({ status: 'critical', label: '31% behind', expected: 100 });
    });

    test('progress ahead of or matching the expected pace is on-track', () => {
        const aheadTask = task({ taskKey: 'A', startDate: '2024-06-01', dueDate: '2024-06-21', progress: 60 });
        expect(computeScheduleHealth(aheadTask, TODAY)).toEqual({ status: 'on-track', label: 'On track', expected: 50 });

        const exactPaceTask = task({ taskKey: 'A', startDate: '2024-06-01', dueDate: '2024-06-21', progress: 50 });
        expect(computeScheduleHealth(exactPaceTask, TODAY)).toEqual({ status: 'on-track', label: 'On track', expected: 50 });
    });
});

describe('getBlockingInfo', () => {
    const taskWithDeps = (dependencies: string[]) => task({ taskKey: 'MAIN', dependencies });

    test('no dependencies means nothing to block on', () => {
        expect(getBlockingInfo(taskWithDeps([]), new Map(), TODAY)).toBeNull();
    });

    test('dependencies that are all finished, whether by progress or by status, unblock the task', () => {
        const map = new Map([
            ['DONE1', task({ taskKey: 'DONE1', progress: 100 })],
            ['DONE2', task({ taskKey: 'DONE2', status: 'DONE', progress: 50 })],
        ]);
        expect(getBlockingInfo(taskWithDeps(['DONE1', 'DONE2']), map, TODAY)).toBeNull();
    });

    test('sorts blockers by how overdue they are, then by least complete, then by key', () => {
        const b1 = task({ taskKey: 'B1', dueDate: '2024-06-09', progress: 40 });
        const b2 = task({ taskKey: 'B2', dueDate: '2024-06-10', progress: 20 });
        const b3 = task({ taskKey: 'B3', progress: 10 });
        const b4 = task({ taskKey: 'B4', dueDate: '2024-06-09', progress: 10 });
        const doneViaStatus = task({ taskKey: 'DONE-STATUS', status: 'DONE', progress: 50 });
        const doneViaProgress = task({ taskKey: 'DONE-PROGRESS', progress: 100 });

        const map = new Map([b1, b2, b3, b4, doneViaStatus, doneViaProgress].map((t) => [t.taskKey, t]));
        const main = taskWithDeps(['B1', 'B2', 'B3', 'B4', 'DONE-STATUS', 'DONE-PROGRESS']);

        const result = getBlockingInfo(main, map, TODAY);
        expect(result?.count).toBe(4);
        expect(result?.blockers.map((b) => b.taskKey)).toEqual(['B4', 'B1', 'B2', 'B3']);
        expect(result?.worst.taskKey).toBe('B4');
    });
});

describe('computeVelocityNeeded', () => {
    test('missing either date does not apply', () => {
        expect(computeVelocityNeeded(task({ taskKey: 'A', startDate: '2024-06-01' }), TODAY)).toBeNull();
    });

    test('a finished task does not need a velocity figure', () => {
        expect(computeVelocityNeeded(
            task({ taskKey: 'A', startDate: '2024-06-01', dueDate: '2024-06-20', progress: 100 }), TODAY,
        )).toBeNull();
        expect(computeVelocityNeeded(
            task({ taskKey: 'A', startDate: '2024-06-01', dueDate: '2024-06-20', status: 'DONE', progress: 40 }), TODAY,
        )).toBeNull();
    });

    test('a due date that has already passed leaves no days to make it up', () => {
        expect(computeVelocityNeeded(
            task({ taskKey: 'A', startDate: '2024-06-01', dueDate: '2024-06-09', progress: 50 }), TODAY,
        )).toBeNull();
    });

    test('a due date of today also leaves no days left', () => {
        expect(computeVelocityNeeded(
            task({ taskKey: 'A', startDate: '2024-06-01', dueDate: '2024-06-11', progress: 50 }), TODAY,
        )).toBeNull();
    });

    test('divides the remaining progress evenly over the remaining days', () => {
        expect(computeVelocityNeeded(
            task({ taskKey: 'A', startDate: '2024-06-01', dueDate: '2024-06-16', progress: 50 }), TODAY,
        )).toBe(10);
    });

    test('rounds to the nearest whole percent', () => {
        expect(computeVelocityNeeded(
            task({ taskKey: 'A', startDate: '2024-06-01', dueDate: '2024-06-14', progress: 50 }), TODAY,
        )).toBe(17);
    });
});
