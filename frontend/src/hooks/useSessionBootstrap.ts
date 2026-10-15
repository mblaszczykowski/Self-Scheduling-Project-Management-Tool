import { useCallback, useEffect, useState } from 'react';
import { checkUserAuth } from '../util/api';
import { CurrentUser, ErrorLike } from '../types';

interface SessionBootstrap {
    user: CurrentUser | null;
    loading: boolean;
    error: string | null;
}

export function useSessionBootstrap() {
    const [attempt, setAttempt] = useState(0);
    const [session, setSession] = useState<SessionBootstrap>({ user: null, loading: true, error: null });
    const retry = useCallback(() => setAttempt(previous => previous + 1), []);

    useEffect(() => {
        let active = true;
        setSession({ user: null, loading: true, error: null });
        checkUserAuth().then(user => {
            if (active) setSession({ user, loading: false, error: null });
        }).catch((error: unknown) => {
            if (!active) return;
            const status = (error as ErrorLike | null)?.response?.status;
            if (status === 401) {
                setSession({ user: null, loading: false, error: null });
                return;
            }
            const message = status && status >= 500
                ? 'The service is temporarily unavailable. Please try again.'
                : 'Unable to verify your session. Check your connection and try again.';
            setSession({ user: null, loading: false, error: message });
        });
        return () => { active = false; };
    }, [attempt]);

    return { ...session, retry };
}
