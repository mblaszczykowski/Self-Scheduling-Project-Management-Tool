import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getNotifications } from '../util/api';
import { AuthContext } from './AuthContext';

const NOTIFICATION_POLL_MS = 30000;

export const NotificationsContext = createContext();

export const NotificationsProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [notifications, setNotifications] = useState([]);

    const refreshNotifications = useCallback(async () => {
        try {
            const data = await getNotifications();
            setNotifications(data);
        } catch (err) {
            console.error('Error refreshing notifications:', err);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }
        refreshNotifications();
    }, [user, refreshNotifications]);

    // Polling
    useEffect(() => {
        if (!user) return;

        let pollIntervalId = null;
        let backoffTimeoutId = null;
        let consecutiveFailures = 0;

        const pollWithErrorHandling = async () => {
            try {
                await refreshNotifications();
                consecutiveFailures = 0;
            } catch {
                consecutiveFailures++;
                if (consecutiveFailures >= 5) {
                    stopPolling();
                    const backoffMs = Math.min(NOTIFICATION_POLL_MS * Math.pow(2, consecutiveFailures - 5), 300000);
                    backoffTimeoutId = setTimeout(() => {
                        backoffTimeoutId = null;
                        startPolling();
                    }, backoffMs);
                }
            }
        };

        const startPolling = () => {
            if (pollIntervalId) return;
            pollIntervalId = setInterval(pollWithErrorHandling, NOTIFICATION_POLL_MS);
        };

        const stopPolling = () => {
            if (pollIntervalId) {
                clearInterval(pollIntervalId);
                pollIntervalId = null;
            }
            if (backoffTimeoutId) {
                clearTimeout(backoffTimeoutId);
                backoffTimeoutId = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                consecutiveFailures = 0;
                refreshNotifications();
                startPolling();
            } else {
                stopPolling();
            }
        };

        if (document.visibilityState === 'visible') {
            startPolling();
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, refreshNotifications]);

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
