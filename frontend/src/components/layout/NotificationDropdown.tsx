import React, { useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    HiOutlineBell,
    HiOutlineUserAdd,
    HiOutlineClipboardCheck,
    HiOutlinePencilAlt,
    HiOutlineChatAlt2,
    HiOutlineThumbUp,
    HiOutlineTrash,
    HiOutlineCog,
    HiOutlineUserRemove,
} from 'react-icons/hi';
import { IconType } from 'react-icons';
import { formatDistanceToNow } from 'date-fns';
import { useClickOutside } from '../../hooks/useClickOutside';
import { Notification } from '../../types';

const TYPE_CONFIG: Record<string, { icon: IconType; color: string; bg: string; label: string }> = {
    PROJECT_INVITATION: { icon: HiOutlineUserAdd, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', label: 'Invitation' },
    PROJECT_UPDATED:    { icon: HiOutlineCog, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', label: 'Project' },
    MEMBER_REMOVED:     { icon: HiOutlineUserRemove, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30', label: 'Removed' },
    TASK_ASSIGNED:      { icon: HiOutlineClipboardCheck, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', label: 'Assigned' },
    TASK_UPDATED:       { icon: HiOutlinePencilAlt, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', label: 'Updated' },
    TASK_COMMENT:       { icon: HiOutlineChatAlt2, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/30', label: 'Comment' },
    TASK_DELETED:       { icon: HiOutlineTrash, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30', label: 'Deleted' },
    COMMENT_REPLY:      { icon: HiOutlineChatAlt2, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30', label: 'Reply' },
    COMMENT_REACTION:   { icon: HiOutlineThumbUp, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-900/30', label: 'Reaction' },
};

const FALLBACK_CONFIG = { icon: HiOutlineBell, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800', label: 'Notification' };

function NotificationItem({ notification, onClose, onMarkSingleRead }: { notification: Notification; onClose: () => void; onMarkSingleRead: (id: number) => void }) {
    const cfg = TYPE_CONFIG[notification.type ?? ''] || FALLBACK_CONFIG;
    const Icon = cfg.icon;
    const isUnread = !notification.isRead;

    const handleClick = () => {
        if (isUnread) onMarkSingleRead(notification.id);
        onClose();
    };

    const timeAgo = formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true });

    const content = (
        <div className="flex gap-3 items-start">
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                <Icon className={`w-4 h-4 ${cfg.color}`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${cfg.color}`}>
                        {cfg.label}
                    </span>
                    {isUnread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                </div>
                <p className={`text-sm leading-snug ${isUnread ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-600 dark:text-slate-300'}`}>
                    {notification.message}
                </p>
                <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 block">{timeAgo}</span>
            </div>
        </div>
    );

    if (notification.link && notification.link.trim()) {
        return (
            <Link
                to={notification.link}
                className={`block px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${isUnread ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                onClick={handleClick}
            >
                {content}
            </Link>
        );
    }

    return (
        <div
            className={`px-4 py-3 ${isUnread ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
            onClick={handleClick}
        >
            {content}
        </div>
    );
}

interface NotificationDropdownProps {
    notifications: Notification[];
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
    onMarkAsRead: () => void;
    onMarkSingleRead: (id: number) => void;
}

export default function NotificationDropdown({
    notifications,
    isOpen,
    onToggle,
    onClose,
    onMarkAsRead,
    onMarkSingleRead,
}: NotificationDropdownProps) {
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    useClickOutside(dropdownRef, onClose);

    const { unreadNotifications, readNotifications } = useMemo(() => {
        const unread: Notification[] = [];
        const read: Notification[] = [];
        for (const n of notifications) {
            (n.isRead ? read : unread).push(n);
        }
        return { unreadNotifications: unread, readNotifications: read };
    }, [notifications]);
    const unreadCount = unreadNotifications.length;

    const handleBellClick = async () => {
        if (isOpen) {
            await onMarkAsRead();
            onClose();
        } else {
            onToggle();
        }
    };

    return (
        <div ref={dropdownRef} className="relative">
            <button
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-colors"
                onClick={handleBellClick}
            >
                <HiOutlineBell className="h-[18px] w-[18px] text-slate-500 dark:text-slate-400" aria-hidden="true" />
                {unreadCount > 0 && (
                    <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>
            {isOpen && (
                <div
                    role="menu"
                    aria-label="Notifications"
                    className="absolute right-0 mt-2 w-[420px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-[slideDown_0.2s_ease-out]"
                >
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-full">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onMarkAsRead(); }}
                                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification list */}
                    <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                        {unreadNotifications.length > 0 && unreadNotifications.map(n => (
                            <NotificationItem
                                key={n.id}
                                notification={n}
                                onClose={onClose}
                                onMarkSingleRead={onMarkSingleRead}
                            />
                        ))}

                        {readNotifications.length > 0 && (
                            <>
                                {unreadNotifications.length > 0 && (
                                    <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800/50">
                                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Earlier</span>
                                    </div>
                                )}
                                {readNotifications.map(n => (
                                    <NotificationItem
                                        key={n.id}
                                        notification={n}
                                        onClose={onClose}
                                        onMarkSingleRead={onMarkSingleRead}
                                    />
                                ))}
                            </>
                        )}

                        {notifications.length === 0 && (
                            <div className="px-4 py-12 text-center">
                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3">
                                    <HiOutlineBell className="w-6 h-6 text-slate-300 dark:text-slate-500" />
                                </div>
                                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">No notifications yet</p>
                                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">We'll notify you when something happens</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
