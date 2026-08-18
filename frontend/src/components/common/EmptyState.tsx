import React from 'react';
import { IconType } from 'react-icons';
import { HiOutlineClipboardList, HiOutlineCalendar, HiOutlineCollection, HiOutlineSearch } from 'react-icons/hi';
import { useAnimateIn } from '../../hooks/useAnimateIn';

type EmptyStateVariant = 'table' | 'timeline' | 'list' | 'search';

const iconMap: Record<EmptyStateVariant, IconType> = {
    table: HiOutlineClipboardList,
    timeline: HiOutlineCalendar,
    list: HiOutlineCollection,
    search: HiOutlineSearch,
};

const defaultMessages: Record<EmptyStateVariant, { title: string; description: string }> = {
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

interface EmptyStateProps {
    variant?: EmptyStateVariant;
    title?: string;
    description?: string;
    icon?: IconType;
    action?: () => void;
    actionLabel?: string;
    className?: string;
    /** 'sm' fits inside a dashboard card, where a full-page empty state would dwarf the card. */
    size?: 'sm' | 'md';
}

const EmptyState = ({
    variant = 'list',
    title,
    description,
    icon: CustomIcon,
    action,
    actionLabel,
    className = '',
    size = 'md',
}: EmptyStateProps) => {
    const [isVisible] = useAnimateIn();

    const compact = size === 'sm';
    const Icon = CustomIcon || iconMap[variant] || iconMap.list;
    const displayTitle = title || defaultMessages[variant]?.title || defaultMessages.list.title;
    // At 'sm' the title carries the whole message, so an unasked-for default would only add noise.
    const displayDescription = description
        || (compact ? '' : defaultMessages[variant]?.description || defaultMessages.list.description);

    return (
        <div
            className={`flex flex-col items-center justify-center transition-all duration-300 ${
                compact ? 'py-8' : 'py-16 px-4'
            } ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${className}`}
        >
            <div className={`rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${
                compact ? 'w-12 h-12 mb-3' : 'w-14 h-14 mb-4'
            }`}>
                <Icon className={`text-slate-400 dark:text-slate-500 ${compact ? 'w-6 h-6' : 'w-7 h-7'}`} />
            </div>
            <h3 className={`text-slate-900 dark:text-white ${
                compact ? 'text-xs font-medium text-slate-500 dark:text-slate-400' : 'text-lg font-semibold mb-1'
            }`}>{displayTitle}</h3>
            {displayDescription && (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm mb-4">{displayDescription}</p>
            )}
            {action && actionLabel && (
                <button
                    onClick={action}
                    className="px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
