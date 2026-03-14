import React from 'react';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { HiOutlinePlus } from 'react-icons/hi';

const CommentSchema = Yup.object().shape({
    content: Yup.string().required('Comment cannot be empty'),
});

const CommentForm = ({
    onSubmit,
    initialContent = '',
    buttonText,
    onCancel,
    newAttachments,
    onAddAttachments,
    renderAttachmentPreview,
}) => (
    <Formik
        initialValues={{ content: initialContent }}
        validationSchema={CommentSchema}
        onSubmit={onSubmit}
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
                        {newAttachments.map((f, idx) =>
                            renderAttachmentPreview(f, false, idx)
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
                                onChange={onAddAttachments}
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

export default CommentForm;
