import React from 'react';
import { Link, Location } from 'react-router-dom';
import { BoxIcon, ClipboardIcon, UserIcon, LogoutIcon } from '../common/Icons';

interface MobileMenuProps {
    location: Location;
    onClose: () => void;
    onCreateProject: () => void;
    onCreateTask: () => void;
    onOpenAccountModal: () => void;
    onLogoutClick: () => void;
}

export default function MobileMenu({
    location,
    onClose,
    onCreateProject,
    onCreateTask,
    onOpenAccountModal,
    onLogoutClick
}: MobileMenuProps) {
    const MobileNavLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
        <Link
            to={to}
            className={`block py-2.5 px-3 text-sm font-medium rounded-lg transition-colors ${
                location.pathname === to
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
            onClick={onClose}
        >
            {children}
        </Link>
    );

    return (
        <nav id="mobile-menu" role="navigation" aria-label="Mobile navigation" className="xl:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-[slideDown_0.2s_ease-out]">
            <div className="px-6 py-4 space-y-1">
                <MobileNavLink to="/dashboard">Dashboard</MobileNavLink>
                <MobileNavLink to="/projects">Projects</MobileNavLink>

                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    <MobileMenuButton onClick={() => { onClose(); onCreateProject(); }} icon={<BoxIcon />}>Create Project</MobileMenuButton>
                    <MobileMenuButton onClick={() => { onClose(); onCreateTask(); }} icon={<ClipboardIcon />}>Create Task</MobileMenuButton>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    <MobileMenuButton onClick={() => { onClose(); onOpenAccountModal(); }} icon={<UserIcon />}>Account Settings</MobileMenuButton>
                    <MobileMenuButton onClick={() => { onClose(); onLogoutClick(); }} icon={<LogoutIcon />} variant="danger">Log Out</MobileMenuButton>
                </div>
            </div>
        </nav>
    );
}

function MobileMenuButton({ onClick, icon, variant, children }: { onClick: () => void; icon: React.ReactNode; variant?: 'danger'; children: React.ReactNode }) {
    const baseClass = variant === 'danger'
        ? 'w-full flex items-center gap-3 py-2.5 px-3 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
        : 'w-full flex items-center gap-3 py-2.5 px-3 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors';

    return (
        <button onClick={onClick} className={baseClass}>
            <span className={variant === 'danger' ? '' : 'text-slate-400'}>{icon}</span>
            {children}
        </button>
    );
}
