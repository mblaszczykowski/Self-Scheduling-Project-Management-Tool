import React, { useContext, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HiOutlineMenu, HiOutlineX } from 'react-icons/hi';
import { AuthContext } from '../../context/AuthContext';
import { NotificationsContext } from '../../context/NotificationsContext';
import AccountModal from '../modals/AccountModal';
import NotificationDropdown from './NotificationDropdown';
import CreateMenu from './CreateMenu';
import UserMenu from './UserMenu';
import ConfirmDialog from '../modals/ConfirmDialog';
import MobileMenu from './MobileMenu';
import { markNotificationsAsRead } from '../../util/api';

export default function Header({ onLogout, onCreateProject, onCreateTask }) {
    const { user, setUser } = useContext(AuthContext);
    const { notifications, setNotifications } = useContext(NotificationsContext);
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
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            } catch (err) {
                console.error('Error marking notifications as read:', err);
            }
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

    return (
        <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-50">
            <nav className="mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <Link to="/dashboard" className="flex items-center">
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                            <div className="w-4 h-4 bg-white rounded" />
                        </div>
                        <span className="ml-3 text-lg font-semibold text-slate-900">Flowlink</span>
                    </Link>

                    <div className="hidden xl:flex items-center gap-1">
                        <NavLink to="/dashboard">Dashboard</NavLink>
                        <NavLink to="/projects">Projects</NavLink>
                        <CreateMenu
                            isOpen={createDropdownOpen}
                            onToggle={() => setCreateDropdownOpen(!createDropdownOpen)}
                            onClose={() => setCreateDropdownOpen(false)}
                            onCreateProject={onCreateProject}
                            onCreateTask={onCreateTask}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <NotificationDropdown
                        notifications={notifications}
                        isOpen={notificationsOpen}
                        onToggle={() => setNotificationsOpen(true)}
                        onClose={() => setNotificationsOpen(false)}
                        onMarkAsRead={handleMarkNotificationsAsRead}
                    />
                    <div className="hidden xl:flex items-center gap-2">
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
                        className="xl:hidden p-2 hover:bg-slate-100 rounded-lg focus:outline-none transition-colors"
                    >
                        {mobileMenuOpen ? (
                            <HiOutlineX className="h-5 w-5 text-slate-600" aria-hidden="true" />
                        ) : (
                            <HiOutlineMenu className="h-5 w-5 text-slate-600" aria-hidden="true" />
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
