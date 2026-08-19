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
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
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
        try {
            const [page, unread] = await Promise.all([
                getNotifications(0, NOTIFICATIONS_LIMIT),
                getUnreadNotificationCount(),
            ]);
            if (requestId !== requestIdRef.current) return;
            setNotifications(page.content);
            setUnreadCount(unread.count);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error('Could not load notifications', err);
        }
    }, []);

    const markAsRead = useCallback(async (ids: number[]) => {
        if (ids.length === 0) return;
        const idSet = new Set(ids);
        await markNotificationsAsRead(ids);
        setNotifications((previous) => {
            const newlyRead = previous.filter((n) => idSet.has(n.id) && !n.isRead).length;
            if (newlyRead > 0) setUnreadCount((prevCount) => Math.max(0, prevCount - newlyRead));
            return previous.map((notification) =>
                idSet.has(notification.id) ? { ...notification, isRead: true } : notification);
        });
    }, []);

    const markAllAsRead = useCallback(async () => {
        const result = await markAllNotificationsRead();
        setNotifications((previous) => previous.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(result.count);
    }, []);

    useEffect(() => {
        if (!user) {
            requestIdRef.current++;
            setNotifications([]);
            setUnreadCount(0);
            clearTimers();
            return;
        }

        refreshNotifications();

        const stream = new EventSource(`${config.API_BASE_URL}/api/notifications/stream`,
            { withCredentials: true });

        stream.addEventListener('open', () => {
            retryCountRef.current = 0;
        });

        stream.addEventListener('notification', (event) => {
            let incoming: Notification;
            try {
                incoming = JSON.parse((event as MessageEvent).data) as Notification;
            } catch (err) {
                console.error('Could not parse a notification event', err);
                return;
            }
            setNotifications((previous) => [incoming, ...previous].slice(0, NOTIFICATIONS_LIMIT));
            setUnreadCount((previous) => previous + 1);

            if (BOARD_CHANGING_TYPES.has(incoming.type)) {
                debounceInvalidateProjects();
            }
        });

        stream.onerror = () => {
            if (stream.readyState === EventSource.CONNECTING) {
                later(refreshNotifications, 2_000);
                return;
            }

            stream.close();
            if (retryCountRef.current >= MAX_RETRIES) {
                console.warn('Notification stream gave up after %d attempts', MAX_RETRIES);
                return;
            }
            const attempt = retryCountRef.current++;
            const delay = Math.min(FIRST_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
            later(() => {
                refreshNotifications().finally(() => setReconnectNonce((nonce) => nonce + 1));
            }, delay);
        };

        return () => {
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
