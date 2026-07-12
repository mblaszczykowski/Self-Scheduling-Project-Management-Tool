import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import config from '../config';
import { getNotifications } from '../util/api';
import { AuthContext } from './AuthContext';
import { Notification } from '../types';

interface NotificationsContextValue {
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    refreshNotifications: () => Promise<void>;
}

export const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const useNotifications = () => {
    const context = useContext(NotificationsContext);
    if (!context) throw new Error('useNotifications must be used within a NotificationsProvider');
    return context;
};

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
    const user = useContext(AuthContext)?.user ?? null;
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const eventSourceRef = useRef<EventSource | null>(null);
    const errorRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const refreshNotifications = useCallback(async () => {
        try {
            const data = await getNotifications();
            setNotifications(data);
        } catch (err) {
            console.error('Error refreshing notifications:', err);
        }
    }, []);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (errorRefreshTimerRef.current) {
                clearTimeout(errorRefreshTimerRef.current);
                errorRefreshTimerRef.current = null;
            }
            return;
        }

        // Fetch existing notifications on login
        refreshNotifications();

        // Open SSE connection for real-time updates
        const url = `${config.API_BASE_URL}/api/notifications/stream`;
        const es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;

        es.addEventListener('notification', (event: MessageEvent) => {
            try {
                const notification = JSON.parse(event.data);
                setNotifications(prev => [notification, ...prev]);
            } catch (err) {
                console.error('Error parsing SSE notification:', err);
            }
        });

        es.onerror = () => {
            // Debounce refresh on reconnect to avoid thundering herd
            if (es.readyState === EventSource.CONNECTING) {
                if (errorRefreshTimerRef.current) clearTimeout(errorRefreshTimerRef.current);
                errorRefreshTimerRef.current = setTimeout(() => {
                    errorRefreshTimerRef.current = null;
                    refreshNotifications();
                }, 2000);
            }
        };

        return () => {
            es.close();
            eventSourceRef.current = null;
            if (errorRefreshTimerRef.current) {
                clearTimeout(errorRefreshTimerRef.current);
                errorRefreshTimerRef.current = null;
            }
        };
        // Keyed on the user identity, not the object reference, so a profile
        // update (new `user` object, same id) doesn't reconnect the stream.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, refreshNotifications]);

    const value = useMemo(() => ({
        notifications,
        setNotifications,
        refreshNotifications,
    }), [notifications, refreshNotifications]);

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
};
