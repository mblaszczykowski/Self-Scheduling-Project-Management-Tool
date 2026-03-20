import React, { useState } from 'react';
import { HiOutlineCloudUpload } from 'react-icons/hi';
import { getFileInfo } from '../../util/helpers';
import { showToast } from '../../util/toast';
import PreviewModal from '../common/PreviewModal';
import AttachmentThumbnail from '../common/AttachmentThumbnail';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
            if (file.size > MAX_FILE_SIZE) {
                showToast(`File "${file.name}" exceeds 5MB limit`);
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
                className={`border-2 border-dashed rounded-xl p-4 transition-all ${
                    isDragging
                        ? 'border-slate-400 bg-slate-50/50'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
                }`}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
            >
                {hasAttachments && (
                    <div className="flex flex-wrap gap-3 mb-4">
                        {existingAttachments.map(a => renderAttachmentPreview(a))}
                        {newAttachments.map(f => renderAttachmentPreview(f))}
                    </div>
                )}
                <label htmlFor={inputId} className="cursor-pointer flex flex-col items-center justify-center py-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center mb-2">
                        <HiOutlineCloudUpload className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">{label}</span>
                    <span className="text-xs text-slate-400 mt-0.5">Images, PDFs, documents (max 5MB)</span>
                    <input
                        type="file"
                        id={inputId}
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </label>
            </div>
            {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
        </>
    );
};

export default AttachmentUploader;
