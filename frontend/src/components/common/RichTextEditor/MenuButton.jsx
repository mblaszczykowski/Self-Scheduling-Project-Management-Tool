import React from 'react';

export const MenuButton = ({ onClick, isActive, disabled, children, title }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`group relative p-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
            isActive
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 scale-105'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95'
        } disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
    >
        {children}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </button>
);

export const MenuDivider = () => <div className="w-px h-7 bg-slate-200 mx-0.5" />;
