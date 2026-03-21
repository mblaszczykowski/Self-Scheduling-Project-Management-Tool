import React from 'react';

export const MenuButton = ({ onClick, isActive, disabled, children, title }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`p-1.5 rounded transition-colors duration-100 text-sm leading-none ${
            isActive
                ? 'bg-slate-800 dark:bg-blue-500/80 text-white'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        } disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
    >
        {children}
    </button>
);

export const MenuDivider = () => <div className="w-px h-4 bg-slate-150 dark:bg-slate-700 mx-0.5" />;
