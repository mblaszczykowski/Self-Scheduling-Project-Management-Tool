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

/** Notification types that mean the board itself changed, so the project cache is now stale. */
const BOARD_CHANGING_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
    'TASK_ASSIGNED', 'TASK_UPDATED', 'TASK_DELETED', 'PROJECT_UPDATED', 'MEMBER_REMOVED',
]);

const FIRST_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const MAX_RETRIES = 6;
const CACHE_INVALIDATE_DEBOUNCE_MS = 400;
/** Matches the page size `refreshNotifications` fetches, so the live list never exceeds it. */
const NOTIFICATIONS_LIMIT = 50;

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    // Bumped to force the stream effect to re-run and open a fresh EventSource.
    const [reconnectNonce, setReconnectNonce] = useState(0);
    const retryCountRef = useRef(0);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Guards refreshNotifications against a slow response landing after a newer one, or after logout.
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

    // A single dedicated timer, unlike `later`: repeated board-changing notifications must coalesce
    // into one invalidation rather than each scheduling an independent call.
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
            // Only ids still unread in the latest list count toward the decrement, so an id reaching
            // here twice (e.g. a click racing "mark all read") cannot double-decrement the badge.
            const newlyRead = previous.filter((n) => idSet.has(n.id) && !n.isRead).length;
            if (newlyRead > 0) setUnreadCount((prevCount) => Math.max(0, prevCount - newlyRead));
            return previous.map((notification) =>
                idSet.has(notification.id) ? { ...notification, isRead: true } : notification);
        });
    }, []);

    // Clears every unread notification server-side, not just the one page held locally, and sets
    // the badge from the authoritative count the endpoint returns.
    const markAllAsRead = useCallback(async () => {
        const result = await markAllNotificationsRead();
        setNotifications((previous) => previous.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(result.unreadCount);
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
            // Capped at the same size the initial fetch uses, so a long-lived tab receiving many
            // pushes doesn't grow the in-memory list — and every re-render — without bound.
            setNotifications((previous) => [incoming, ...previous].slice(0, NOTIFICATIONS_LIMIT));
            setUnreadCount((previous) => previous + 1);

            // A notification about a task or project means the cached board is out of date. Without
            // this the bell updated in real time while the timeline behind it kept showing
            // pre-change data until the user happened to mutate something themselves.
            if (BOARD_CHANGING_TYPES.has(incoming.type)) {
                debounceInvalidateProjects();
            }
        });

        stream.onerror = () => {
            if (stream.readyState === EventSource.CONNECTING) {
                // The browser is retrying by itself; just re-sync the list once it is back.
                later(refreshNotifications, 2_000);
                return;
            }

            // readyState CLOSED means the browser has given up — which is what happens on any
            // non-200 response, including the 401 that arrives as soon as the access token
            // expires. EventSource cannot participate in the axios refresh interceptor, so
            // without reopening here the stream died roughly fifteen minutes into every session
            // and stayed dead until a full page reload.
            stream.close();
            if (retryCountRef.current >= MAX_RETRIES) {
                console.warn('Notification stream gave up after %d attempts', MAX_RETRIES);
                return;
            }
            const attempt = retryCountRef.current++;
            const delay = Math.min(FIRST_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
            later(() => {
                // Goes through axios, so a 401 here refreshes the access cookie before the new
                // stream is opened.
                refreshNotifications().finally(() => setReconnectNonce((nonce) => nonce + 1));
            }, delay);
        };

        return () => {
            stream.close();
            clearTimers();
        };
        // Keyed on the user identity rather than the object reference, so a profile update does not
        // reconnect the stream; reconnectNonce is the deliberate re-open trigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, reconnectNonce, refreshNotifications, clearTimers, later, debounceInvalidateProjects]);

    // A stream that silently died while the tab was backgrounded or offline (a laptop asleep
    // through a backend restart, say) gives no `error` event to react to once the tab is active
    // again. Coming back online or back into view is a deliberate, low-cost point to force a fresh
    // connection rather than waiting for the exponential backoff to notice.
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
