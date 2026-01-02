import React, { useContext, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import UnifiedView from './components/UnifiedView';
import WelcomeContent from './components/WelcomeContent';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Dashboard from './components/Dashboard';
import { DataContext, DataProvider } from './context/DataContext';
import { checkUserAuth } from './util/api';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-slate-500">Loading</p>
        </div>
    </div>
);

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useContext(DataContext);

    if (loading) return <LoadingSpinner />;
    if (!user) return <Navigate to="/login" replace />;

    return children;
};

const PublicRoute = ({ children, redirectTo = '/dashboard' }) => {
    const { user, loading } = useContext(DataContext);

    if (loading) return <LoadingSpinner />;
    if (user) return <Navigate to={redirectTo} replace />;

    return children;
};

function AppRoutes() {
    const { loading } = useContext(DataContext);

    if (loading) return <LoadingSpinner />;

    return (
        <div className="App min-h-screen">
            <ToastContainer />
            <Routes>
                <Route
                    path="/"
                    element={
                        <PublicRoute>
                            <WelcomeContent show="register" />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <WelcomeContent show="login" />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/register"
                    element={
                        <PublicRoute>
                            <WelcomeContent show="register" />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/projects"
                    element={
                        <ProtectedRoute>
                            <UnifiedView />
                        </ProtectedRoute>
                    }
                />
                {/* Legacy routes - redirect to unified view */}
                <Route path="/timeline" element={<Navigate to="/projects" replace />} />
                <Route path="/list" element={<Navigate to="/projects" replace />} />
                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </div>
    );
}

function App() {
    const [initialUser, setInitialUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const authCheckInitiated = useRef(false);

    useEffect(() => {
        if (authCheckInitiated.current) return;
        authCheckInitiated.current = true;

        const checkAuth = async () => {
            try {
                const userData = await checkUserAuth();
                setInitialUser(userData);
            } catch {
                setInitialUser(null);
            } finally {
                setAuthChecked(true);
            }
        };

        checkAuth();
    }, []);

    if (!authChecked) return <LoadingSpinner />;

    return (
        <DataProvider initialUser={initialUser}>
            <AppRoutes />
        </DataProvider>
    );
}

export default App;