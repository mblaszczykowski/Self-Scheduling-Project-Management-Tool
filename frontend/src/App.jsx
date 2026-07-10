import React, { Suspense, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { ProjectsProvider } from './context/ProjectsContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { ThemeProvider } from './context/ThemeContext';
import { checkUserAuth } from './util/api';
import PageTransition from './components/common/PageTransition';
import ErrorBoundary from './components/common/ErrorBoundary';

const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ProjectsPage = React.lazy(() => import('./pages/ProjectsPage'));

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
            <div className="w-10 h-10 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center mx-auto mb-4">
                <div className="w-5 h-5 bg-white dark:bg-slate-900 rounded" />
            </div>
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 dark:border-slate-700 border-t-slate-900 dark:border-t-white mx-auto" />
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading</p>
        </div>
    </div>
);

const ProtectedRoute = ({ children }) => {
    const { user } = useContext(AuthContext);

    if (!user) return <Navigate to="/login" replace />;

    return children;
};

const PublicRoute = ({ children, redirectTo = '/dashboard' }) => {
    const { user } = useContext(AuthContext);

    if (user) return <Navigate to={redirectTo} replace />;

    return children;
};

function AppRoutes() {
    return (
        <div className="App min-h-screen bg-slate-50 dark:bg-slate-900">
            <ToastContainer
                position="top-right"
                autoClose={2500}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                pauseOnFocusLoss={false}
                draggable={false}
                pauseOnHover
                theme="light"
                style={{ marginTop: '3.5rem' }}
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
                                <Suspense fallback={<LoadingSpinner />}>
                                    <DashboardPage />
                                </Suspense>
                            </PageTransition>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/projects"
                    element={
                        <ProtectedRoute>
                            <PageTransition>
                                <Suspense fallback={<LoadingSpinner />}>
                                    <ProjectsPage />
                                </Suspense>
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
        <ThemeProvider>
            <ErrorBoundary>
                <AuthProvider initialUser={initialUser}>
                    <ProjectsProvider>
                        <NotificationsProvider>
                            <AppRoutes />
                        </NotificationsProvider>
                    </ProjectsProvider>
                </AuthProvider>
            </ErrorBoundary>
        </ThemeProvider>
    );
}

export default App;
