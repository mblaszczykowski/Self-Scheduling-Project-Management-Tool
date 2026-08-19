import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsProvider, useNotifications } from './NotificationsContext';
import { PROJECTS_QUERY_KEY } from './ProjectsContext';
import { AuthProvider } from './AuthContext';
import {
    getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationsAsRead,
} from '../util/api';
import { CurrentUser, Notification } from '../types';

jest.mock('../util/api');

const mockedGetNotifications = getNotifications as jest.MockedFunction<typeof getNotifications>;
const mockedGetUnreadCount = getUnreadNotificationCount as jest.MockedFunction<typeof getUnreadNotificationCount>;
const mockedMarkAllRead = markAllNotificationsRead as jest.MockedFunction<typeof markAllNotificationsRead>;
const mockedMarkAsRead = markNotificationsAsRead as jest.MockedFunction<typeof markNotificationsAsRead>;

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

let nextNotificationId = 1;
const notification = (overrides: Partial<Notification> & Pick<Notification, 'type'>): Notification => ({
    id: nextNotificationId++,
    message: 'Something happened',
    timestamp: '2024-01-01T00:00:00Z',
    isRead: false,
    ...overrides,
});

class FakeEventSource {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;
    static instances: FakeEventSource[] = [];

    readyState = FakeEventSource.OPEN;
    onerror: ((event: Event) => void) | null = null;
    private readonly listeners: Record<string, Array<(event: MessageEvent) => void>> = {};

    constructor(public url: string) {
        FakeEventSource.instances.push(this);
    }

    addEventListener(type: string, listener: (event: MessageEvent) => void): void {
        (this.listeners[type] ??= []).push(listener);
    }

    removeEventListener(): void {}

    close(): void {
        this.readyState = FakeEventSource.CLOSED;
    }

    emit(type: string, data: unknown): void {
        const event = { data: JSON.stringify(data) } as MessageEvent;
        this.listeners[type]?.forEach((listener) => listener(event));
    }
}

const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <AuthProvider initialUser={currentUser}>
                <NotificationsProvider>{children}</NotificationsProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
    return { queryClient, wrapper };
};

describe('NotificationsContext', () => {
    beforeAll(() => {
        (global as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
    });

    beforeEach(() => {
        FakeEventSource.instances = [];
        mockedGetNotifications.mockResolvedValue({
            content: [], page: 0, size: 50, totalElements: 0, totalPages: 0, hasNext: false,
        });
        mockedGetUnreadCount.mockResolvedValue({ count: 0 });
        mockedMarkAsRead.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('markAllAsRead reads count from the response, and a later push never produces NaN', async () => {
        mockedMarkAllRead.mockResolvedValue({ count: 3 });
        const { wrapper } = createWrapper();
        const { result } = renderHook(() => useNotifications(), { wrapper });

        await waitFor(() => expect(result.current.unreadCount).toBe(0));

        await act(async () => {
            await result.current.markAllAsRead();
        });
        expect(result.current.unreadCount).toBe(3);

        const stream = FakeEventSource.instances[FakeEventSource.instances.length - 1];
        act(() => {
            stream.emit('notification', notification({ type: 'TASK_COMMENT' }));
        });

        expect(result.current.unreadCount).toBe(4);
        expect(Number.isNaN(result.current.unreadCount)).toBe(false);
    });

    test('a PROJECT_INVITATION push invalidates the projects query', async () => {
        const { queryClient, wrapper } = createWrapper();
        const { result } = renderHook(() => useNotifications(), { wrapper });
        await waitFor(() => expect(result.current.unreadCount).toBe(0));

        const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
        const stream = FakeEventSource.instances[FakeEventSource.instances.length - 1];

        jest.useFakeTimers();
        act(() => {
            stream.emit('notification', notification({ type: 'PROJECT_INVITATION' }));
        });
        act(() => {
            jest.advanceTimersByTime(500);
        });

        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: PROJECTS_QUERY_KEY });
    });

    test('a TASK_COMMENT push does not invalidate the projects query', async () => {
        const { queryClient, wrapper } = createWrapper();
        const { result } = renderHook(() => useNotifications(), { wrapper });
        await waitFor(() => expect(result.current.unreadCount).toBe(0));

        const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
        const stream = FakeEventSource.instances[FakeEventSource.instances.length - 1];

        jest.useFakeTimers();
        act(() => {
            stream.emit('notification', notification({ type: 'TASK_COMMENT' }));
        });
        act(() => {
            jest.advanceTimersByTime(500);
        });

        expect(invalidateSpy).not.toHaveBeenCalled();
    });
});
