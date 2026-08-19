import { renderHook } from '@testing-library/react';
import { useTaskFiltering } from './useTaskFiltering';
import { CurrentUser, EnrichedTask } from '../types';

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

const currentUser: CurrentUser = {
    id: 1,
    email: 'me@example.com',
    firstname: 'Me',
    lastname: 'User',
    emailNotificationsEnabled: true,
    emailOnTaskAssigned: true,
    emailOnCommentReply: true,
    emailOnProjectInvitation: true,
};

interface FilterOptions {
    tasks: EnrichedTask[];
    filters?: Record<string, string>;
    searchQuery?: string;
    assignedToMe?: boolean;
    currentUser?: CurrentUser | null;
    sortField?: string;
    sortOrder?: string;
    urlParams?: string;
}

const filter = ({
    tasks,
    filters = {},
    searchQuery = '',
    assignedToMe = false,
    currentUser: user = null,
    sortField = 'id',
    sortOrder = 'asc',
    urlParams = '',
}: FilterOptions) => renderHook(() => useTaskFiltering({
    tasks, filters, searchQuery, assignedToMe, currentUser: user, sortField, sortOrder, urlParams,
})).result.current;

describe('useTaskFiltering', () => {
    describe('URL-driven filters', () => {
        test('critical=true keeps only critical tasks', () => {
            const tasks = [
                task({ taskKey: 'A', isCritical: true }),
                task({ taskKey: 'B', isCritical: false }),
            ];
            const { filteredTasks } = filter({ tasks, urlParams: 'critical=true' });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['A']);
        });

        test('delayed=true keeps only delayed tasks', () => {
            const tasks = [
                task({ taskKey: 'A', isDelayed: true }),
                task({ taskKey: 'B', isDelayed: false }),
            ];
            const { filteredTasks } = filter({ tasks, urlParams: 'delayed=true' });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['A']);
        });

        test('upcomingDeadline=true keeps only upcoming-deadline tasks', () => {
            const tasks = [
                task({ taskKey: 'A', isUpcomingDeadline: true }),
                task({ taskKey: 'B', isUpcomingDeadline: false }),
            ];
            const { filteredTasks } = filter({ tasks, urlParams: 'upcomingDeadline=true' });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['A']);
        });

        test('delayedByDependency=true keeps only tasks blocked by a delayed dependency', () => {
            const tasks = [
                task({ taskKey: 'A', isDelayedByDependency: true }),
                task({ taskKey: 'B', isDelayedByDependency: false }),
            ];
            const { filteredTasks } = filter({ tasks, urlParams: 'delayedByDependency=true' });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['A']);
        });

        test('when both upcomingDeadline and delayed are set, upcomingDeadline takes priority', () => {
            const tasks = [
                task({ taskKey: 'A', isUpcomingDeadline: true, isDelayed: false }),
                task({ taskKey: 'B', isUpcomingDeadline: false, isDelayed: true }),
            ];
            const { filteredTasks } = filter({ tasks, urlParams: 'upcomingDeadline=true&delayed=true' });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['A']);
        });
    });

    describe('assignedToMe', () => {
        test('keeps only tasks assigned to the current user', () => {
            const tasks = [
                task({ taskKey: 'A', assignee: 'me@example.com' }),
                task({ taskKey: 'B', assignee: 'someone.else@example.com' }),
                task({ taskKey: 'C', assignee: null }),
            ];
            const { filteredTasks } = filter({ tasks, assignedToMe: true, currentUser });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['A']);
        });

        test('is a no-op without a current user', () => {
            const tasks = [task({ taskKey: 'A', assignee: 'me@example.com' })];
            const { filteredTasks } = filter({ tasks, assignedToMe: true, currentUser: null });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['A']);
        });
    });

    describe('free-text search', () => {
        test('matches the summary case-insensitively', () => {
            const tasks = [
                task({ taskKey: 'A', summary: 'Fix login bug' }),
                task({ taskKey: 'B', summary: 'Improve performance' }),
            ];
            const { filteredTasks } = filter({ tasks, searchQuery: 'LOGIN' });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['A']);
        });

        test('an empty or blank query matches everything', () => {
            const tasks = [task({ taskKey: 'A' }), task({ taskKey: 'B' })];
            const { filteredTasks } = filter({ tasks, searchQuery: '   ' });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['A', 'B']);
        });

        test('a query matching nothing empties the list', () => {
            const tasks = [task({ taskKey: 'A', summary: 'Fix login bug' })];
            const { filteredTasks } = filter({ tasks, searchQuery: 'zzz' });
            expect(filteredTasks).toEqual([]);
        });
    });

    describe('sorting', () => {
        test('ascending by dueDate: missing dates sort last, ties broken by task key', () => {
            const tasks = [
                task({ taskKey: 'Z', dueDate: '2024-06-20' }),
                task({ taskKey: 'B', dueDate: '2024-06-05' }),
                task({ taskKey: 'A', dueDate: '2024-06-05' }),
                task({ taskKey: 'N', dueDate: null }),
                task({ taskKey: 'M', dueDate: null }),
            ];
            const { filteredTasks } = filter({ tasks, sortField: 'dueDate', sortOrder: 'asc' });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['A', 'B', 'Z', 'M', 'N']);
        });

        test('descending by dueDate: a missing date still sorts last, not first', () => {
            const tasks = [
                task({ taskKey: 'A', dueDate: '2024-06-05' }),
                task({ taskKey: 'Z', dueDate: '2024-06-20' }),
                task({ taskKey: 'M', dueDate: null }),
            ];
            const { filteredTasks } = filter({ tasks, sortField: 'dueDate', sortOrder: 'desc' });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['Z', 'A', 'M']);
        });

        test('is stable and NaN-safe when every date is missing', () => {
            const tasks = [
                task({ taskKey: 'B', dueDate: null }),
                task({ taskKey: 'A', dueDate: undefined }),
            ];
            const { filteredTasks } = filter({ tasks, sortField: 'dueDate', sortOrder: 'asc' });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['A', 'B']);
        });
    });

    describe('composition', () => {
        test('URL filter, state filter, search and assignedToMe all narrow the set together (AND, not OR)', () => {
            const matchesEverything = task({
                taskKey: 'ALL', isCritical: true, priority: 'HIGH',
                summary: 'Fix login bug', assignee: 'me@example.com',
            });
            const tasks = [
                matchesEverything,
                task({
                    taskKey: 'NOT-CRITICAL', isCritical: false, priority: 'HIGH',
                    summary: 'Fix login bug', assignee: 'me@example.com',
                }),
                task({
                    taskKey: 'WRONG-PRIORITY', isCritical: true, priority: 'LOW',
                    summary: 'Fix login bug', assignee: 'me@example.com',
                }),
                task({
                    taskKey: 'NO-MATCH-TEXT', isCritical: true, priority: 'HIGH',
                    summary: 'Improve performance', assignee: 'me@example.com',
                }),
                task({
                    taskKey: 'NOT-MINE', isCritical: true, priority: 'HIGH',
                    summary: 'Fix login bug', assignee: 'someone.else@example.com',
                }),
            ];
            const { filteredTasks } = filter({
                tasks,
                urlParams: 'critical=true',
                filters: { priority: 'HIGH' },
                searchQuery: 'bug',
                assignedToMe: true,
                currentUser,
            });
            expect(filteredTasks.map((t) => t.taskKey)).toEqual(['ALL']);
        });
    });
});
