import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { logout } from '../util/api';
import { User } from '../types';

interface AuthContextValue {
    user: User | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
    handleLogout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider = ({ children, initialUser }: { children: React.ReactNode; initialUser: User | null }) => {
    const [user, setUser] = useState<User | null>(initialUser);

    const handleLogout = useCallback(async () => {
        try {
            await logout();
        } catch (err) {
            console.error('Logout failed', err);
        } finally {
            setUser(null);
        }
    }, []);

    const value = useMemo(() => ({
        user,
        setUser,
        handleLogout,
    }), [user, handleLogout]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
