import React, { useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineBell } from 'react-icons/hi';
import { useClickOutside } from '../../hooks/useClickOutside';

export default function NotificationDropdown({
    notifications,
    isOpen,
    onToggle,
    onClose,
    onMarkAsRead
}) {
    const dropdownRef = useRef(null);
    useClickOutside(dropdownRef, onClose);

    const { unreadNotifications, readNotifications } = useMemo(() => {
        const unread = [];
        const read = [];
        for (const n of notifications) {
            (n.isRead ? read : unread).push(n);
        }
        return { unreadNotifications: unread, readNotifications: read };
    }, [notifications]);
    const unreadCount = unreadNotifications.length;

    const handleClick = async () => {
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
                className="relative p-2 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none transition-colors border border-slate-200 dark:border-slate-700"
                onClick={handleClick}
            >
                <HiOutlineBell className="h-5 w-5 text-slate-600" aria-hidden="true" />
                {unreadCount > 0 && (
                    <span aria-hidden="true" className="absolute -top-1 -right-1 inline-flex items-center justify-center h-5 w-5 text-xs font-semibold text-white bg-red-500 rounded-full">
                        {unreadCount}
                    </span>
                )}
            </button>
            {isOpen && (
                <div role="menu" aria-label="Notifications" className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden animate-[slideDown_0.2s_ease-out]">
                    <div className="max-h-96 overflow-y-auto">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wide">Notifications</span>
                            {unreadCount > 0 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMarkAsRead(); }}
                                    className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>

                        {unreadNotifications.length > 0 && (
                            <div className="border-b border-slate-100">
                                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Unread</span>
                                </div>
                                {unreadNotifications.map(n => (
                                    <Link
                                        key={n.id}
                                        to={n.link || '#'}
                                        className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-l-2 border-slate-900 dark:border-white"
                                        onClick={onClose}
                                    >
                                        <div className="text-sm font-medium text-slate-900 dark:text-white">{n.message}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{new Date(n.timestamp).toLocaleString()}</div>
                                    </Link>
                                ))}
                            </div>
                        )}

                        {readNotifications.length > 0 && (
                            <div>
                                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Read</span>
                                </div>
                                {readNotifications.map(n => (
                                    <Link
                                        key={n.id}
                                        to={n.link || '#'}
                                        className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                        onClick={onClose}
                                    >
                                        <div className="text-sm text-slate-600 dark:text-slate-300">{n.message}</div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{new Date(n.timestamp).toLocaleString()}</div>
                                    </Link>
                                ))}
                            </div>
                        )}

                        {notifications.length === 0 && (
                            <div className="px-4 py-8 text-center">
                                <HiOutlineBell className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                                <p className="text-sm text-slate-400 dark:text-slate-500">No notifications</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
