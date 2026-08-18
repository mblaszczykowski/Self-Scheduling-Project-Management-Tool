import React from 'react';
import { ErrorMessage, Field } from 'formik';
import RichTextEditor from '../common/RichTextEditor';
import AttachmentUploader from './AttachmentUploader';
import { Attachment } from '../../types';

interface EntityMainColumnProps {
    values: { summary?: string; description?: string };
    setFieldValue: (field: string, value: unknown, shouldValidate?: boolean) => void;
    entityKey?: string | null;
    namePlaceholder?: string;
    descPlaceholder?: string;
    attachmentInputId?: string;
    existingAttachments?: string[];
    newAttachments?: File[];
    onAddAttachments?: (files: File[]) => void;
    onRemoveAttachment?: (attachment: Attachment) => void;
}

// Shared left column for the task and project forms: entity-key chip + name
// field + character counter + description editor + attachment uploader.
const EntityMainColumn = ({
    values,
    setFieldValue,
    entityKey,
    namePlaceholder,
    descPlaceholder,
    attachmentInputId,
    existingAttachments,
    newAttachments,
    onAddAttachments,
    onRemoveAttachment,
}: EntityMainColumnProps) => (
    <>
        <div className="mb-6">
            <div className="flex items-center gap-2.5">
                {entityKey && (
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md text-xs font-mono font-semibold tracking-wide shrink-0">
                        {entityKey}
                    </span>
                )}
                <Field
                    type="text" id="summary" name="summary" maxLength={200}
                    placeholder={namePlaceholder}
                    className="flex-1 px-0 py-1 bg-transparent border-0 text-lg font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none transition-colors"
                />
            </div>
            <div className="flex justify-between mt-1.5">
                <ErrorMessage name="summary" component="div" className="text-red-500 text-xs" />
                {(values.summary?.length ?? 0) > 160 && (
                    <span className={`text-xs tabular-nums ${(values.summary?.length ?? 0) > 180 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {values.summary?.length ?? 0}/200
                    </span>
                )}
            </div>
        </div>

        <div className="mb-6">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Description</span>
            <RichTextEditor
                value={values.description || ''} onChange={val => setFieldValue('description', val)}
                placeholder={descPlaceholder} minHeight="200px"
            />
        </div>

        <div className="mb-6">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Attachments</span>
            <AttachmentUploader
                existingAttachments={existingAttachments} newAttachments={newAttachments}
                onAddAttachments={onAddAttachments} onRemoveAttachment={onRemoveAttachment}
                inputId={attachmentInputId}
            />
        </div>
    </>
);

export default EntityMainColumn;
