import React, { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { getTaskActivities } from '../../util/api';
import Avatar from '../common/Avatar';
import {
    HiOutlinePlus,
    HiOutlineSwitchHorizontal,
    HiOutlineUserAdd,
    HiOutlineTrendingUp,
    HiOutlineCalendar,
    HiOutlinePencil,
    HiOutlineTag,
    HiOutlineLink,
    HiOutlineChatAlt2,
    HiOutlineTrash,
    HiOutlineFlag,
} from 'react-icons/hi';

const TYPE_CONFIG = {
    CREATED:              { icon: HiOutlinePlus, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
    STATUS_CHANGED:       { icon: HiOutlineSwitchHorizontal, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/40' },
    PRIORITY_CHANGED:     { icon: HiOutlineFlag, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/40' },
    ASSIGNEE_CHANGED:     { icon: HiOutlineUserAdd, color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/40' },
    PROGRESS_CHANGED:     { icon: HiOutlineTrendingUp, color: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-900/40' },
    DATES_CHANGED:        { icon: HiOutlineCalendar, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/40' },
    SUMMARY_CHANGED:      { icon: HiOutlinePencil, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700' },
    DESCRIPTION_CHANGED:  { icon: HiOutlinePencil, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700' },
    LABELS_CHANGED:       { icon: HiOutlineTag, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/40' },
    DEPENDENCIES_CHANGED: { icon: HiOutlineLink, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
    ATTACHMENTS_CHANGED:  { icon: HiOutlineLink, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/40' },
    COMMENT_ADDED:        { icon: HiOutlineChatAlt2, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/40' },
    COMMENT_DELETED:      { icon: HiOutlineTrash, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/40' },
};

const FALLBACK = { icon: HiOutlineSwitchHorizontal, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700' };

const STATUS_LABELS = {
    BACKLOG: 'Backlog', TODO: 'To Do', IN_PROGRESS: 'In Progress',
    IN_TEST: 'In Test', TO_TEST: 'To Test', TO_REVIEW: 'To Review',
    READY_TO_MERGE: 'Ready to Merge', READY_TO_DEPLOY: 'Ready to Deploy',
    DONE: 'Done', RELEASED: 'Released', WITHDRAWN: 'Withdrawn',
    GATHERING_INTEREST: 'Gathering Interest',
};

const PRIORITY_LABELS = {
    LOWEST: 'Lowest', LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', HIGHEST: 'Highest',
};

function formatValue(field, value) {
    if (!value || value === 'null') return null;
    if (field === 'status') return STATUS_LABELS[value] || value;
    if (field === 'priority') return PRIORITY_LABELS[value] || value;
    if (field === 'progress') return `${value}%`;
    return value;
}

function ValuePill({ value, variant = 'default' }) {
    if (!value) return <span className="text-slate-400 dark:text-slate-500 italic">none</span>;
    const cls = variant === 'old'
        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 line-through'
        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400';
    return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>{value}</span>;
}

function ActivityDescription({ activity }) {
    const { type, fieldName, oldValue, newValue, authorName } = activity;
    const name = <span className="font-medium text-slate-800 dark:text-slate-200">{authorName}</span>;

    switch (type) {
        case 'CREATED':
            return <span>{name} created this task</span>;
        case 'COMMENT_ADDED':
            return <span>{name} added a comment</span>;
        case 'COMMENT_DELETED':
            return <span>{name} deleted a comment</span>;
        case 'STATUS_CHANGED':
            return (
                <span>{name} changed status from <ValuePill value={formatValue(fieldName, oldValue)} variant="old" /> to <ValuePill value={formatValue(fieldName, newValue)} /></span>
            );
        case 'PRIORITY_CHANGED':
            return (
                <span>{name} changed priority from <ValuePill value={formatValue(fieldName, oldValue)} variant="old" /> to <ValuePill value={formatValue(fieldName, newValue)} /></span>
            );
        case 'ASSIGNEE_CHANGED':
            if (!oldValue) return <span>{name} assigned <ValuePill value={newValue} /></span>;
            if (!newValue) return <span>{name} unassigned <ValuePill value={oldValue} variant="old" /></span>;
            return <span>{name} reassigned from <ValuePill value={oldValue} variant="old" /> to <ValuePill value={newValue} /></span>;
        case 'PROGRESS_CHANGED':
            return (
                <span>{name} updated progress from <ValuePill value={formatValue(fieldName, oldValue)} variant="old" /> to <ValuePill value={formatValue(fieldName, newValue)} /></span>
            );
        case 'DATES_CHANGED':
            return <span>{name} changed dates</span>;
        case 'SUMMARY_CHANGED':
            return <span>{name} renamed the task</span>;
        case 'DESCRIPTION_CHANGED':
            return <span>{name} updated the description</span>;
        case 'LABELS_CHANGED':
            return <span>{name} changed labels</span>;
        case 'DEPENDENCIES_CHANGED':
            return <span>{name} changed dependencies</span>;
        case 'ATTACHMENTS_CHANGED':
            return <span>{name} changed attachments</span>;
        default:
            return <span>{name} made a change</span>;
    }
}

export default function ActivityTab({ taskId }) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchActivities = useCallback(async () => {
        try {
            const data = await getTaskActivities(taskId);
            setActivities(data);
        } catch (err) {
            console.error('Error fetching activities:', err);
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    if (loading) {
        return (
            <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 dark:border-slate-700 border-t-slate-500 dark:border-t-slate-400 mx-auto" />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Loading history...</p>
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="py-6 text-center">
                <p className="text-xs text-slate-300 dark:text-slate-600">No activity yet</p>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-200 dark:bg-slate-700" />

            <div className="space-y-0">
                {activities.map((activity) => {
                    const cfg = TYPE_CONFIG[activity.type] || FALLBACK;
                    const Icon = cfg.icon;
                    const authorParts = {
                        firstname: activity.authorName?.split(' ')[0],
                        lastname: activity.authorName?.split(' ')[1],
                    };

                    return (
                        <div key={activity.id} className="relative flex gap-3 py-2 group">
                            {/* Icon dot */}
                            <div className={`relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg} ring-2 ring-white dark:ring-slate-900`}>
                                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-0.5">
                                <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    <ActivityDescription activity={activity} />
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Avatar user={authorParts} profilePicture={activity.authorProfilePicture} size="xs" className="w-4 h-4 text-[8px]" />
                                    <span className="text-xs text-slate-400 dark:text-slate-500">
                                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
