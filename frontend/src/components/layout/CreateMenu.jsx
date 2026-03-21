import React, { useRef } from 'react';
import { HiOutlineChevronDown, HiOutlineFolderOpen, HiOutlineClipboardList } from 'react-icons/hi';
import { useClickOutside } from '../../hooks/useClickOutside';

export default function CreateMenu({
    isOpen,
    onToggle,
    onClose,
    onCreateProject,
    onCreateTask
}) {
    const dropdownRef = useRef(null);
    useClickOutside(dropdownRef, onClose);

    const handleCreateProject = () => {
        onClose();
        onCreateProject();
    };

    const handleCreateTask = () => {
        onClose();
        onCreateTask();
    };

    return (
        <div ref={dropdownRef} className="relative ml-1">
            <button
                onClick={onToggle}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-label="Create new item"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
                Create
                <HiOutlineChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {isOpen && (
                <div role="menu" aria-label="Create options" className="absolute left-0 mt-1.5 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden animate-[slideDown_0.2s_ease-out]">
                    <div className="py-1">
                        <button
                            onClick={handleCreateProject}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <HiOutlineFolderOpen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <span>New Project</span>
                        </button>
                        <button
                            onClick={handleCreateTask}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <HiOutlineClipboardList className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <span>New Task</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
