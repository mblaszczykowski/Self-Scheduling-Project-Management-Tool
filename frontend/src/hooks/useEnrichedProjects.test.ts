import { renderHook } from '@testing-library/react';
import { useEnrichedProjects } from './useEnrichedProjects';
import { Project, Task, User } from '../types';

const daysFromNow = (offset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

let nextId = 1;

const user = (overrides: Partial<User> & Pick<User, 'email'>): User => ({
    id: nextId++,
    firstname: 'First',
    lastname: 'Last',
    ...overrides,
});

const task = (overrides: Partial<Task> & Pick<Task, 'taskKey'>): Task => ({
    id: nextId++,
    taskNumber: nextId,
    projectKey: 'P',
    summary: `Summary of ${overrides.taskKey}`,
    status: 'TODO',
    labels: [],
    dependencyKeys: [],
    attachments: [],
    progress: 0,
    priority: 'MEDIUM',
    ...overrides,
});

const project = (overrides: Partial<Project> & Pick<Project, 'projectKey'>): Project => ({
    id: nextId++,
    summary: `Summary of ${overrides.projectKey}`,
    tasks: [],
    members: [],
    attachments: [],
    dependencies: [],
    ...overrides,
});

describe('useEnrichedProjects', () => {
    describe('isDelayed', () => {
        test('an overdue incomplete task is delayed', () => {
            const p = project({
                projectKey: 'P',
                tasks: [task({ taskKey: 'P-1', dueDate: daysFromNow(-5), status: 'TODO', progress: 10 })],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            expect(result.current.allTasks[0].isDelayed).toBe(true);
        });

        test('a DONE task at 40% progress past its due date is not delayed', () => {
            const p = project({
                projectKey: 'P',
                tasks: [task({
                    taskKey: 'P-1', dueDate: daysFromNow(-5), status: 'DONE', progress: 40,
                })],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            expect(result.current.allTasks[0].isDelayed).toBe(false);
        });
    });

    describe('isUpcomingDeadline', () => {
        test('a not-yet-complete task due within the window is upcoming', () => {
            const p = project({
                projectKey: 'P',
                tasks: [task({ taskKey: 'P-1', dueDate: daysFromNow(2), status: 'TODO', progress: 10 })],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            expect(result.current.allTasks[0].isUpcomingDeadline).toBe(true);
        });

        test('excludes a delayed task even though its own raw check would otherwise not overlap', () => {
            const p = project({
                projectKey: 'P',
                tasks: [task({ taskKey: 'P-1', dueDate: daysFromNow(-1), status: 'TODO', progress: 10 })],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            expect(result.current.allTasks[0].isDelayed).toBe(true);
            expect(result.current.allTasks[0].isUpcomingDeadline).toBe(false);
        });

        test('excludes a complete task even when its due date falls inside the window', () => {
            const p = project({
                projectKey: 'P',
                tasks: [task({
                    taskKey: 'P-1', dueDate: daysFromNow(2), status: 'DONE', progress: 100,
                })],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            expect(result.current.allTasks[0].isUpcomingDeadline).toBe(false);
        });

        test('a task far outside the window is neither delayed nor upcoming', () => {
            const p = project({
                projectKey: 'P',
                tasks: [task({ taskKey: 'P-1', dueDate: daysFromNow(30), status: 'TODO', progress: 10 })],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            expect(result.current.allTasks[0].isDelayed).toBe(false);
            expect(result.current.allTasks[0].isUpcomingDeadline).toBe(false);
        });
    });

    describe('assigneeName', () => {
        test('resolves from a project member rather than being guessed from the email', () => {
            const member = user({ email: 'bmember@example.com', firstname: 'Roberto', lastname: 'Fernandez' });
            const p = project({
                projectKey: 'P',
                members: [member],
                tasks: [task({ taskKey: 'P-1', assignee: 'bmember@example.com' })],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            expect(result.current.allTasks[0].assigneeName).toBe('Roberto Fernandez');
        });

        test('resolves from the project owner too, not only the member list', () => {
            const owner = user({ email: 'powner@example.com', firstname: 'Priya', lastname: 'Owner' });
            const p = project({
                projectKey: 'P',
                owner,
                tasks: [task({ taskKey: 'P-1', assignee: 'powner@example.com' })],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            expect(result.current.allTasks[0].assigneeName).toBe('Priya Owner');
        });

        test('falls back to the formatted address when the assignee is not a project member', () => {
            const member = user({ email: 'bmember@example.com', firstname: 'Roberto', lastname: 'Fernandez' });
            const p = project({
                projectKey: 'P',
                members: [member],
                tasks: [task({ taskKey: 'P-1', assignee: 'ghost.user@example.com' })],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            expect(result.current.allTasks[0].assigneeName).toBe('Ghost User');
        });

        test('is empty for an unassigned task', () => {
            const p = project({
                projectKey: 'P',
                tasks: [task({ taskKey: 'P-1', assignee: null })],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            expect(result.current.allTasks[0].assigneeName).toBe('');
        });
    });

    describe('isDelayedByDependency', () => {
        test('is true when a dependency is itself delayed', () => {
            const p = project({
                projectKey: 'P',
                tasks: [
                    task({ taskKey: 'P-1', dueDate: daysFromNow(-5), status: 'TODO', progress: 0 }),
                    task({
                        taskKey: 'P-2', dueDate: daysFromNow(10), status: 'TODO', progress: 0,
                        dependencyKeys: ['P-1'],
                    }),
                ],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            const byKey = result.current.taskKeyToTaskMap;
            expect(byKey.get('P-1')?.isDelayed).toBe(true);
            expect(byKey.get('P-2')?.isDelayed).toBe(false);
            expect(byKey.get('P-2')?.isDelayedByDependency).toBe(true);
        });

        test('is false when every dependency is on time', () => {
            const p = project({
                projectKey: 'P',
                tasks: [
                    task({ taskKey: 'P-1', dueDate: daysFromNow(10), status: 'TODO', progress: 0 }),
                    task({
                        taskKey: 'P-2', dueDate: daysFromNow(20), status: 'TODO', progress: 0,
                        dependencyKeys: ['P-1'],
                    }),
                ],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            const byKey = result.current.taskKeyToTaskMap;
            expect(byKey.get('P-1')?.isDelayed).toBe(false);
            expect(byKey.get('P-2')?.isDelayedByDependency).toBe(false);
        });
    });

    describe('per-project task sort', () => {
        test('sorts by start date with missing dates last, ties broken by task key', () => {
            const p = project({
                projectKey: 'P',
                tasks: [
                    task({ taskKey: 'Z', startDate: null }),
                    task({ taskKey: 'C', startDate: '2024-03-01' }),
                    task({ taskKey: 'B', startDate: '2024-01-01' }),
                    task({ taskKey: 'A', startDate: '2024-01-01' }),
                    task({ taskKey: 'D', startDate: null }),
                ],
            });
            const { result } = renderHook(() => useEnrichedProjects([p]));
            const order = result.current.processedProjects[0].tasks.map((t) => t.taskKey);
            expect(order).toEqual(['A', 'B', 'C', 'D', 'Z']);
        });
    });

    describe('allTasks', () => {
        test('is sorted by id across every project, regardless of insertion order', () => {
            const p1 = project({
                projectKey: 'P1',
                tasks: [
                    task({ taskKey: 'P1-1', id: 30 }),
                    task({ taskKey: 'P1-2', id: 10 }),
                ],
            });
            const p2 = project({
                projectKey: 'P2',
                tasks: [
                    task({ taskKey: 'P2-1', id: 20 }),
                ],
            });
            const { result } = renderHook(() => useEnrichedProjects([p2, p1]));
            expect(result.current.allTasks.map((t) => t.id)).toEqual([10, 20, 30]);
        });
    });
});
