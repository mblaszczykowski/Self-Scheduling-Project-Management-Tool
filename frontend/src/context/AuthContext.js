import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { logout } from '../util/api';

export const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider = ({ children, initialUser }) => {
    const [user, setUser] = useState(initialUser);

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
