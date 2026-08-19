import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { logout } from '../util/api';
import { CurrentUser } from '../types';

interface AuthContextValue {
    user: CurrentUser | null;
    setUser: React.Dispatch<React.SetStateAction<CurrentUser | null>>;
    handleLogout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider = ({ children, initialUser }: {
    children: React.ReactNode;
    initialUser: CurrentUser | null;
}) => {
    const [user, setUser] = useState<CurrentUser | null>(initialUser);

    const handleLogout = useCallback(async () => {
        try {
            await logout();
        } catch (err) {
            console.error('Logout request failed', err);
        } finally {
            setUser(null);
        }
    }, []);

    const value = useMemo(() => ({ user, setUser, handleLogout }), [user, handleLogout]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
