import React, { useState } from 'react';
import { HiOutlineCloudUpload } from 'react-icons/hi';
import { getFileInfo } from '../../util/helpers';
import { showToast } from '../../util/toast';
import PreviewModal from '../common/PreviewModal';
import AttachmentThumbnail from '../common/AttachmentThumbnail';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'rar', '7z'];

const AttachmentUploader = ({
    existingAttachments = [],
    newAttachments = [],
    onAddAttachments,
    onRemoveAttachment,
    inputId = 'attachment-upload',
    label = 'Drop files or click to upload'
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [preview, setPreview] = useState(null);

    const validateAndAdd = (files) => {
        const valid = [];
        for (const file of files) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
                showToast(`File "${file.name}" has an unsupported file type`, 'error');
            } else if (file.size > MAX_FILE_SIZE) {
                showToast(`File "${file.name}" exceeds 5MB limit`, 'error');
            } else {
                valid.push(file);
            }
        }
        if (valid.length > 0 && onAddAttachments) {
            onAddAttachments(valid);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        validateAndAdd(Array.from(e.dataTransfer.files));
    };

    const handleFileChange = (e) => {
        validateAndAdd(Array.from(e.target.files));
    };

    const openPreview = (attachment) => {
        const { url, fileName, fileType } = getFileInfo(attachment);
        setPreview({ url, fileName, fileType });
    };

    const renderAttachmentPreview = (attachment) => (
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
                className={`border border-dashed rounded-md transition-colors ${
                    isDragging
                        ? 'border-slate-400 dark:border-indigo-500/50 bg-slate-50 dark:bg-indigo-950/10'
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
                <label htmlFor={inputId} className="cursor-pointer flex items-center justify-center gap-2 py-3 px-3">
                    <HiOutlineCloudUpload className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-[12px] text-slate-400 dark:text-slate-500">{label}</span>
                    <span className="text-[11px] text-slate-300 dark:text-slate-600">(max 5MB)</span>
                    <input
                        type="file"
                        id={inputId}
                        multiple
                        onChange={handleFileChange}
                        accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
                        className="hidden"
                    />
                </label>
            </div>
            {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
        </>
    );
};

export default AttachmentUploader;
