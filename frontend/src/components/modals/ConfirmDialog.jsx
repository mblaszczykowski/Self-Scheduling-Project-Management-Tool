import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';

/**
 * Reusable confirmation dialog component
 *
 * @param {boolean} isOpen - Whether the dialog is open
 * @param {function} onClose - Function to close the dialog
 * @param {function} onConfirm - Function to call when confirmed
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message/description
 * @param {string} confirmText - Text for confirm button (default: "Confirm")
 * @param {string} cancelText - Text for cancel button (default: "Cancel")
 * @param {string} variant - Color variant: "danger" (red) or "warning" (amber)
 */
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
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
            confirmBg: 'bg-red-600 hover:bg-red-700'
        },
        warning: {
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            confirmBg: 'bg-amber-600 hover:bg-amber-700'
        }
    };

    const styles = variantStyles[variant] || variantStyles.danger;

    return (
        <div
            className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-description"
            >
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-full ${styles.iconBg} flex items-center justify-center`}>
                            <FaExclamationTriangle className={`w-5 h-5 ${styles.iconColor}`} />
                        </div>
                        <h3 id="confirm-dialog-title" className="text-lg font-semibold text-slate-900">
                            {title}
                        </h3>
                    </div>
                    <p id="confirm-dialog-description" className="text-sm text-slate-600 mb-6">
                        {message}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors ${styles.confirmBg}`}
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
