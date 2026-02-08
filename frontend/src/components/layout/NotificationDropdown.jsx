import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineBell } from 'react-icons/hi';

export default function NotificationDropdown({
    notifications,
    isOpen,
    onToggle,
    onClose,
    onMarkAsRead
}) {
    const dropdownRef = useRef(null);
    const unreadCount = notifications.filter(n => !n.isRead).length;

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleClick = async () => {
        if (isOpen) {
            await onMarkAsRead();
            onClose();
        } else {
            onToggle();
        }
    };

    const unreadNotifications = notifications.filter(n => !n.isRead);
    const readNotifications = notifications.filter(n => n.isRead);

    return (
        <div ref={dropdownRef} className="relative">
            <button
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                className="relative p-2 bg-white rounded-lg hover:bg-slate-50 focus:outline-none transition-colors border border-slate-200"
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
                <div role="menu" aria-label="Notifications" className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden animate-[slideDown_0.2s_ease-out]">
                    <div className="max-h-96 overflow-y-auto">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Notifications</span>
                        </div>

                        {unreadNotifications.length > 0 && (
                            <div className="border-b border-slate-100">
                                <div className="px-4 py-2 bg-slate-50">
                                    <span className="text-xs font-medium text-slate-500">Unread</span>
                                </div>
                                {unreadNotifications.map(n => (
                                    <Link
                                        key={n.id}
                                        to={n.link || '#'}
                                        className="block px-4 py-3 hover:bg-slate-50 transition-colors border-l-2 border-slate-900"
                                        onClick={onClose}
                                    >
                                        <div className="text-sm font-medium text-slate-900">{n.message}</div>
                                        <div className="text-xs text-slate-500 mt-1">{new Date(n.timestamp).toLocaleString()}</div>
                                    </Link>
                                ))}
                            </div>
                        )}

                        {readNotifications.length > 0 && (
                            <div>
                                <div className="px-4 py-2 bg-slate-50">
                                    <span className="text-xs font-medium text-slate-500">Read</span>
                                </div>
                                {readNotifications.map(n => (
                                    <Link
                                        key={n.id}
                                        to={n.link || '#'}
                                        className="block px-4 py-3 hover:bg-slate-50 transition-colors"
                                        onClick={onClose}
                                    >
                                        <div className="text-sm text-slate-600">{n.message}</div>
                                        <div className="text-xs text-slate-400 mt-1">{new Date(n.timestamp).toLocaleString()}</div>
                                    </Link>
                                ))}
                            </div>
                        )}

                        {notifications.length === 0 && (
                            <div className="px-4 py-8 text-center">
                                <HiOutlineBell className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                <p className="text-sm text-slate-400">No notifications</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
