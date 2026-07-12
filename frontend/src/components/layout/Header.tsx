import React, { useContext, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HiOutlineMenu, HiOutlineX } from 'react-icons/hi';
import { AuthContext } from '../../context/AuthContext';
import { NotificationsContext } from '../../context/NotificationsContext';
import { useTheme } from '../../context/ThemeContext';
import AccountModal from '../modals/AccountModal';
import NotificationDropdown from './NotificationDropdown';
import CreateMenu from './CreateMenu';
import UserMenu from './UserMenu';
import ConfirmDialog from '../modals/ConfirmDialog';
import MobileMenu from './MobileMenu';
import { markNotificationsAsRead } from '../../util/api';
import SearchBar from './SearchBar';

const NavLink = ({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) => (
    <Link
        to={to}
        className={
            active
                ? 'py-1.5 px-3.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium rounded-lg transition-colors'
                : 'py-1.5 px-3.5 text-slate-500 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors'
        }
    >
        {children}
    </Link>
);

interface HeaderProps {
    onLogout: () => void;
    onCreateProject: () => void;
    onCreateTask: () => void;
}

export default function Header({ onLogout, onCreateProject, onCreateTask }: HeaderProps) {
    const { user, setUser } = useContext(AuthContext);
    const { notifications, setNotifications } = useContext(NotificationsContext);
    const { theme, toggleTheme } = useTheme();
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const location = useLocation();

    const handleLogoutClick = () => setLogoutConfirmOpen(true);

    const handleLogoutConfirm = () => {
        setLogoutConfirmOpen(false);
        onLogout();
    };

    const handleMarkNotificationsAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
        if (unreadIds.length > 0) {
            try {
                await markNotificationsAsRead(unreadIds);
                // Only mark the ids we actually acknowledged — notifications that
                // arrived via SSE during the await must stay unread.
                setNotifications(prev => prev.map(n =>
                    unreadIds.includes(n.id) ? { ...n, isRead: true } : n
                ));
            } catch (err) {
                console.error('Error marking notifications as read:', err);
            }
        }
    };

    const handleMarkSingleRead = async (notificationId: number) => {
        try {
            await markNotificationsAsRead([notificationId]);
            setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    return (
        <header className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-50">
            <nav className="mx-auto px-6 lg:px-10 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <Link to="/dashboard" className="flex items-center">
                        <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center">
                            <div className="w-4 h-4 bg-white dark:bg-slate-900 rounded" />
                        </div>
                        <span className="ml-2.5 text-base font-semibold text-slate-900 dark:text-white tracking-tight">Flowlink</span>
                    </Link>

                    <div className="hidden xl:flex items-center gap-1">
                        <NavLink to="/dashboard" active={location.pathname === '/dashboard'}>Dashboard</NavLink>
                        <NavLink to="/projects" active={location.pathname === '/projects'}>Projects</NavLink>
                        <CreateMenu
                            isOpen={createDropdownOpen}
                            onToggle={() => setCreateDropdownOpen(!createDropdownOpen)}
                            onClose={() => setCreateDropdownOpen(false)}
                            onCreateProject={onCreateProject}
                            onCreateTask={onCreateTask}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <div className="hidden xl:block mr-2">
                        <SearchBar />
                    </div>
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-[18px] h-[18px] text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        ) : (
                            <svg className="w-[18px] h-[18px] text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        )}
                    </button>
                    <NotificationDropdown
                        notifications={notifications}
                        isOpen={notificationsOpen}
                        onToggle={() => setNotificationsOpen(true)}
                        onClose={() => setNotificationsOpen(false)}
                        onMarkAsRead={handleMarkNotificationsAsRead}
                        onMarkSingleRead={handleMarkSingleRead}
                    />
                    <div className="hidden xl:flex items-center gap-1">
                        <UserMenu
                            user={user}
                            onOpenAccountModal={() => setAccountModalOpen(true)}
                            onLogoutClick={handleLogoutClick}
                        />
                    </div>
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-expanded={mobileMenuOpen}
                        aria-controls="mobile-menu"
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        className="xl:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg focus:outline-none transition-colors"
                    >
                        {mobileMenuOpen ? (
                            <HiOutlineX className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                        ) : (
                            <HiOutlineMenu className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                        )}
                    </button>
                </div>
            </nav>

            {mobileMenuOpen && (
                <MobileMenu
                    location={location}
                    onClose={() => setMobileMenuOpen(false)}
                    onCreateProject={onCreateProject}
                    onCreateTask={onCreateTask}
                    onOpenAccountModal={() => setAccountModalOpen(true)}
                    onLogoutClick={handleLogoutClick}
                />
            )}

            {accountModalOpen && (
                <AccountModal user={user} onClose={() => setAccountModalOpen(false)} onUpdateUser={setUser} />
            )}

            <ConfirmDialog
                isOpen={logoutConfirmOpen}
                onClose={() => setLogoutConfirmOpen(false)}
                onConfirm={handleLogoutConfirm}
                title="Log out?"
                message="Are you sure you want to log out? You'll need to sign in again to access your projects."
                confirmText="Log out"
                cancelText="Cancel"
                variant="danger"
            />
        </header>
    );
}
