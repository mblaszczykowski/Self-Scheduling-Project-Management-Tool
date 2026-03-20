import React from 'react';
import { HiOutlineLogout } from 'react-icons/hi';
import Avatar from '../common/Avatar';

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
                className="p-2 bg-white rounded-lg hover:bg-slate-50 focus:outline-none transition-colors border border-slate-200"
                onClick={onOpenAccountModal}
            >
                <Avatar user={user} size="xs" />
            </button>

            <button
                type="button"
                className="p-2 inline-flex items-center text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                onClick={onLogoutClick}
                title="Log out"
            >
                <HiOutlineLogout className="h-5 w-5" />
            </button>
        </div>
    );
}
