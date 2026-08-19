import React, { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FormikHelpers } from 'formik';
import { useComments } from '../../hooks/useComments';
import { getFileInfo, getErrorMessage, PreviewData } from '../../util/helpers';
import { showToast } from '../../util/toast';
import PreviewModal from '../common/PreviewModal';
import AttachmentThumbnail from '../common/AttachmentThumbnail';
import EmptyState from '../common/EmptyState';
import ConfirmDialog from '../modals/ConfirmDialog';
import CommentItem from './CommentItem';
import CommentForm, { CommentFormValues } from './CommentForm';
import { Attachment, Comment, ReactionType } from '../../types';

export default function Comments({ taskId, currentUserId }: { taskId: number; currentUserId?: number }) {
    const location = useLocation();
    const highlightCommentId = new URLSearchParams(location.search).get('commentId');
    const {
        comments, loading, error, reload,
        addComment, editComment, removeComment, react,
    } = useComments(taskId);

    const [editingComment, setEditingComment] = useState<Comment | null>(null);
    const [replyingCommentId, setReplyingCommentId] = useState<number | null>(null);
    const [showCommentForm, setShowCommentForm] = useState(false);
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    const handleAddComment = useCallback(async (
        values: CommentFormValues,
        { resetForm, setSubmitting }: FormikHelpers<CommentFormValues>,
        parentCommentId: number | null = null,
        attachments: File[] = [],
    ) => {
        try {
            await addComment(values.content, attachments, parentCommentId);
            resetForm();
            if (parentCommentId) setReplyingCommentId(null);
            setShowCommentForm(false);
        } catch (err) {
            showToast(getErrorMessage(err, 'Failed to add comment'), 'error');
        } finally {
            setSubmitting(false);
        }
    }, [addComment]);

    const handleUpdateComment = useCallback(async (comment: Comment, values: CommentFormValues, { setSubmitting }: FormikHelpers<CommentFormValues>, attachments: File[] = []) => {
        try {
            await editComment(comment.id, values.content, attachments);
            setEditingComment(null);
        } catch (err) {
            showToast(getErrorMessage(err, 'Failed to update comment'), 'error');
        } finally {
            setSubmitting(false);
        }
    }, [editComment]);

    const handleDeleteComment = useCallback((commentId: number) => {
        setDeleteConfirmId(commentId);
    }, []);

    const confirmDeleteComment = async () => {
        if (!deleteConfirmId) return;
        try {
            await removeComment(deleteConfirmId);
        } catch (err) {
            showToast(getErrorMessage(err, 'Failed to delete comment'), 'error');
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const handleReactToComment = useCallback(async (commentId: number, reactionType: ReactionType) => {
        try {
            await react(commentId, reactionType);
        } catch (err) {
            showToast(getErrorMessage(err, 'Could not save your reaction'), 'error');
        }
    }, [react]);

    const openPreview = useCallback((attachment: Attachment) => {
        const { url, fileName, fileType } = getFileInfo(attachment);
        setPreview({ url, fileName, fileType });
    }, []);

    const renderAttachmentPreview = useCallback((attachment: string, idx: number) => (
        <AttachmentThumbnail
            key={`${getFileInfo(attachment).fileName}-${idx}`}
            attachment={attachment}
            variant="compact"
            onClick={openPreview}
        />
    ), [openPreview]);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Comments
                    </span>
                    {comments.length > 0 && (
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md tabular-nums">
                            {comments.length}
                        </span>
                    )}
                </div>
                {!showCommentForm && (
                    <button
                        onClick={() => setShowCommentForm(true)}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                        Add comment
                    </button>
                )}
            </div>

            {showCommentForm && (
                <div className="mb-3">
                    <CommentForm
                        onSubmit={(values, actions, attachments) =>
                            handleAddComment(values, actions, null, attachments)
                        }
                        buttonText="Post"
                        onCancel={() => {
                            setShowCommentForm(false);
                        }}
                    />
                </div>
            )}

            {loading ? (
                <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 dark:border-slate-700 border-t-slate-500 dark:border-t-slate-400 mx-auto" />
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Loading comments...</p>
                </div>
            ) : error !== null ? (
                <div className="py-6 text-center">
                    <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
                    <button
                        onClick={reload}
                        className="mt-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            ) : comments.length > 0 ? (
                <div>
                    {comments.map(comment => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            currentUserId={currentUserId}
                            editingComment={editingComment}
                            replyingCommentId={replyingCommentId}
                            highlightCommentId={highlightCommentId ? Number(highlightCommentId) : null}
                            onSetEditingComment={setEditingComment}
                            onSetReplyingCommentId={setReplyingCommentId}
                            onHandleUpdateComment={handleUpdateComment}
                            onHandleAddComment={handleAddComment}
                            onHandleDeleteComment={handleDeleteComment}
                            onHandleReactToComment={handleReactToComment}
                            renderAttachmentPreview={renderAttachmentPreview}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState size="sm" title="No comments yet" />
            )}

            {preview && (
                <PreviewModal
                    preview={preview}
                    onClose={() => setPreview(null)}
                />
            )}

            <ConfirmDialog
                isOpen={deleteConfirmId !== null}
                onClose={() => setDeleteConfirmId(null)}
                onConfirm={confirmDeleteComment}
                title="Delete comment?"
                message="Are you sure? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />
        </div>
    );
}
