import React from 'react';

interface MenuButtonProps {
    onClick?: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title?: string;
}

export const MenuButton = ({ onClick, isActive, disabled, children, title }: MenuButtonProps) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`p-1.5 rounded-md transition-colors duration-100 text-sm leading-none ${
            isActive
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
        } disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
    >
        {children}
    </button>
);

export const MenuDivider = () => <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />;
