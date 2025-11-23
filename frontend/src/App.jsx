import React, { useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Timeline from './components/Timeline';
import WelcomeContent from './components/WelcomeContent';
import ListView from './components/ListView';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Dashboard from "./components/Dashboard";
import { DataContext, DataProvider } from "./context/DataContext";
import { getUser } from './util/api';

function AppRoutes() {
    const location = useLocation();
    const { user, loading } = useContext(DataContext);

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    return (
        <div className="App">
            <div className="container-fluid">
                <ToastContainer />
                <div className="row">
                    <div className="col bg-gray-100">
                        <Routes location={location}>
                            <Route
                                path="/"
                                element={
                                    user ? (
                                        <Navigate to="/dashboard" replace />
                                    ) : (
                                        <WelcomeContent show="register" />
                                    )
                                }
                            />
                            <Route path="/login" element={<WelcomeContent show="login" />} />
                            <Route path="/register" element={<WelcomeContent show="register" />} />
                            <Route
                                path="/dashboard"
                                element={
                                    user ? <Dashboard /> : <Navigate to="/login" replace />
                                }
                            />
                            <Route
                                path="/timeline"
                                element={
                                    user ? <Timeline /> : <Navigate to="/login" replace />
                                }
                            />
                            <Route
                                path="/list"
                                element={
                                    user ? <ListView /> : <Navigate to="/login" replace />
                                }
                            />
                        </Routes>
                    </div>
                </div>
            </div>
        </div>
    );
}

function App() {
    const [initialUser, setInitialUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);

    useEffect(() => {
        // Check authentication status on app load
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            // Try to get current user using the httpOnly cookie
            const userData = await getUser();
            setInitialUser(userData);
        } catch (error) {
            // If error (likely 401), user is not authenticated
            console.log('User not authenticated');
            setInitialUser(null);
        } finally {
            setAuthChecked(true);
        }
    };

    // Show loading while checking authentication
    if (!authChecked) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="sr-only">Loading...</span>
                    </div>
                    <p className="mt-2">Checking authentication...</p>
                </div>
            </div>
        );
    }

    return (
        <DataProvider initialUser={initialUser}>
            <AppRoutes />
        </DataProvider>
    );
}

export default App;