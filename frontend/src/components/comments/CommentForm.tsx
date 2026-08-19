import React, { useState, useEffect, useId, useRef } from 'react';
import { ErrorMessage, Field, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import { HiOutlinePlus } from 'react-icons/hi';
import { revokeFileUrl } from '../../util/helpers';
import { showToast } from '../../util/toast';
import AttachmentThumbnail from '../common/AttachmentThumbnail';
import { Attachment } from '../../types';
import { inputClass } from '../common/formHelpers';
import {
    ATTACHMENT_ACCEPT, getAttachmentCountError, getFileValidationError, getTotalAttachmentSizeError,
} from '../../util/fileValidation';

export interface CommentFormValues {
    content: string;
}

interface CommentFormProps {
    onSubmit: (values: CommentFormValues, actions: FormikHelpers<CommentFormValues>, attachments: File[]) => void;
    initialContent?: string;
    buttonText: string;
    onCancel: () => void;
}

const MAX_COMMENT_LENGTH = 10000;

const CommentSchema = Yup.object().shape({
    content: Yup.string().trim().required('Comment cannot be empty')
        .max(MAX_COMMENT_LENGTH, `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`),
});

const CommentForm = ({
    onSubmit,
    initialContent = '',
    buttonText,
    onCancel,
}: CommentFormProps) => {
    const textareaId = useId();
    const [localAttachments, setLocalAttachments] = useState<File[]>([]);

    const localAttachmentsRef = useRef(localAttachments);
    localAttachmentsRef.current = localAttachments;
    useEffect(() => () => {
        localAttachmentsRef.current.forEach(revokeFileUrl);
    }, []);

    const handleAddLocalAttachments = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length === 0) return;
        const countError = getAttachmentCountError(localAttachments.length, files.length);
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
        const sizeError = getTotalAttachmentSizeError(localAttachments, valid);
        if (sizeError) {
            showToast(sizeError, 'error');
            return;
        }
        setLocalAttachments(prev => [...prev, ...valid]);
    };

    const handleRemoveLocalAttachment = (attachment: Attachment) => {
        revokeFileUrl(attachment);
        setLocalAttachments(prev => prev.filter(f => f !== attachment));
    };

    const handleFormSubmit = (values: CommentFormValues, actions: FormikHelpers<CommentFormValues>) => {
        onSubmit(values, actions, localAttachments);
        localAttachments.forEach(revokeFileUrl);
        setLocalAttachments([]);
    };

    return (
        <Formik
            initialValues={{ content: initialContent }}
            validationSchema={CommentSchema}
            onSubmit={handleFormSubmit}
        >
            {({ isSubmitting, handleSubmit: formikSubmit }) => (
                <div className="space-y-1.5">
                    <label htmlFor={textareaId} className="sr-only">
                        {buttonText === 'Reply' ? 'Reply' : 'Comment'}
                    </label>
                    <Field
                        as="textarea"
                        id={textareaId}
                        name="content"
                        rows={2}
                        maxLength={MAX_COMMENT_LENGTH}
                        className={`${inputClass} resize-none`}
                        placeholder={
                            buttonText === 'Reply'
                                ? 'Write a reply...'
                                : 'Write a comment...'
                        }
                        onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                formikSubmit();
                            }
                        }}
                    />
                    <ErrorMessage
                        name="content"
                        component="div"
                        className="text-red-500 text-xs"
                    />

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            {localAttachments.map((file, idx) => (
                                <AttachmentThumbnail
                                    key={`${file.name}-${idx}`}
                                    attachment={file}
                                    variant="compact"
                                    onRemove={handleRemoveLocalAttachment}
                                />
                            ))}
                            {/* sr-only rather than hidden: display:none takes the input out of the
                                tab order, which made attaching a file mouse-only. The label shows
                                the focus the clipped input receives. */}
                            <label
                                className="relative cursor-pointer flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-400"
                                title="Attach file"
                            >
                                <HiOutlinePlus className="w-3 h-3 text-slate-400" />
                                <span className="sr-only">Attach file</span>
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleAddLocalAttachments}
                                    accept={ATTACHMENT_ACCEPT}
                                    className="sr-only"
                                />
                            </label>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => formikSubmit()}
                                className="px-3 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-40"
                            >
                                {isSubmitting ? '...' : buttonText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Formik>
    );
};

export default CommentForm;
