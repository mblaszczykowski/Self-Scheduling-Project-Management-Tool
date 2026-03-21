import React, { useContext, useEffect, useState, useCallback } from 'react';
import { ProjectsContext } from '../../context/ProjectsContext';
import { getFileInfo } from '../../util/helpers';
import PreviewModal from '../common/PreviewModal';
import AttachmentThumbnail from '../common/AttachmentThumbnail';
import ConfirmDialog from '../modals/ConfirmDialog';
import CommentItem from './CommentItem';
import CommentForm from './CommentForm';

export default function Comments({ taskId, currentUserId }) {
    const {
        getComments, createComment, updateComment,
        deleteComment, reactToComment,
    } = useContext(ProjectsContext);

    const [comments, setComments] = useState([]);
    const [editingComment, setEditingComment] = useState(null);
    const [replyingCommentId, setReplyingCommentId] = useState(null);
    const [showCommentForm, setShowCommentForm] = useState(false);
    const [preview, setPreview] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const fetchComments = useCallback(async () => {
        try {
            const fetched = await getComments(taskId);
            const sorted = fetched.sort(
                (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
            );
            setComments(sorted);
        } catch (err) {
            console.error('Error fetching comments:', err);
        }
    }, [taskId, getComments]);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            if (isMounted) await fetchComments();
        };
        load();
        return () => {
            isMounted = false;
        };
    }, [fetchComments]);

    const handleAddComment = async (
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
            console.error('Error adding comment:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateComment = async (comment, values, { setSubmitting }, attachments = []) => {
        try {
            await updateComment(
                taskId, comment.id,
                { content: values.content }, attachments,
            );
            await fetchComments();
            setEditingComment(null);
        } catch (err) {
            console.error('Error updating comment:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteComment = useCallback((commentId) => {
        setDeleteConfirmId(commentId);
    }, []);

    const confirmDeleteComment = async () => {
        if (!deleteConfirmId) return;
        try {
            await deleteComment(taskId, deleteConfirmId);
            await fetchComments();
        } catch (err) {
            console.error('Error deleting comment:', err);
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const handleReactToComment = async (commentId, reactionType) => {
        try {
            await reactToComment(taskId, commentId, reactionType);
            await fetchComments();
        } catch (err) {
            console.error('Error reacting to comment:', err);
        }
    };

    const handleRemoveAttachment = (attachment, isExisting, commentId = null) => {
        if (isExisting && commentId) {
            setComments(prev =>
                prev.map(c =>
                    c.id === commentId
                        ? {
                            ...c,
                            attachments: c.attachments.filter(
                                att => att !== attachment,
                            ),
                        }
                        : c
                )
            );
        }
    };

    const openPreview = (attachment) => {
        const { url, fileName, fileType } = getFileInfo(attachment);
        setPreview({ url, fileName, fileType });
    };

    const renderAttachmentPreview = (
        attachment, isExisting, idx, commentId = null,
    ) => (
        <AttachmentThumbnail
            key={`${getFileInfo(attachment).fileName}-${idx}`}
            attachment={attachment}
            variant="compact"
            idx={idx}
            onClick={openPreview}
            onRemove={(att) => handleRemoveAttachment(att, isExisting, commentId)}
        />
    );

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                        Comments
                    </span>
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                        {comments.length}
                    </span>
                </div>
                {!showCommentForm && (
                    <button
                        onClick={() => setShowCommentForm(true)}
                        className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                        + Add
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
                        renderAttachmentPreview={renderAttachmentPreview}
                    />
                </div>
            )}

            {comments.length > 0 ? (
                <div>
                    {comments.map(comment => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            currentUserId={currentUserId}
                            editingComment={editingComment}
                            replyingCommentId={replyingCommentId}
                            onSetEditingComment={setEditingComment}
                            onSetReplyingCommentId={setReplyingCommentId}
                            onHandleUpdateComment={handleUpdateComment}
                            onHandleAddComment={handleAddComment}
                            onHandleDeleteComment={handleDeleteComment}
                            onHandleReactToComment={handleReactToComment}
                            renderAttachmentPreview={renderAttachmentPreview}
                            openPreview={openPreview}
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
