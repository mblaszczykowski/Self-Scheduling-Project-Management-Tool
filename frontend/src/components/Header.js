import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DataContext } from '../context/DataContext';
import AccountModal from './AccountModal';
import { markNotificationsAsRead } from '../util/api';
import { getImageUrl } from '../util/helpers';

export default function Header({ onLogout, onCreateProject, onCreateTask }) {
    const { user, notifications, setNotifications, setUser } = useContext(DataContext);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    const createRef = useRef(null);
    const notificationsRef = useRef(null);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (createRef.current && !createRef.current.contains(e.target)) setCreateDropdownOpen(false);
            if (notificationsRef.current && !notificationsRef.current.contains(e.target)) setDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNotificationClick = async () => {
        if (dropdownOpen) {
            const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
            if (unreadIds.length > 0) {
                try {
                    await markNotificationsAsRead(unreadIds);
                    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                } catch (err) {
                    console.error('Error marking notifications as read:', err);
                }
            }
            setDropdownOpen(false);
        } else {
            setDropdownOpen(true);
        }
    };

    const NavLink = ({ to, children }) => (
        <Link
            to={to}
            className={
                location.pathname === to
                    ? 'py-2 px-4 bg-slate-100 text-slate-900 text-sm font-medium rounded-lg transition-colors'
                    : 'py-2 px-4 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors'
            }
        >
            {children}
        </Link>
    );

    const getAvatarFallback = (name) => {
        if (!name) return 'U';
        return name.charAt(0).toUpperCase();
    };

    return (
        <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-50">
            <nav className="mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <Link to="/dashboard" className="flex items-center">
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                            <div className="w-4 h-4 bg-white rounded" />
                        </div>
                        <span className="ml-3 text-lg font-semibold text-slate-900">
                            Flowlink
                        </span>
                    </Link>

                    {/* Desktop menu */}
                    <div className="hidden xl:flex items-center gap-1">
                        <NavLink to="/dashboard">Dashboard</NavLink>
                        <NavLink to="/projects">Projects</NavLink>

                        {/* Create dropdown - moved here */}
                        <div ref={createRef} className="relative ml-2">
                            <button
                                onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                Create
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 011.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                                </svg>
                            </button>
                            {createDropdownOpen && (
                                <div className="absolute left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                                    <div className="py-1">
                                        <button
                                            onClick={() => { setCreateDropdownOpen(false); onCreateProject(); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                            <span>New Project</span>
                                        </button>
                                        <button
                                            onClick={() => { setCreateDropdownOpen(false); onCreateTask(); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                            <span>New Task</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile hamburger */}
                <div className="flex xl:hidden items-center">
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 hover:bg-slate-100 rounded-lg focus:outline-none transition-colors"
                    >
                        <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                        </svg>
                    </button>
                </div>

                {/* Right side actions */}
                <div className="hidden xl:flex items-center gap-3">
                    {/* Notifications */}
                    <div ref={notificationsRef} className="relative">
                        <button
                            type="button"
                            className="relative p-2 bg-white rounded-lg hover:bg-slate-50 focus:outline-none transition-colors border border-slate-200"
                            onClick={handleNotificationClick}
                        >
                            <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-5 w-5 text-xs font-semibold text-white bg-red-500 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                        {dropdownOpen && (
                            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                                <div className="max-h-96 overflow-y-auto">
                                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                                        <span className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Notifications</span>
                                    </div>

                                    {notifications.filter(n => !n.isRead).length > 0 && (
                                        <div className="border-b border-slate-100">
                                            <div className="px-4 py-2 bg-slate-50">
                                                <span className="text-xs font-medium text-slate-500">Unread</span>
                                            </div>
                                            {notifications.filter(n => !n.isRead).map(n => (
                                                <Link
                                                    key={n.id}
                                                    to={n.link || '#'}
                                                    className="block px-4 py-3 hover:bg-slate-50 transition-colors border-l-2 border-slate-900"
                                                    onClick={() => setDropdownOpen(false)}
                                                >
                                                    <div className="text-sm font-medium text-slate-900">{n.message}</div>
                                                    <div className="text-xs text-slate-500 mt-1">{new Date(n.timestamp).toLocaleString()}</div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}

                                    {notifications.filter(n => n.isRead).length > 0 && (
                                        <div>
                                            <div className="px-4 py-2 bg-slate-50">
                                                <span className="text-xs font-medium text-slate-500">Read</span>
                                            </div>
                                            {notifications.filter(n => n.isRead).map(n => (
                                                <Link
                                                    key={n.id}
                                                    to={n.link || '#'}
                                                    className="block px-4 py-3 hover:bg-slate-50 transition-colors"
                                                    onClick={() => setDropdownOpen(false)}
                                                >
                                                    <div className="text-sm text-slate-600">{n.message}</div>
                                                    <div className="text-xs text-slate-400 mt-1">{new Date(n.timestamp).toLocaleString()}</div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}

                                    {notifications.length === 0 && (
                                        <div className="px-4 py-8 text-center">
                                            <svg className="w-10 h-10 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                            </svg>
                                            <p className="text-sm text-slate-400">No notifications</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Profile */}
                    <button
                        type="button"
                        className="p-1.5 bg-white rounded-lg hover:bg-slate-50 focus:outline-none transition-colors border border-slate-200"
                        onClick={() => setAccountModalOpen(true)}
                    >
                        {user?.profilePicture ? (
                            <img
                                src={getImageUrl(user.profilePicture)}
                                alt="Profile"
                                className="h-7 w-7 rounded object-cover"
                            />
                        ) : (
                            <div className="h-7 w-7 rounded bg-slate-100 flex items-center justify-center">
                                <span className="text-xs font-semibold text-slate-700">
                                    {getAvatarFallback(user?.firstname)}
                                </span>
                            </div>
                        )}
                    </button>

                    {/* Logout with icon */}
                    <button
                        type="button"
                        className="p-2 inline-flex items-center text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        onClick={onLogout}
                        title="Log out"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </nav>

            {/* Mobile menu */}
            {mobileMenuOpen && (
                <div className="xl:hidden border-t border-slate-200 bg-white">
                    <div className="px-6 py-4 space-y-1">
                        <Link
                            to="/dashboard"
                            className={`block py-2.5 px-3 text-sm font-medium rounded-lg transition-colors ${
                                location.pathname === '/dashboard'
                                    ? 'bg-slate-100 text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Dashboard
                        </Link>
                        <Link
                            to="/projects"
                            className={`block py-2.5 px-3 text-sm font-medium rounded-lg transition-colors ${
                                location.pathname === '/projects'
                                    ? 'bg-slate-100 text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Projects
                        </Link>

                        <div className="pt-3 mt-3 border-t border-slate-100 space-y-1">
                            <button
                                onClick={() => { setMobileMenuOpen(false); onCreateProject(); }}
                                className="w-full flex items-center gap-3 py-2.5 px-3 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                Create Project
                            </button>
                            <button
                                onClick={() => { setMobileMenuOpen(false); onCreateTask(); }}
                                className="w-full flex items-center gap-3 py-2.5 px-3 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Create Task
                            </button>
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-100 space-y-1">
                            <button
                                onClick={() => { setMobileMenuOpen(false); setAccountModalOpen(true); }}
                                className="w-full flex items-center gap-3 py-2.5 px-3 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Account Settings
                            </button>
                            <button
                                onClick={() => { setMobileMenuOpen(false); onLogout(); }}
                                className="w-full flex items-center gap-3 py-2.5 px-3 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Log Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {accountModalOpen && (
                <AccountModal
                    user={user}
                    onClose={() => setAccountModalOpen(false)}
                    onUpdateUser={setUser}
                />
            )}
        </header>
    );
}