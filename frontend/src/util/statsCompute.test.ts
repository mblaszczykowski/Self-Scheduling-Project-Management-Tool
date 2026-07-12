import {
    computeTaskCounts,
    computeCriticalPathHealth,
    computeNearCriticalTasks,
    computeBlockedTasks,
    computeProjectCompletion,
} from './statsCompute';
import { Task, Project } from '../types';

const TODAY = new Date('2024-06-01T00:00:00');

describe('computeTaskCounts', () => {
    const A: Task = { taskKey: 'A', status: 'DONE', assignee: 'x@y.com', priority: 'HIGH', isCritical: true, progress: 100, dueDate: '2024-05-01', dependencies: [] };
    const B: Task = { taskKey: 'B', status: 'TODO', assignee: null, priority: 'MEDIUM', isCritical: false, progress: 0, dueDate: '2024-05-01', dependencies: ['A'] };
    const result = computeTaskCounts([A, B], { A, B }, TODAY);

    test('counts per status / assignee', () => {
        expect(result.tasksPerStatus).toEqual({ DONE: 1, TODO: 1 });
        expect(result.tasksPerAssignee.Unassigned).toBe(1);
    });
    test('critical + delayed counts', () => {
        expect(result.criticalTasks).toBe(1);
        // B is overdue+incomplete; A is overdue but done (not counted).
        expect(result.delayedTasks).toBe(1);
    });
});

describe('computeBlockedTasks', () => {
    const C: Task = { taskKey: 'C', isCritical: false, progress: 50, dependencies: [] };
    const D: Task = { taskKey: 'D', isCritical: true, progress: 0, dependencies: ['C'] };
    const { blockedTasks, blockedCriticalTasks } = computeBlockedTasks([C, D], { C, D });

    test('a task waiting on an incomplete dependency is blocked', () => {
        expect(blockedTasks.map(t => t.taskKey)).toEqual(['D']);
        expect(blockedCriticalTasks.map(t => t.taskKey)).toEqual(['D']);
    });
});

describe('computeNearCriticalTasks', () => {
    const C: Task = { taskKey: 'C', isCritical: false, progress: 50, dependencies: [] };
    const D: Task = { taskKey: 'D', isCritical: true, progress: 0, dependencies: ['C'] };
    const near = computeNearCriticalTasks([C, D], TODAY);

    test('a non-critical task blocking a critical one is near-critical', () => {
        expect(near.map(t => t.taskKey)).toContain('C');
    });
    test('critical tasks themselves are excluded', () => {
        expect(near.map(t => t.taskKey)).not.toContain('D');
    });
});

describe('computeCriticalPathHealth', () => {
    test('all critical work on time => 100', () => {
        const A: Task = { taskKey: 'A', isCritical: true, progress: 100, dueDate: '2024-05-01', startDate: '2024-04-01' };
        expect(computeCriticalPathHealth([A], TODAY).criticalHealthScore).toBe(100);
    });
    test('no critical tasks => 100 (vacuously healthy)', () => {
        expect(computeCriticalPathHealth([], TODAY).criticalHealthScore).toBe(100);
    });
});

describe('computeProjectCompletion', () => {
    test('averages task progress per project', () => {
        const projects: Project[] = [
            { projectKey: 'P', summary: 'P', tasks: [{ taskKey: 'a', progress: 100 }, { taskKey: 'b', progress: 0 }] },
            { projectKey: 'Q', summary: 'Q', tasks: [] },
        ];
        const result = computeProjectCompletion(projects);
        expect(result).toEqual([
            { projectKey: 'P', summary: 'P', completionPercentage: 50 },
            { projectKey: 'Q', summary: 'Q', completionPercentage: 0 },
        ]);
    });
});
