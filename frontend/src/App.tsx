import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import AuthPage from './pages/AuthPage';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectsProvider } from './context/ProjectsContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { ThemeProvider } from './context/ThemeContext';
import { checkUserAuth } from './util/api';
import PageTransition from './components/common/PageTransition';
import ErrorBoundary from './components/common/ErrorBoundary';
import EmptyState from './components/common/EmptyState';
import { CurrentUser } from './types';

const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ProjectsPage = React.lazy(() => import('./pages/ProjectsPage'));

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
    },
});

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

const NotFoundPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [target, label] = user ? ['/dashboard', 'Back to dashboard'] : ['/login', 'Go to sign in'];

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="text-center">
                <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 dark:text-slate-500">404</p>
                <EmptyState
                    icon={HiOutlineExclamationCircle}
                    title="Page not found"
                    description="This address does not match any page in FlowLink. It may have moved, or the link may be mistyped."
                    action={() => navigate(target, { replace: true })}
                    actionLabel={label}
                />
            </div>
        </div>
    );
};

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
    const { user } = useAuth();
    const location = useLocation();
    if (!user) {
        const next = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/login?next=${next}`} replace />;
    }
    return children;
};

const PublicRoute = ({ children, redirectTo = '/dashboard' }: {
    children: React.ReactElement;
    redirectTo?: string;
}) => {
    const { user } = useAuth();
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
                {/* An unknown address used to be redirected to "/", which silently hid the user's
                    mistake and, once signed in, dumped them on the dashboard as if nothing was wrong. */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </div>
    );
}

function App() {
    const [initialUser, setInitialUser] = useState<CurrentUser | null>(null);
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
        <QueryClientProvider client={queryClient}>
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
        </QueryClientProvider>
    );
}

export default App;
