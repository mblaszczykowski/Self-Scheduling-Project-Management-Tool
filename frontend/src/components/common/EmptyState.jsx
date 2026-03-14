import React from 'react';
import { HiOutlineClipboardList, HiOutlineCalendar, HiOutlineCollection, HiOutlineSearch } from 'react-icons/hi';
import { useAnimateIn } from '../../hooks/useAnimateIn';

const iconMap = {
    table: HiOutlineClipboardList,
    timeline: HiOutlineCalendar,
    list: HiOutlineCollection,
    search: HiOutlineSearch,
};

const defaultMessages = {
    table: {
        title: 'No tasks yet',
        description: 'Create your first task to get started with tracking your work.',
    },
    timeline: {
        title: 'No tasks to display',
        description: 'Add tasks with dates to see them on the timeline.',
    },
    list: {
        title: 'Nothing here',
        description: 'This list is empty.',
    },
    search: {
        title: 'No results found',
        description: 'Try adjusting your search or filter criteria.',
    },
};

const EmptyState = ({
    variant = 'list',
    title,
    description,
    icon: CustomIcon,
    action,
    actionLabel,
    className = '',
}) => {
    const [isVisible] = useAnimateIn();

    const Icon = CustomIcon || iconMap[variant] || iconMap.list;
    const displayTitle = title || defaultMessages[variant]?.title || defaultMessages.list.title;
    const displayDescription = description || defaultMessages[variant]?.description || defaultMessages.list.description;

    return (
        <div
            className={`flex flex-col items-center justify-center py-16 px-4 transition-all duration-300 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            } ${className}`}
        >
            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
                <Icon className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{displayTitle}</h3>
            <p className="text-sm text-slate-500 text-center max-w-sm mb-4">{displayDescription}</p>
            {action && actionLabel && (
                <button
                    onClick={action}
                    className="px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
