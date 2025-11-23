import React, {useContext, useEffect, useRef, useState} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {DataContext} from '../context/DataContext';
import AccountModal from "./AccountModal";
import SearchBar from "./SearchBar";
import axios from 'axios';

export default function Header({ onLogout, onCreateProject, onCreateTask }) {
    const { user, projects, userTasks, notifications, setNotifications } = useContext(DataContext);
    const [unreadCount, setUnreadCount] = useState(0);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [projectsDropdownOpen, setProjectsDropdownOpen] = useState(false);
    const [yourWorkDropdownOpen, setYourWorkDropdownOpen] = useState(false);
    const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    const projectsRef = useRef(null);
    const yourWorkRef = useRef(null);
    const createRef = useRef(null);
    const notificationsRef = useRef(null);

    useEffect(() => {
        const unread = notifications.filter(n => !n.isRead).length;
        setUnreadCount(unread);
    }, [notifications]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (projectsRef.current && !projectsRef.current.contains(e.target)) setProjectsDropdownOpen(false);
            if (yourWorkRef.current && !yourWorkRef.current.contains(e.target)) setYourWorkDropdownOpen(false);
            if (createRef.current && !createRef.current.contains(e.target)) setCreateDropdownOpen(false);
            if (notificationsRef.current && !notificationsRef.current.contains(e.target)) setDropdownOpen(false); // Added line
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    const handleNotificationClick = () => {
        if (dropdownOpen) {
            // When closing the dropdown, mark notifications as read.
            const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
            if (unreadIds.length > 0) {
                axios.post('/api/notifications/mark-as-read', unreadIds)
                    .then(() => {
                        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                        setUnreadCount(0);
                    })
                    .catch(err => console.error('Error marking notifications as read:', err));
            }
            setDropdownOpen(false);
        } else {
            // Opening the dropdown leaves notifications unread
            setDropdownOpen(true);
        }
    };

    return (
        <header className="w-full mb-5 z-50 border-b pb-2">
            <nav className="mx-auto px-2 md:px-6 flex items-center justify-between">
                <div className="flex items-center">
                    <Link to="/dashboard" className="mr-4">
                    <span className="self-center text-xl font-semibold whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-l from-blue-700 to-blue-500">
                      Flowlink
                    </span>
                    </Link>

                    {/* Desktop menu */}
                    <div className="hidden xl:flex items-center space-x-1">
                        <Link
                            to="/dashboard"
                            className={
                                location.pathname === "/dashboard"
                                    ? "py-2 px-4 bg-gray-100 text-gray-800 text-base font-medium rounded-lg transition"
                                    : "py-2 px-4 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 transition"
                            }
                        >
                            Dashboard
                        </Link>
                        <Link
                            to="/timeline"
                            className={
                                location.pathname === "/timeline"
                                    ? "py-2 px-4 bg-gray-100 text-gray-800 text-base font-medium rounded-lg transition"
                                    : "py-2 px-4 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 transition"
                            }
                        >
                            Timeline
                        </Link>
                        <Link
                            to="/list"
                            className={
                                location.pathname === "/list"
                                    ? "py-2 px-4 bg-gray-100 text-gray-800 text-base font-medium rounded-lg transition"
                                    : "py-2 px-4 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 transition"
                            }
                        >
                            List
                        </Link>
                        <div ref={projectsRef} className="relative">
                            <button
                                onClick={() => setProjectsDropdownOpen(!projectsDropdownOpen)}
                                className={
                                    projectsDropdownOpen
                                        ? "py-2 px-4 bg-gray-100 text-gray-800 text-base font-medium rounded-lg transition flex items-center"
                                        : "py-2 px-4 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 transition flex items-center"
                                }
                            >
                                Projects
                                <svg className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 011.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                                </svg>
                            </button>
                            {projectsDropdownOpen && (
                                <div className="absolute mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                                    <ul className="py-1">
                                        {projects.length > 0 ? (
                                            projects.map(project => (
                                                <li key={project.id}>
                                                    <Link
                                                        to={`/timeline?projectKey=${project.projectKey}`}
                                                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                                                        onClick={() => setProjectsDropdownOpen(false)}
                                                    >
                                                        {project.summary} ({project.projectKey})
                                                    </Link>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="px-4 py-2 text-gray-500">No projects</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div ref={yourWorkRef} className="relative">
                            <button
                                onClick={() => setYourWorkDropdownOpen(!yourWorkDropdownOpen)}
                                className={
                                    yourWorkDropdownOpen
                                        ? "py-2 px-4 bg-gray-100 text-gray-800 text-base font-medium rounded-lg transition flex items-center"
                                        : "py-2 px-4 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 transition flex items-center"
                                }
                            >
                                Your Work
                                <svg className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 011.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                                </svg>
                            </button>
                            {yourWorkDropdownOpen && (
                                <div className="absolute mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                                    <ul className="py-1 max-h-64 overflow-y-auto">
                                        <li className="px-4 py-2 font-semibold">Tasks assigned to you:</li>
                                        {userTasks.length > 0 ? (
                                            userTasks.map(task => {
                                                const [projectKey] = task.taskKey.split("-");
                                                return (
                                                    <li key={task.id}>
                                                        <Link
                                                            to={`/timeline?selectedIssue=${projectKey}-${task.id}`}
                                                            className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                                                            onClick={() => setYourWorkDropdownOpen(false)}
                                                        >
                                                            {projectKey}-{task.id}: {task.summary}
                                                        </Link>
                                                    </li>
                                                );
                                            })
                                        ) : (
                                            <li className="px-4 py-2 text-gray-500">No tasks assigned</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div ref={createRef} className="relative">
                            <button
                                onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
                                className="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-xl border border-transparent bg-blue-700 text-white hover:bg-blue-500 transition"
                            >
                                Create
                                <svg className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 011.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                                </svg>
                            </button>
                            {createDropdownOpen && (
                                <div className="absolute mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                                    <ul className="py-1">
                                        <li>
                                            <button
                                                onClick={() => {
                                                    setCreateDropdownOpen(false);
                                                    onCreateProject();
                                                }}
                                                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                                            >
                                                Create Project
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                onClick={() => {
                                                    setCreateDropdownOpen(false);
                                                    onCreateTask();
                                                }}
                                                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                                            >
                                                Create Task
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Hamburger for mobile */}
                <div className="flex xl:hidden items-center">
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 hover:bg-gray-100 rounded-md focus:outline-none"
                    >
                        <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                        </svg>
                    </button>
                </div>

                <div className="hidden md:block mx-4">
                    <SearchBar />
                </div>

                <div className="flex items-center gap-x-4 py-1">
                    <div ref={notificationsRef} className="relative">
                        <button
                            type="button"
                            className="relative p-2 bg-gray-100 rounded-full hover:bg-gray-200 focus:outline-none"
                            onClick={handleNotificationClick}
                        >
                            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {unreadCount > 0 && (
                                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                  {unreadCount}
                </span>
                            )}
                        </button>
                        {dropdownOpen && (
                            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                                <div className="py-2 max-h-96 overflow-y-auto">
                                    <div className="px-4 py-2 border-b">
                                        <span className="font-semibold">Unread Notifications</span>
                                    </div>
                                    {notifications.filter(n => !n.isRead).length > 0 ? (
                                        notifications.filter(n => !n.isRead).map(n => (
                                            <Link
                                                key={n.id}
                                                to={n.link || '#'}
                                                className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                                                onClick={() => setDropdownOpen(false)}
                                            >
                                                <div className="text-sm">{n.message}</div>
                                                <div className="text-xs text-gray-500">{new Date(n.timestamp).toLocaleString()}</div>
                                            </Link>
                                        ))
                                    ) : (
                                        <div className="px-4 py-2 text-gray-500">No unread notifications</div>
                                    )}
                                    <div className="px-4 py-2 border-b mt-2">
                                        <span className="font-semibold">Read Notifications</span>
                                    </div>
                                    {notifications.filter(n => n.isRead).length > 0 ? (
                                        notifications.filter(n => n.isRead).map(n => (
                                            <Link
                                                key={n.id}
                                                to={n.link || '#'}
                                                className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                                                onClick={() => setDropdownOpen(false)}
                                            >
                                                <div className="text-sm">{n.message}</div>
                                                <div className="text-xs text-gray-500">{new Date(n.timestamp).toLocaleString()}</div>
                                            </Link>
                                        ))
                                    ) : (
                                        <div className="px-4 py-2 text-gray-500">No read notifications</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className="relative p-2 bg-gray-100 rounded-full hover:bg-gray-200 focus:outline-none"
                        onClick={() => setAccountModalOpen(true)}
                    >
                        {user && user.profilePicture ? (
                            <img
                                src={`http://localhost:8080${user.profilePicture}`}
                                alt="Profile"
                                className="h-8 w-8 rounded-full object-cover"
                            />
                        ) : (
                            <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z" />
                            </svg>
                        )}
                    </button>
                    <button
                        type="button"
                        className="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-xl border border-gray-200 text-black hover:bg-gray-100 disabled:opacity-50 disabled:pointer-events-none"
                        onClick={onLogout}
                    >
                        Log out
                    </button>
                </div>
            </nav>

            {/* Mobile menu */}
            {mobileMenuOpen && (
                <div className="xl:hidden px-2">
                    <div className="py-2 flex flex-col space-y-1 border-t mt-2">
                        <Link
                            to="/dashboard"
                            className="py-2 px-2 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Dashboard
                        </Link>
                        <Link
                            to="/timeline"
                            className="py-2 px-2 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Timeline
                        </Link>
                        <Link
                            to="/list"
                            className="py-2 px-2 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            List
                        </Link>
                        <div ref={projectsRef}>
                            <button
                                onClick={() => setProjectsDropdownOpen(!projectsDropdownOpen)}
                                className="py-2 px-2 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 flex items-center w-full"
                            >
                                Projects
                                <svg className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 011.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                                </svg>
                            </button>
                            {projectsDropdownOpen && (
                                <div className="mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-50">
                                    <ul className="py-1">
                                        {projects.length > 0 ? (
                                            projects.map(project => (
                                                <li key={project.id}>
                                                    <Link
                                                        to={`/timeline?projectKey=${project.projectKey}`}
                                                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                                                        onClick={() => {
                                                            setProjectsDropdownOpen(false);
                                                            setMobileMenuOpen(false);
                                                        }}
                                                    >
                                                        {project.summary} ({project.projectKey})
                                                    </Link>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="px-4 py-2 text-gray-500">No projects</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div ref={yourWorkRef}>
                            <button
                                onClick={() => setYourWorkDropdownOpen(!yourWorkDropdownOpen)}
                                className="py-2 px-2 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 flex items-center w-full"
                            >
                                Your Work
                                <svg className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 011.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                                </svg>
                            </button>
                            {yourWorkDropdownOpen && (
                                <div className="mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-50">
                                    <ul className="py-1 max-h-64 overflow-y-auto">
                                        <li className="px-4 py-2 font-semibold">Tasks assigned to you:</li>
                                        {userTasks.length > 0 ? (
                                            userTasks.map(task => {
                                                const [projectKey] = task.taskKey.split("-");
                                                return (
                                                    <li key={task.id}>
                                                        <Link
                                                            to={`/timeline?selectedIssue=${projectKey}-${task.id}`}
                                                            className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                                                            onClick={() => {
                                                                setYourWorkDropdownOpen(false);
                                                                setMobileMenuOpen(false);
                                                            }}
                                                        >
                                                            {projectKey}-{task.id}: {task.summary}
                                                        </Link>
                                                    </li>
                                                );
                                            })
                                        ) : (
                                            <li className="px-4 py-2 text-gray-500">No tasks assigned</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div ref={createRef}>
                            <button
                                onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
                                className="py-2 px-2 text-gray-800 text-base font-medium rounded-lg hover:bg-gray-200 flex items-center w-full"
                            >
                                Create
                                <svg className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 011.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                                </svg>
                            </button>
                            {createDropdownOpen && (
                                <div className="mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-50">
                                    <ul className="py-1">
                                        <li>
                                            <button
                                                onClick={() => {
                                                    setCreateDropdownOpen(false);
                                                    setMobileMenuOpen(false);
                                                    onCreateProject();
                                                }}
                                                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                                            >
                                                Create Project
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                onClick={() => {
                                                    setCreateDropdownOpen(false);
                                                    setMobileMenuOpen(false);
                                                    onCreateTask();
                                                }}
                                                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                                            >
                                                Create Task
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="mt-2">
                            <SearchBar />
                        </div>
                    </div>
                </div>
            )}

            {accountModalOpen && (
                <AccountModal user={user} onClose={() => setAccountModalOpen(false)} />
            )}
        </header>
    );
}
