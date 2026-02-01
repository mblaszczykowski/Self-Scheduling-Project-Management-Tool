import React from 'react';
import { getImageUrl, getAvatarColor, getAvatarInitials } from '../../util/helpers';

export default function UserMenu({
    user,
    onOpenAccountModal,
    onLogoutClick
}) {
    return (
        <div className="flex items-center gap-3">
            <button
                type="button"
                aria-label="Account settings"
                className="p-1.5 bg-white rounded-lg hover:bg-slate-50 focus:outline-none transition-colors border border-slate-200"
                onClick={onOpenAccountModal}
            >
                {user?.profilePicture ? (
                    <img
                        src={getImageUrl(user.profilePicture)}
                        alt={`${user.firstname || ''} ${user.lastname || ''}'s profile`}
                        className="h-7 w-7 rounded-lg object-cover"
                    />
                ) : (
                    <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${getAvatarColor(user)} flex items-center justify-center`}>
                        <span className="text-xs font-semibold text-white">
                            {getAvatarInitials(user)}
                        </span>
                    </div>
                )}
            </button>

            <button
                type="button"
                className="p-2 inline-flex items-center text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                onClick={onLogoutClick}
                title="Log out"
            >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
            </button>
        </div>
    );
}

export function LogoutConfirmDialog({ isOpen, onClose, onConfirm }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="logout-title"
                aria-describedby="logout-description"
            >
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </div>
                        <h3 id="logout-title" className="text-lg font-semibold text-slate-900">Log out?</h3>
                    </div>
                    <p id="logout-description" className="text-sm text-slate-600 mb-6">
                        Are you sure you want to log out? You'll need to sign in again to access your projects.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
