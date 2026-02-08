import React, { useState } from 'react';
import { HiOutlineCloudUpload, HiOutlineDownload, HiOutlineDocument, HiOutlineDocumentText, HiOutlineX } from 'react-icons/hi';
import { getFileInfo } from '../../util/helpers';

/**
 * Preview modal for viewing attachments
 */
const PreviewModal = ({ preview, onClose }) => {
    if (!preview) return null;
    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[70]" onClick={onClose}>
            <div className="relative bg-white rounded-xl shadow-2xl max-w-[90vw] max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
                    <h3 className="text-sm font-semibold text-slate-900 truncate max-w-md">{preview.fileName}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Close">
                        <HiOutlineX className="w-5 h-5 text-slate-500" />
                    </button>
                </div>
                <div className="p-5 bg-slate-50">
                    {preview.fileType === 'image' ? (
                        <img src={preview.url} alt={preview.fileName} className="max-h-[70vh] max-w-full rounded-lg shadow-lg" />
                    ) : (
                        <iframe src={preview.url} title={preview.fileName} className="w-[80vw] h-[70vh] rounded-lg border border-slate-200" />
                    )}
                </div>
                <div className="px-5 py-4 border-t border-slate-200 flex justify-end bg-white">
                    <a href={preview.url} download={preview.fileName} className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-semibold">
                        <HiOutlineDownload className="w-4 h-4" /> Download
                    </a>
                </div>
            </div>
        </div>
    );
};

/**
 * Reusable attachment uploader component with drag & drop support
 *
 * @param {Array} existingAttachments - Already saved attachments (strings/objects)
 * @param {Array} newAttachments - New File objects to be uploaded
 * @param {function} onAddAttachments - Callback when files are added (receives File[])
 * @param {function} onRemoveAttachment - Callback when attachment is removed
 * @param {string} inputId - Unique ID for the file input element
 * @param {string} label - Optional label text
 */
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

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (onAddAttachments) {
            onAddAttachments(Array.from(e.dataTransfer.files));
        }
    };

    const handleFileChange = (e) => {
        if (onAddAttachments) {
            onAddAttachments(Array.from(e.target.files));
        }
    };

    const openPreview = (attachment) => {
        const { url, fileName, fileType } = getFileInfo(attachment);
        setPreview({ url, fileName, fileType });
    };

    const renderAttachmentPreview = (attachment) => {
        const { url, fileName, fileType } = getFileInfo(attachment);

        return (
            <div key={url} className="relative group">
                {fileType === 'image' ? (
                    <div
                        className="relative overflow-hidden rounded-lg border border-slate-200 hover:border-slate-400 transition-all hover:shadow-md cursor-pointer"
                        onClick={() => openPreview(attachment)}
                    >
                        <img src={url} alt={fileName} className="h-16 w-16 object-cover" />
                    </div>
                ) : fileName.toLowerCase().endsWith('.pdf') ? (
                    <div
                        className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:shadow-md hover:border-red-300 transition-all"
                        onClick={() => openPreview(attachment)}
                    >
                        <HiOutlineDocumentText className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-slate-700 truncate max-w-[90px] font-medium">{fileName}</span>
                    </div>
                ) : (
                    <div
                        className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:shadow-md hover:border-slate-300 transition-all"
                        onClick={() => openPreview(attachment)}
                    >
                        <HiOutlineDocument className="w-4 h-4 text-slate-500" />
                        <span className="text-xs text-slate-700 truncate max-w-[90px] font-medium">{fileName}</span>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => onRemoveAttachment && onRemoveAttachment(attachment)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-sm"
                >
                    <HiOutlineX className="w-3 h-3" />
                </button>
            </div>
        );
    };

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
                    <span className="text-xs text-slate-400 mt-0.5">Images, PDFs, documents</span>
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
