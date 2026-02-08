import React, { useRef, useEffect } from 'react';
import { HiOutlineChevronDown, HiOutlineFolderOpen, HiOutlineClipboardList } from 'react-icons/hi';

export default function CreateMenu({
    isOpen,
    onToggle,
    onClose,
    onCreateProject,
    onCreateTask
}) {
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleCreateProject = () => {
        onClose();
        onCreateProject();
    };

    const handleCreateTask = () => {
        onClose();
        onCreateTask();
    };

    return (
        <div ref={dropdownRef} className="relative ml-2">
            <button
                onClick={onToggle}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-label="Create new item"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
                Create
                <HiOutlineChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            {isOpen && (
                <div role="menu" aria-label="Create options" className="absolute left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden animate-[slideDown_0.2s_ease-out]">
                    <div className="py-1">
                        <button
                            onClick={handleCreateProject}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <HiOutlineFolderOpen className="w-4 h-4 text-slate-400" />
                            <span>New Project</span>
                        </button>
                        <button
                            onClick={handleCreateTask}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <HiOutlineClipboardList className="w-4 h-4 text-slate-400" />
                            <span>New Task</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
