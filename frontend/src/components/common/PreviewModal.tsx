import React, { useCallback, useEffect, useRef } from 'react';
import { HiOutlineDocument, HiOutlineDocumentText, HiOutlineDownload, HiOutlineX } from 'react-icons/hi';
import { useAnimateIn } from '../../hooks/useAnimateIn';
import { PreviewData } from '../../util/helpers';
import { trapFocus } from './focusTrap';

interface PreviewModalProps {
    preview: PreviewData | null;
    onClose: () => void;
}

const PreviewModal = ({ preview, onClose }: PreviewModalProps) => {
    const [isVisible, setIsVisible] = useAnimateIn();

    const dialogRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        dialogRef.current?.focus();
        return () => {
            previousFocusRef.current?.focus();
        };
    }, []);

    const handleClose = useCallback(() => {
        setIsVisible(false);
        closeTimerRef.current = setTimeout(onClose, 300);
    }, [onClose, setIsVisible]);

    useEffect(() => () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    }, []);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                handleClose();
                return;
            }
            if (dialogRef.current) trapFocus(dialogRef.current, e);
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [handleClose]);

    if (!preview || !preview.url) return null;

    return (
        <div
            ref={dialogRef}
            tabIndex={-1}
            className={`fixed inset-0 bg-black/50 flex justify-center items-center z-[80] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleClose}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview: ${preview.fileName}`}
        >
            <div className={`relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-[90vw] max-h-[90vh] overflow-hidden transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-md">{preview.fileName}</h3>
                    <button onClick={handleClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Close" aria-label="Close">
                        <HiOutlineX className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </button>
                </div>
                <div className="p-5 bg-slate-50 dark:bg-slate-900">
                    {preview.fileType === 'image' ? (
                        <img src={preview.url} alt={preview.fileName} className="max-h-[70vh] max-w-full rounded-lg shadow-lg" />
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-3 min-w-[20rem] px-10 py-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                            {preview.fileType === 'pdf'
                                ? <HiOutlineDocumentText className="w-10 h-10 text-red-500" />
                                : <HiOutlineDocument className="w-10 h-10 text-slate-400" />}
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 text-center break-all">{preview.fileName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                                This file can&apos;t be previewed inline — use Download below to view it.
                            </p>
                        </div>
                    )}
                </div>
                <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end bg-white dark:bg-slate-800">
                    <a
                        href={preview.url}
                        download={preview.fileName}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors text-sm font-medium"
                    >
                        <HiOutlineDownload className="w-4 h-4" /> Download
                    </a>
                </div>
            </div>
        </div>
    );
};

export default PreviewModal;
