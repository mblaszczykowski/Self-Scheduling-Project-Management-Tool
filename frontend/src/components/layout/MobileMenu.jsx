import React from 'react';
import { Link } from 'react-router-dom';

export default function MobileMenu({
    location,
    onClose,
    onCreateProject,
    onCreateTask,
    onOpenAccountModal,
    onLogoutClick
}) {
    const MobileNavLink = ({ to, children }) => (
        <Link
            to={to}
            className={`block py-2.5 px-3 text-sm font-medium rounded-lg transition-colors ${
                location.pathname === to
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
            onClick={onClose}
        >
            {children}
        </Link>
    );

    return (
        <nav id="mobile-menu" role="navigation" aria-label="Mobile navigation" className="xl:hidden border-t border-slate-200 bg-white animate-[slideDown_0.2s_ease-out]">
            <div className="px-6 py-4 space-y-1">
                <MobileNavLink to="/dashboard">Dashboard</MobileNavLink>
                <MobileNavLink to="/projects">Projects</MobileNavLink>

                <div className="pt-3 mt-3 border-t border-slate-100 space-y-1">
                    <MobileMenuButton onClick={() => { onClose(); onCreateProject(); }} icon="project">Create Project</MobileMenuButton>
                    <MobileMenuButton onClick={() => { onClose(); onCreateTask(); }} icon="task">Create Task</MobileMenuButton>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 space-y-1">
                    <MobileMenuButton onClick={() => { onClose(); onOpenAccountModal(); }} icon="account">Account Settings</MobileMenuButton>
                    <MobileMenuButton onClick={() => { onClose(); onLogoutClick(); }} icon="logout" variant="danger">Log Out</MobileMenuButton>
                </div>
            </div>
        </nav>
    );
}

function MobileMenuButton({ onClick, icon, variant, children }) {
    const icons = {
        project: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />,
        task: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
        account: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
        logout: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    };

    const baseClass = variant === 'danger'
        ? 'w-full flex items-center gap-3 py-2.5 px-3 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors'
        : 'w-full flex items-center gap-3 py-2.5 px-3 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors';

    return (
        <button onClick={onClick} className={baseClass}>
            <svg className={`w-4 h-4 ${variant === 'danger' ? '' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {icons[icon]}
            </svg>
            {children}
        </button>
    );
}
