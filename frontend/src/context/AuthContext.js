import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { logout } from '../util/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children, initialUser }) => {
    const [user, setUser] = useState(initialUser);
    const [loading, setLoading] = useState(!initialUser && initialUser !== null);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(false);
    }, []);

    const clearError = useCallback(() => setError(null), []);

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
        loading,
        error,
        clearError,
        handleLogout,
    }), [user, loading, error, clearError, handleLogout]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
