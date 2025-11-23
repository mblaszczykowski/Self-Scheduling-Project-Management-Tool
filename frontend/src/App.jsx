    import {Navigate, Route, Routes, useLocation} from 'react-router-dom';
    import React, {useContext} from 'react';
    import Timeline from './components/Timeline';
    import WelcomeContent from './components/WelcomeContent';
    import ListView from './components/ListView';
    import {ToastContainer} from 'react-toastify';
    import 'react-toastify/dist/ReactToastify.css';
    import Dashboard from "./components/Dashboard";
    import {DataContext, DataProvider} from "./context/DataContext";

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
                                <Route path="/dashboard" element={<Dashboard />} />
                                <Route path="/timeline" element={<Timeline />} />
                                <Route path="/list" element={<ListView />} />
                            </Routes>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    function App() {
        return (
            <DataProvider>
                <AppRoutes />
            </DataProvider>
        );
    }

    export default App;
