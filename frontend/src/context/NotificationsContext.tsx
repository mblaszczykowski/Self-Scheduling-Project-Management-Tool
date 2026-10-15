import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import config from '../config';
import {
    getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationsAsRead,
} from '../util/api';
import { PROJECTS_QUERY_KEY } from './ProjectsContext';
import { useAuth } from './AuthContext';
import { Notification, NotificationType } from '../types';

interface NotificationsContextValue {
    notifications: Notification[];
    unreadCount: number;
    refreshNotifications: () => Promise<void>;
    markAsRead: (ids: number[]) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const useNotifications = (): NotificationsContextValue => {
    const context = useContext(NotificationsContext);
    if (!context) throw new Error('useNotifications must be used within a NotificationsProvider');
    return context;
};

const BOARD_CHANGING_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
    'TASK_ASSIGNED', 'TASK_UPDATED', 'TASK_DELETED', 'PROJECT_UPDATED', 'MEMBER_REMOVED',
    'PROJECT_INVITATION',
]);

const FIRST_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const MAX_RETRIES = 6;
const CACHE_INVALIDATE_DEBOUNCE_MS = 400;
const NOTIFICATIONS_LIMIT = 50;

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [{ notifications, unreadCount }, setSnapshot] = useState<{ notifications: Notification[]; unreadCount: number }>({ notifications: [], unreadCount: 0 });
    const eventSequenceRef = useRef(0);
    const recentEventsRef = useRef<Array<{ sequence: number; notification: Notification }>>([]);
    const previousUserIdRef = useRef(user?.id);
    const [reconnectNonce, setReconnectNonce] = useState(0);
    const retryCountRef = useRef(0);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestIdRef = useRef(0);

    const clearTimers = useCallback(() => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
        if (invalidateTimerRef.current) {
            clearTimeout(invalidateTimerRef.current);
            invalidateTimerRef.current = null;
        }
    }, []);

    const later = useCallback((fn: () => void, delay: number) => {
        const id = setTimeout(() => {
            timersRef.current = timersRef.current.filter((pending) => pending !== id);
            fn();
        }, delay);
        timersRef.current.push(id);
    }, []);

    const debounceInvalidateProjects = useCallback(() => {
        if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
        invalidateTimerRef.current = setTimeout(() => {
            invalidateTimerRef.current = null;
            queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
        }, CACHE_INVALIDATE_DEBOUNCE_MS);
    }, [queryClient]);

    const refreshNotifications = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        const startedAt = eventSequenceRef.current;
        try {
            const [page, unread] = await Promise.all([
                getNotifications(0, NOTIFICATIONS_LIMIT),
                getUnreadNotificationCount(),
            ]);
            if (requestId !== requestIdRef.current) return;
            const pushedDuringRequest = recentEventsRef.current
                .filter(event => event.sequence > startedAt).map(event => event.notification);
            const fetchedIds = new Set(page.content.map(notification => notification.id));
            const missingPushes = pushedDuringRequest.filter(notification => !fetchedIds.has(notification.id));
            const byId = new Map([...missingPushes, ...page.content].map(notification => [notification.id, notification]));
            setSnapshot({
                notifications: [...byId.values()].slice(0, NOTIFICATIONS_LIMIT),
                unreadCount: unread.count + missingPushes.filter(notification => !notification.isRead).length,
            });
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error('Could not load notifications', err);
        }
    }, []);

    const markAsRead = useCallback(async (ids: number[]) => {
        if (ids.length === 0) return;
        const userId = previousUserIdRef.current;
        const idSet = new Set(ids);
        await markNotificationsAsRead(ids);
        if (previousUserIdRef.current !== userId) return;
        requestIdRef.current++;
        setSnapshot(previous => ({
            notifications: previous.notifications.map(notification => idSet.has(notification.id)
                ? { ...notification, isRead: true } : notification),
            unreadCount: Math.max(0, previous.unreadCount - previous.notifications
                .filter(notification => idSet.has(notification.id) && !notification.isRead).length),
        }));
    }, []);

    const markAllAsRead = useCallback(async () => {
        const userId = previousUserIdRef.current;
        const result = await markAllNotificationsRead();
        if (previousUserIdRef.current !== userId) return;
        requestIdRef.current++;
        setSnapshot(previous => ({
            notifications: previous.notifications.map(notification => ({ ...notification, isRead: true })),
            unreadCount: result.count,
        }));
    }, []);

    useEffect(() => {
        if (!user) {
            requestIdRef.current++;
            setSnapshot({ notifications: [], unreadCount: 0 });
            recentEventsRef.current = [];
            previousUserIdRef.current = undefined;
            clearTimers();
            return;
        }

        if (previousUserIdRef.current !== user.id) {
            setSnapshot({ notifications: [], unreadCount: 0 });
            recentEventsRef.current = [];
            retryCountRef.current = 0;
            previousUserIdRef.current = user.id;
        }
        refreshNotifications();
        let closed = false;

        const stream = new EventSource(`${config.API_BASE_URL}/api/notifications/stream`,
            { withCredentials: true });

        stream.addEventListener('open', () => {
            if (closed) return;
            retryCountRef.current = 0;
        });

        stream.addEventListener('notification', (event) => {
            if (closed) return;
            let incoming: Notification;
            try {
                incoming = JSON.parse((event as MessageEvent).data) as Notification;
            } catch (err) {
                console.error('Could not parse a notification event', err);
                return;
            }
            if (!incoming || typeof incoming !== 'object' || !Number.isSafeInteger(incoming.id)
                || typeof incoming.isRead !== 'boolean') return;
            if (recentEventsRef.current.some(event => event.notification.id === incoming.id)) return;
            recentEventsRef.current = [
                ...recentEventsRef.current,
                { sequence: ++eventSequenceRef.current, notification: incoming },
            ].slice(-100);
            setSnapshot(previous => {
                if (previous.notifications.some(notification => notification.id === incoming.id)) return previous;
                return {
                    notifications: [incoming, ...previous.notifications].slice(0, NOTIFICATIONS_LIMIT),
                    unreadCount: previous.unreadCount + (incoming.isRead ? 0 : 1),
                };
            });

            if (BOARD_CHANGING_TYPES.has(incoming.type)) {
                debounceInvalidateProjects();
            }
        });

        stream.onerror = () => {
            if (closed) return;
            stream.close();
            if (retryCountRef.current >= MAX_RETRIES) {
                console.warn('Notification stream gave up after %d attempts', MAX_RETRIES);
                return;
            }
            const attempt = retryCountRef.current++;
            const delay = Math.min(FIRST_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
            later(() => {
                setReconnectNonce((nonce) => nonce + 1);
            }, delay);
        };

        return () => {
            closed = true;
            // Request generations intentionally invalidate pending async work.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            requestIdRef.current++;
            stream.close();
            clearTimers();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, reconnectNonce, refreshNotifications, clearTimers, later, debounceInvalidateProjects]);

    const userId = user?.id;
    useEffect(() => {
        if (!userId) return;
        const reconnect = () => {
            retryCountRef.current = 0;
            setReconnectNonce((nonce) => nonce + 1);
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') reconnect();
        };
        window.addEventListener('online', reconnect);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('online', reconnect);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [userId]);

    const value = useMemo(() => ({
        notifications, unreadCount, refreshNotifications, markAsRead, markAllAsRead,
    }), [notifications, unreadCount, refreshNotifications, markAsRead, markAllAsRead]);

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};
