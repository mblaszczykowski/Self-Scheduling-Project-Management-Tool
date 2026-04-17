import React, { useState } from 'react';
import { ErrorMessage, Field, Formik } from 'formik';
import * as Yup from 'yup';
import { HiOutlinePlus, HiOutlineX, HiOutlineDocument, HiOutlineDocumentText } from 'react-icons/hi';
import { getFileInfo } from '../../util/helpers';

const CommentSchema = Yup.object().shape({
    content: Yup.string().required('Comment cannot be empty'),
});

const CommentForm = ({
    onSubmit,
    initialContent = '',
    buttonText,
    onCancel,
    renderAttachmentPreview,
}) => {
    const [localAttachments, setLocalAttachments] = useState([]);

    const handleAddLocalAttachments = (e) => {
        const files = Array.from(e.target.files);
        setLocalAttachments(prev => [...prev, ...files]);
    };

    const handleRemoveLocalAttachment = (attachment) => {
        setLocalAttachments(prev => prev.filter(f => f !== attachment));
    };

    const renderLocalAttachmentPreview = (attachment, idx) => {
        const { url, fileName, fileType } = getFileInfo(attachment);

        return (
            <div
                key={`${fileName}-${idx}`}
                className="relative group cursor-pointer"
            >
                {fileType === 'image' ? (
                    <img
                        src={url}
                        alt={fileName}
                        className="h-8 w-8 object-cover rounded border border-slate-200 dark:border-slate-700 hover:border-slate-300 transition-colors"
                    />
                ) : fileType === 'pdf' ? (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 hover:border-slate-300 transition-colors">
                        <HiOutlineDocumentText className="w-2.5 h-2.5 text-red-500" />
                        <span className="text-xs text-slate-500 truncate max-w-[50px]">{fileName}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 hover:border-slate-300 transition-colors">
                        <HiOutlineDocument className="w-2.5 h-2.5 text-slate-400" />
                        <span className="text-xs text-slate-500 truncate max-w-[50px]">{fileName}</span>
                    </div>
                )}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveLocalAttachment(attachment);
                    }}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-slate-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove"
                >
                    <HiOutlineX className="w-2 h-2" />
                </button>
            </div>
        );
    };

    const handleFormSubmit = (values, actions) => {
        onSubmit(values, actions, localAttachments);
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
                    <Field
                        as="textarea"
                        name="content"
                        rows={2}
                        className={
                            'w-full px-3 py-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
                            + ' rounded-lg text-sm text-slate-700 dark:text-slate-200'
                            + ' focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500'
                            + ' focus:border-slate-400 dark:focus:border-slate-500 focus:outline-none'
                            + ' transition-colors resize-none placeholder-slate-400 dark:placeholder-slate-500'
                        }
                        placeholder={
                            buttonText === 'Reply'
                                ? 'Write a reply...'
                                : 'Write a comment...'
                        }
                        onKeyDown={(e) => {
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
                            {localAttachments.map((f, idx) =>
                                renderLocalAttachmentPreview(f, idx)
                            )}
                            <label
                                className="cursor-pointer flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Attach file"
                            >
                                <HiOutlinePlus className="w-3 h-3 text-slate-400" />
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleAddLocalAttachments}
                                    className="hidden"
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
                                onClick={formikSubmit}
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
