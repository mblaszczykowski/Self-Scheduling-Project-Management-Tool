import React from 'react';
import { HiOutlineExclamation } from 'react-icons/hi';

const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger'
}) => {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            iconBg: 'bg-red-50 dark:bg-red-950/40',
            iconColor: 'text-red-500 dark:text-red-400',
            confirmBg: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400'
        },
        warning: {
            iconBg: 'bg-amber-50 dark:bg-amber-950/40',
            iconColor: 'text-amber-500 dark:text-amber-400',
            confirmBg: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400'
        }
    };

    const styles = variantStyles[variant] || variantStyles.danger;

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[80] flex items-center justify-center"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-[#1a1a2e] border border-slate-200 dark:border-slate-700/60 rounded-lg shadow-[0_16px_48px_-12px_rgba(0,0,0,0.25)] max-w-sm w-full mx-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-description"
            >
                <div className="px-5 py-4">
                    <div className="flex items-start gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-md ${styles.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                            <HiOutlineExclamation className={`w-4 h-4 ${styles.iconColor}`} />
                        </div>
                        <div>
                            <h3 id="confirm-dialog-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {title}
                            </h3>
                            <p id="confirm-dialog-description" className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                {message}
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`px-3 py-1.5 text-[13px] font-semibold text-white rounded transition-colors ${styles.confirmBg}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
