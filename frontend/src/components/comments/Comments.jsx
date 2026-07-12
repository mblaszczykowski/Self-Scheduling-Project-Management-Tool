import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useComments } from '../../hooks/useComments';
import { getFileInfo, getErrorMessage } from '../../util/helpers';
import { showToast } from '../../util/toast';
import PreviewModal from '../common/PreviewModal';
import AttachmentThumbnail from '../common/AttachmentThumbnail';
import ConfirmDialog from '../modals/ConfirmDialog';
import CommentItem from './CommentItem';
import CommentForm from './CommentForm';

export default function Comments({ taskId, currentUserId }) {
    const location = useLocation();
    const highlightCommentId = new URLSearchParams(location.search).get('commentId');
    const {
        getComments, createComment, updateComment,
        deleteComment, reactToComment,
    } = useComments();

    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [editingComment, setEditingComment] = useState(null);
    const [replyingCommentId, setReplyingCommentId] = useState(null);
    const [showCommentForm, setShowCommentForm] = useState(false);
    const [preview, setPreview] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    // Latest-request token: incremented per fetch so a slow, stale response for a
    // previous taskId can't clobber the results of a newer request.
    const requestIdRef = useRef(0);

    const fetchComments = useCallback(async ({ showLoading = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (showLoading) {
            setLoading(true);
            setError(false);
        }
        try {
            const fetched = await getComments(taskId);
            if (requestId !== requestIdRef.current) return;
            const sorted = [...fetched].sort(
                (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
            );
            setComments(sorted);
            if (showLoading) setLoading(false);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error('Error fetching comments:', err);
            if (showLoading) {
                setError(true);
                setLoading(false);
            }
        }
    }, [taskId, getComments]);

    useEffect(() => {
        fetchComments({ showLoading: true });
    }, [fetchComments]);

    const handleAddComment = useCallback(async (
        values, { resetForm, setSubmitting }, parentCommentId = null, attachments = [],
    ) => {
        try {
            await createComment(
                taskId, { content: values.content },
                attachments, parentCommentId,
            );
            await fetchComments();
            resetForm();
            if (parentCommentId) setReplyingCommentId(null);
            setShowCommentForm(false);
        } catch (err) {
            showToast(getErrorMessage(err, 'Failed to add comment'), 'error');
        } finally {
            setSubmitting(false);
        }
    }, [taskId, createComment, fetchComments]);

    const handleUpdateComment = useCallback(async (comment, values, { setSubmitting }, attachments = []) => {
        try {
            await updateComment(
                taskId, comment.id,
                { content: values.content }, attachments,
            );
            await fetchComments();
            setEditingComment(null);
        } catch (err) {
            showToast(getErrorMessage(err, 'Failed to update comment'), 'error');
        } finally {
            setSubmitting(false);
        }
    }, [taskId, updateComment, fetchComments]);

    const handleDeleteComment = useCallback((commentId) => {
        setDeleteConfirmId(commentId);
    }, []);

    const confirmDeleteComment = async () => {
        if (!deleteConfirmId) return;
        try {
            await deleteComment(taskId, deleteConfirmId);
            await fetchComments();
        } catch (err) {
            showToast(getErrorMessage(err, 'Failed to delete comment'), 'error');
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const handleReactToComment = useCallback(async (commentId, reactionType) => {
        try {
            await reactToComment(taskId, commentId, reactionType);
            await fetchComments();
        } catch (err) {
            showToast(getErrorMessage(err, 'Failed to react'), 'error');
        }
    }, [taskId, reactToComment, fetchComments]);

    const openPreview = useCallback((attachment) => {
        const { url, fileName, fileType } = getFileInfo(attachment);
        setPreview({ url, fileName, fileType });
    }, []);

    // Read-only preview of a comment's persisted attachments. No remove control
    // is rendered here: posted attachments can't be removed in place (that never
    // persisted), and newly-added files are managed inside CommentForm instead.
    const renderAttachmentPreview = useCallback((attachment, idx) => (
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
            ) : error ? (
                <div className="py-6 text-center">
                    <p className="text-xs text-red-500 dark:text-red-400">Failed to load comments</p>
                    <button
                        onClick={() => fetchComments({ showLoading: true })}
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
                <div className="py-6 text-center">
                    <p className="text-xs text-slate-300 dark:text-slate-600">No comments yet</p>
                </div>
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
