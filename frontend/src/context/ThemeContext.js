import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const getInitialTheme = () => {
    const stored = localStorage.getItem('flowlink_theme');
    if (stored) return stored;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
};

export const ThemeProvider = ({ children }) => {
    const [theme, setThemeState] = useState(getInitialTheme);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.add('theme-transitioning');
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('flowlink_theme', theme);
        const timer = setTimeout(() => root.classList.remove('theme-transitioning'), 200);
        return () => clearTimeout(timer);
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
    }, []);

    const setTheme = useCallback((t) => setThemeState(t), []);

    const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme, toggleTheme, setTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};