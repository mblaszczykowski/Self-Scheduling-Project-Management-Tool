import React, { useContext, useEffect, useState, useCallback } from 'react';
import { DataContext } from '../../context/DataContext';
import {
    HiOutlineDocument, HiOutlineDocumentText,
    HiOutlineX, HiOutlineChatAlt2,
} from 'react-icons/hi';
import { getFileInfo } from '../../util/helpers';
import PreviewModal from '../common/PreviewModal';
import ConfirmDialog from '../modals/ConfirmDialog';
import CommentItem from './CommentItem';
import CommentForm from './CommentForm';

export default function Comments({ taskId, currentUserId }) {
    const {
        getComments, createComment, updateComment,
        deleteComment, reactToComment,
    } = useContext(DataContext);

    const [comments, setComments] = useState([]);
    const [editingComment, setEditingComment] = useState(null);
    const [replyingCommentId, setReplyingCommentId] = useState(null);
    const [newAttachments, setNewAttachments] = useState([]);
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
        const abortController = new AbortController();
        let cancelled = false;
        const load = async () => {
            if (!cancelled) await fetchComments();
        };
        load();
        return () => {
            cancelled = true;
            abortController.abort();
        };
    }, [fetchComments]);

    const handleAddComment = async (
        values, { resetForm, setSubmitting }, parentCommentId = null,
    ) => {
        try {
            await createComment(
                taskId, { content: values.content },
                newAttachments, parentCommentId,
            );
            await fetchComments();
            resetForm();
            setNewAttachments([]);
            if (parentCommentId) setReplyingCommentId(null);
            setShowCommentForm(false);
        } catch (err) {
            console.error('Error adding comment:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateComment = async (comment, values, { setSubmitting }) => {
        try {
            await updateComment(
                taskId, comment.id,
                { content: values.content }, newAttachments,
            );
            await fetchComments();
            setEditingComment(null);
            setNewAttachments([]);
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

    const handleAddNewAttachments = (e) => {
        const files = Array.from(e.target.files);
        setNewAttachments(prev => [...prev, ...files]);
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
        } else {
            setNewAttachments(prev => prev.filter(file => file !== attachment));
        }
    };

    const openPreview = (attachment) => {
        const { url, fileName, fileType } = getFileInfo(attachment);
        setPreview({ url, fileName, fileType });
    };

    const renderAttachmentPreview = (
        attachment, isExisting, idx, commentId = null,
    ) => {
        const { url, fileName, fileType } = getFileInfo(attachment);

        return (
            <div
                key={`${fileName}-${idx}`}
                className="relative group cursor-pointer"
                onClick={() => openPreview(attachment)}
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
                        handleRemoveAttachment(attachment, isExisting, commentId);
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

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                        Comments
                    </h3>
                    <span
                        className={
                            'text-[11px] font-medium text-slate-500'
                            + ' bg-slate-100 px-1.5 py-0.5 rounded'
                        }
                    >
                        {comments.length}
                    </span>
                </div>
                {!showCommentForm && (
                    <button
                        onClick={() => setShowCommentForm(true)}
                        className={
                            'inline-flex items-center gap-1.5 px-3 py-1.5'
                            + ' bg-slate-900 text-white rounded-lg hover:bg-slate-800'
                            + ' transition-colors text-xs font-medium'
                        }
                    >
                        <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        Add
                    </button>
                )}
            </div>

            {showCommentForm && (
                <div className="mb-3">
                    <CommentForm
                        onSubmit={(values, actions) =>
                            handleAddComment(values, actions, null)
                        }
                        buttonText="Post"
                        onCancel={() => {
                            setShowCommentForm(false);
                            setNewAttachments([]);
                        }}
                        newAttachments={newAttachments}
                        onAddAttachments={handleAddNewAttachments}
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
                            newAttachments={newAttachments}
                            onSetEditingComment={setEditingComment}
                            onSetReplyingCommentId={setReplyingCommentId}
                            onSetNewAttachments={setNewAttachments}
                            onHandleUpdateComment={handleUpdateComment}
                            onHandleAddComment={handleAddComment}
                            onHandleDeleteComment={handleDeleteComment}
                            onHandleReactToComment={handleReactToComment}
                            onAddAttachments={handleAddNewAttachments}
                            renderAttachmentPreview={renderAttachmentPreview}
                            openPreview={openPreview}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-6 bg-slate-50 rounded-lg">
                    <HiOutlineChatAlt2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No comments yet</p>
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
                title="Delete Comment?"
                message="Are you sure you want to delete this comment? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />
        </div>
    );
}
