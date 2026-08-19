import React, { useState, useEffect, useRef } from 'react';
import { HiOutlineCloudUpload } from 'react-icons/hi';
import { getFileInfo, revokeFileUrl, FileInfo } from '../../util/helpers';
import { showToast } from '../../util/toast';
import PreviewModal from '../common/PreviewModal';
import AttachmentThumbnail from '../common/AttachmentThumbnail';
import { Attachment } from '../../types';
import {
    ATTACHMENT_ACCEPT, MAX_ATTACHMENTS_PER_REQUEST, MAX_FILE_SIZE_LABEL,
    getAttachmentCountError, getFileValidationError, getTotalAttachmentSizeError,
} from '../../util/fileValidation';

interface AttachmentUploaderProps {
    existingAttachments?: string[];
    newAttachments?: File[];
    onAddAttachments?: (files: File[]) => void;
    onRemoveAttachment?: (attachment: Attachment) => void;
    inputId?: string;
    label?: string;
}

const AttachmentUploader = ({
    existingAttachments = [],
    newAttachments = [],
    onAddAttachments,
    onRemoveAttachment,
    inputId = 'attachment-upload',
    label = 'Drop files or click to upload'
}: AttachmentUploaderProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [preview, setPreview] = useState<FileInfo | null>(null);

    const newAttachmentsRef = useRef(newAttachments);
    newAttachmentsRef.current = newAttachments;
    useEffect(() => () => {
        newAttachmentsRef.current.forEach(revokeFileUrl);
    }, []);

    const validateAndAdd = (files: File[]) => {
        if (files.length === 0) return;
        const countError = getAttachmentCountError(existingAttachments.length + newAttachments.length, files.length);
        if (countError) {
            showToast(countError, 'error');
            return;
        }
        const valid: File[] = [];
        for (const file of files) {
            const validationError = getFileValidationError(file);
            if (validationError) {
                showToast(validationError, 'error');
            } else {
                valid.push(file);
            }
        }
        if (valid.length === 0) return;
        const sizeError = getTotalAttachmentSizeError(newAttachments, valid);
        if (sizeError) {
            showToast(sizeError, 'error');
            return;
        }
        if (onAddAttachments) {
            onAddAttachments(valid);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        validateAndAdd(Array.from(e.dataTransfer.files));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        validateAndAdd(Array.from(e.target.files ?? []));
    };

    const openPreview = (attachment: Attachment) => {
        setPreview(getFileInfo(attachment));
    };

    const renderAttachmentPreview = (attachment: Attachment) => (
        <AttachmentThumbnail
            key={getFileInfo(attachment).url}
            attachment={attachment}
            onRemove={onRemoveAttachment}
            onClick={openPreview}
        />
    );

    const hasAttachments = existingAttachments.length > 0 || newAttachments.length > 0;

    return (
        <>
            <div
                className={`border-2 border-dashed rounded-xl transition-colors ${
                    isDragging
                        ? 'border-blue-400 dark:border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
            >
                {hasAttachments && (
                    <div className="flex flex-wrap gap-2 p-3 pb-0">
                        {existingAttachments.map(a => renderAttachmentPreview(a))}
                        {newAttachments.map(f => renderAttachmentPreview(f))}
                    </div>
                )}
                {/* sr-only rather than hidden below: display:none takes the input out of the tab
                    order, which made uploading mouse-only. */}
                <label htmlFor={inputId} className="relative cursor-pointer flex flex-col items-center justify-center gap-1 py-5 px-3 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400">
                    <HiOutlineCloudUpload className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                    <span className="text-sm text-slate-400 dark:text-slate-500">{label}</span>
                    <span className="text-xs text-slate-300 dark:text-slate-600">Max {MAX_FILE_SIZE_LABEL} per file, up to {MAX_ATTACHMENTS_PER_REQUEST} files</span>
                    <input
                        type="file"
                        id={inputId}
                        multiple
                        onChange={handleFileChange}
                        accept={ATTACHMENT_ACCEPT}
                        className="sr-only"
                    />
                </label>
            </div>
            {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
        </>
    );
};

export default AttachmentUploader;
