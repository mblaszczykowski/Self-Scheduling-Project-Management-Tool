import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import config from '../config';
import { getNotifications, getUnreadNotificationCount, markNotificationsAsRead } from '../util/api';
import { PROJECTS_QUERY_KEY } from './ProjectsContext';
import { useAuth } from './AuthContext';
import { Notification, NotificationType } from '../types';

interface NotificationsContextValue {
    notifications: Notification[];
    unreadCount: number;
    refreshNotifications: () => Promise<void>;
    markAsRead: (ids: number[]) => Promise<void>;
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

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    // Bumped to force the stream effect to re-run and open a fresh EventSource.
    const [reconnectNonce, setReconnectNonce] = useState(0);
    const retryCountRef = useRef(0);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const clearTimers = useCallback(() => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    }, []);

    const later = useCallback((fn: () => void, delay: number) => {
        timersRef.current.push(setTimeout(fn, delay));
    }, []);

    const refreshNotifications = useCallback(async () => {
        try {
            const [page, unread] = await Promise.all([
                getNotifications(0, 50),
                getUnreadNotificationCount(),
            ]);
            setNotifications(page.content);
            setUnreadCount(unread.count);
        } catch (err) {
            console.error('Could not load notifications', err);
        }
    }, []);

    const markAsRead = useCallback(async (ids: number[]) => {
        if (ids.length === 0) return;
        await markNotificationsAsRead(ids);
        const idSet = new Set(ids);
        setNotifications((previous) => previous.map((notification) =>
            idSet.has(notification.id) ? { ...notification, isRead: true } : notification));
        setUnreadCount((previous) => Math.max(0, previous - ids.length));
    }, []);

    useEffect(() => {
        if (!user) {
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
            setNotifications((previous) => [incoming, ...previous]);
            setUnreadCount((previous) => previous + 1);

            // A notification about a task or project means the cached board is out of date. Without
            // this the bell updated in real time while the timeline behind it kept showing
            // pre-change data until the user happened to mutate something themselves.
            if (BOARD_CHANGING_TYPES.has(incoming.type)) {
                later(() => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }),
                    CACHE_INVALIDATE_DEBOUNCE_MS);
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
    }, [user?.id, reconnectNonce, refreshNotifications, clearTimers, later, queryClient]);

    const value = useMemo(() => ({
        notifications, unreadCount, refreshNotifications, markAsRead,
    }), [notifications, unreadCount, refreshNotifications, markAsRead]);

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};
