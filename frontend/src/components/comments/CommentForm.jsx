import React, { useState } from 'react';
import { ErrorMessage, Field, Form, Formik } from 'formik';
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
                        className={
                            'h-10 w-10 object-cover rounded border'
                            + ' border-slate-200 hover:border-slate-300 transition-colors'
                        }
                    />
                ) : fileType === 'pdf' ? (
                    <div
                        className={
                            'flex items-center gap-1.5 px-2 py-1 bg-white rounded'
                            + ' border border-slate-200 hover:border-slate-300'
                            + ' transition-colors'
                        }
                    >
                        <HiOutlineDocumentText className="w-3 h-3 text-red-500" />
                        <span className="text-[10px] text-slate-600 truncate max-w-[60px]">
                            {fileName}
                        </span>
                    </div>
                ) : (
                    <div
                        className={
                            'flex items-center gap-1.5 px-2 py-1 bg-white rounded'
                            + ' border border-slate-200 hover:border-slate-300'
                            + ' transition-colors'
                        }
                    >
                        <HiOutlineDocument className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] text-slate-600 truncate max-w-[60px]">
                            {fileName}
                        </span>
                    </div>
                )}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveLocalAttachment(attachment);
                    }}
                    className={
                        'absolute -top-1 -right-1 w-4 h-4 bg-slate-700 text-white'
                        + ' rounded-full flex items-center justify-center opacity-0'
                        + ' group-hover:opacity-100 transition-opacity'
                    }
                    title="Remove"
                >
                    <HiOutlineX className="w-2.5 h-2.5" />
                </button>
            </div>
        );
    };

    const handleFormSubmit = (values, actions) => {
        onSubmit(values, actions, localAttachments);
    };

    return (
        <Formik
            initialValues={{ content: initialContent }}
            validationSchema={CommentSchema}
            onSubmit={handleFormSubmit}
        >
            {({ isSubmitting }) => (
                <Form className="space-y-2">
                    <Field
                        as="textarea"
                        name="content"
                        rows={2}
                        className={
                            'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg'
                            + ' text-sm text-slate-700 focus:ring-1 focus:ring-slate-400'
                            + ' focus:border-slate-400 focus:outline-none transition-all'
                            + ' resize-none placeholder-slate-400'
                        }
                        placeholder={
                            buttonText === 'Reply'
                                ? 'Write a reply...'
                                : 'Write your comment...'
                        }
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
                                className={
                                    'cursor-pointer flex items-center justify-center w-7 h-7'
                                    + ' bg-slate-100 rounded hover:bg-slate-200 transition-colors'
                                }
                                title="Add attachment"
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

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onCancel}
                                className={
                                    'px-3 py-1.5 text-xs font-medium text-slate-500'
                                    + ' hover:text-slate-700 transition-colors'
                                }
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={
                                    'px-3 py-1.5 bg-slate-900 text-white rounded-lg'
                                    + ' hover:bg-slate-800 transition-colors text-xs'
                                    + ' font-medium disabled:opacity-50'
                                }
                            >
                                {isSubmitting ? '...' : buttonText}
                            </button>
                        </div>
                    </div>
                </Form>
            )}
        </Formik>
    );
};

export default CommentForm;
