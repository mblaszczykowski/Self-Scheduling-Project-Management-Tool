import React from 'react';
import { HiOutlineLogout } from 'react-icons/hi';
import Avatar from '../common/Avatar';
import { User } from '../../types';

interface UserMenuProps {
    user: User | null;
    onOpenAccountModal: () => void;
    onLogoutClick: () => void;
}

export default function UserMenu({
    user,
    onOpenAccountModal,
    onLogoutClick
}: UserMenuProps) {
    return (
        <div className="flex items-center gap-1">
            <button
                type="button"
                aria-label="Account settings"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white transition-colors"
                onClick={onOpenAccountModal}
            >
                <Avatar user={user} size="sm" />
            </button>

            <button
                type="button"
                className="p-2 inline-flex items-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={onLogoutClick}
                title="Log out"
                aria-label="Log out"
            >
                <HiOutlineLogout className="h-[18px] w-[18px]" />
            </button>
        </div>
    );
}
