import React, { useContext, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DashboardPage from './pages/DashboardPage';
import { DataContext, DataProvider } from './context/DataContext';
import { checkUserAuth } from './util/api';
import PageTransition from './components/common/PageTransition';
import ErrorBoundary from './components/common/ErrorBoundary';
import ProjectsPage from './pages/ProjectsPage';

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
            <ToastContainer
                position="top-center"
                autoClose={2500}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                pauseOnFocusLoss={false}
                draggable={false}
                pauseOnHover
                theme="light"
            />
            <Routes>
                <Route
                    path="/"
                    element={
                        <PublicRoute>
                            <PageTransition>
                                <AuthPage show="register" />
                            </PageTransition>
                        </PublicRoute>
                    }
                />
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <PageTransition>
                                <AuthPage show="login" />
                            </PageTransition>
                        </PublicRoute>
                    }
                />
                <Route
                    path="/register"
                    element={
                        <PublicRoute>
                            <PageTransition>
                                <AuthPage show="register" />
                            </PageTransition>
                        </PublicRoute>
                    }
                />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <PageTransition>
                                <DashboardPage />
                            </PageTransition>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/projects"
                    element={
                        <ProtectedRoute>
                            <PageTransition>
                                <ProjectsPage />
                            </PageTransition>
                        </ProtectedRoute>
                    }
                />
                <Route path="/timeline" element={<Navigate to="/projects" replace />} />
                <Route path="/list" element={<Navigate to="/projects" replace />} />
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
        <ErrorBoundary>
            <DataProvider initialUser={initialUser}>
                <AppRoutes />
            </DataProvider>
        </ErrorBoundary>
    );
}

export default App;
