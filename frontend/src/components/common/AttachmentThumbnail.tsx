import React from 'react';
import { HiOutlineDocument, HiOutlineDocumentText, HiOutlineX } from 'react-icons/hi';
import { getFileInfo } from '../../util/helpers';
import { Attachment } from '../../types';

interface AttachmentThumbnailProps {
    attachment: Attachment;
    onRemove?: (attachment: Attachment) => void;
    onClick?: (attachment: Attachment) => void;
    variant?: 'default' | 'compact';
}

const PreviewTarget = ({ fileName, className, onOpen, children }: {
    fileName: string;
    className: string;
    onOpen?: () => void;
    children: React.ReactNode;
}) => (
    onOpen
        ? (
            <button
                type="button"
                onClick={onOpen}
                aria-label={`Preview ${fileName}`}
                className={`${className} cursor-pointer text-left`}
            >
                {children}
            </button>
        )
        : <div className={className}>{children}</div>
);

const AttachmentThumbnail = ({
    attachment,
    onRemove,
    onClick,
    variant = 'default',
}: AttachmentThumbnailProps) => {
    const { url, fileName, fileType } = getFileInfo(attachment);
    if (!url) return null;

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRemove?.(attachment);
    };

    const handleOpen = onClick ? () => onClick(attachment) : undefined;

    if (variant === 'compact') {
        return (
            <div className="relative group">
                <PreviewTarget fileName={fileName} onOpen={handleOpen} className="block rounded">
                    {fileType === 'image' ? (
                        <img
                            src={url}
                            alt={fileName}
                            className={
                                'h-10 w-10 object-cover rounded border'
                                + ' border-slate-200 dark:border-slate-700 hover:border-slate-300 transition-colors'
                            }
                        />
                    ) : (
                        <div
                            className={
                                'flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-800 rounded'
                                + ' border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                + ' transition-colors'
                            }
                        >
                            {fileType === 'pdf'
                                ? <HiOutlineDocumentText className="w-3 h-3 text-red-500" />
                                : <HiOutlineDocument className="w-3 h-3 text-slate-400" />}
                            <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate max-w-[60px]">
                                {fileName}
                            </span>
                        </div>
                    )}
                </PreviewTarget>
                {onRemove && (
                    <button
                        type="button"
                        onClick={handleRemove}
                        className={
                            'absolute -top-1 -right-1 w-4 h-4 bg-slate-700 text-white'
                            + ' rounded-full flex items-center justify-center opacity-0'
                            + ' group-hover:opacity-100 focus-visible:opacity-100 transition-opacity'
                        }
                        aria-label={`Remove ${fileName}`}
                        title="Remove"
                    >
                        <HiOutlineX className="w-2.5 h-2.5" />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="relative group">
            {fileType === 'image' ? (
                <PreviewTarget fileName={fileName} onOpen={handleOpen}
                    className="relative block overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-400 transition-all hover:shadow-md">
                    <img src={url} alt={fileName} className="h-16 w-16 object-cover" />
                </PreviewTarget>
            ) : fileType === 'pdf' ? (
                <PreviewTarget fileName={fileName} onOpen={handleOpen}
                    className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:shadow-md hover:border-red-300 transition-all">
                    <HiOutlineDocumentText className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-slate-700 dark:text-slate-200 truncate max-w-[90px] font-medium">{fileName}</span>
                </PreviewTarget>
            ) : (
                <PreviewTarget fileName={fileName} onOpen={handleOpen}
                    className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-md hover:border-slate-300 transition-all">
                    <HiOutlineDocument className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-700 dark:text-slate-200 truncate max-w-[90px] font-medium">{fileName}</span>
                </PreviewTarget>
            )}
            {onRemove && (
                <button
                    type="button"
                    onClick={handleRemove}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all hover:bg-red-600 shadow-sm"
                    aria-label={`Remove ${fileName}`}
                    title="Remove"
                >
                    <HiOutlineX className="w-3 h-3" />
                </button>
            )}
        </div>
    );
};

export default React.memo(AttachmentThumbnail);
