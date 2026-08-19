import React, { useEffect, useId, useRef } from 'react';
import { HiOutlineExclamation } from 'react-icons/hi';
import { trapFocus } from '../common/focusTrap';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: React.ReactNode;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning';
}

const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger'
}: ConfirmDialogProps) => {
    const dialogId = useId();
    const titleId = `${dialogId}-title`;
    const descriptionId = `${dialogId}-description`;

    const dialogRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        dialogRef.current?.focus();
        return () => {
            previousFocusRef.current?.focus();
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
                return;
            }
            if (dialogRef.current) trapFocus(dialogRef.current, e);
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            iconBg: 'bg-red-100 dark:bg-red-950/40',
            iconColor: 'text-red-600 dark:text-red-400',
            confirmBg: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400'
        },
        warning: {
            iconBg: 'bg-amber-100 dark:bg-amber-950/40',
            iconColor: 'text-amber-600 dark:text-amber-400',
            confirmBg: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400'
        }
    };

    const styles = variantStyles[variant] || variantStyles.danger;

    return (
        <div
            className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center"
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                tabIndex={-1}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
            >
                <div className="px-6 pt-6 pb-4">
                    <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl ${styles.iconBg} flex items-center justify-center shrink-0`}>
                            <HiOutlineExclamation className={`w-5 h-5 ${styles.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 id={titleId} className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                {title}
                            </h3>
                            <p id={descriptionId} className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${styles.confirmBg}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
