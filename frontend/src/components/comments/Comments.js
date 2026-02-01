import React, { useContext, useEffect, useState, useCallback } from 'react';
import { DataContext } from '../../context/DataContext';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { FaDownload, FaFileAlt, FaFilePdf, FaPlus, FaTimes } from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import { getImageUrl, getFileInfo, getAvatarColor, getAvatarInitials } from '../../util/helpers';

const CommentSchema = Yup.object().shape({
    content: Yup.string().required('Comment cannot be empty'),
});

// Preview Modal Component
const PreviewModal = ({ preview, onClose }) => {
    const [isVisible, setIsVisible] = React.useState(false);

    React.useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const handleClose = React.useCallback(() => {
        setIsVisible(false);
        setTimeout(onClose, 200);
    }, [onClose]);

    if (!preview) return null;

    return (
        <div
            className={`fixed inset-0 bg-black/50 flex justify-center items-center z-[80] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleClose}
        >
            <div className={`relative bg-white rounded-xl shadow-2xl max-w-[90vw] max-h-[90vh] overflow-hidden transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
                    <h3 className="text-sm font-semibold text-slate-900 truncate max-w-md">{preview.fileName}</h3>
                    <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Close">
                        <FaTimes className="text-slate-500" />
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
                    <a
                        href={preview.url}
                        download={preview.fileName}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-semibold"
                    >
                        <FaDownload className="text-xs" /> Download
                    </a>
                </div>
            </div>
        </div>
    );
};

export default function Comments({ taskId, currentUserId }) {
    const { getComments, createComment, updateComment, deleteComment, reactToComment } = useContext(DataContext);

    const [comments, setComments] = useState([]);
    const [editingComment, setEditingComment] = useState(null);
    const [replyingCommentId, setReplyingCommentId] = useState(null);
    const [newAttachments, setNewAttachments] = useState([]);
    const [showCommentForm, setShowCommentForm] = useState(false);
    const [hoveredReaction, setHoveredReaction] = useState(null);
    const [preview, setPreview] = useState(null);

    const fetchComments = useCallback(async () => {
        try {
            const fetched = await getComments(taskId);
            const sorted = fetched.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setComments(sorted);
        } catch (error) {
            console.error('Error fetching comments:', error);
        }
    }, [taskId, getComments]);

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            if (mounted) await fetchComments();
        };

        load();
        return () => { mounted = false; };
    }, [fetchComments]);

    const handleAddComment = async (values, { resetForm, setSubmitting }, parentCommentId = null) => {
        try {
            await createComment(taskId, { content: values.content }, newAttachments, parentCommentId);
            await fetchComments();
            resetForm();
            setNewAttachments([]);
            if (parentCommentId) setReplyingCommentId(null);
            setShowCommentForm(false);
        } catch (error) {
            console.error('Error adding comment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateComment = async (comment, values, { setSubmitting }) => {
        try {
            await updateComment(taskId, comment.id, { content: values.content }, newAttachments);
            await fetchComments();
            setEditingComment(null);
            setNewAttachments([]);
        } catch (error) {
            console.error('Error updating comment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('Are you sure you want to delete this comment?')) return;
        try {
            await deleteComment(taskId, commentId);
            await fetchComments();
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    const handleReactToComment = async (commentId, reactionType) => {
        try {
            await reactToComment(taskId, commentId, reactionType);
            await fetchComments();
        } catch (error) {
            console.error('Error reacting to comment:', error);
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
                        ? { ...c, attachments: c.attachments.filter(att => att !== attachment) }
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

    const renderAttachmentPreview = (attachment, isExisting, idx, commentId = null) => {
        const { url, fileName, fileType } = getFileInfo(attachment);

        return (
            <div key={`${fileName}-${idx}`} className="relative group cursor-pointer" onClick={() => openPreview(attachment)}>
                {fileType === 'image' ? (
                    <img src={url} alt={fileName} className="h-10 w-10 object-cover rounded border border-slate-200 hover:border-slate-300 transition-colors" />
                ) : fileType === 'pdf' ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-slate-200 hover:border-slate-300 transition-colors">
                        <FaFilePdf className="text-red-500 text-[10px]" />
                        <span className="text-[10px] text-slate-600 truncate max-w-[60px]">{fileName}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-slate-200 hover:border-slate-300 transition-colors">
                        <FaFileAlt className="text-slate-400 text-[10px]" />
                        <span className="text-[10px] text-slate-600 truncate max-w-[60px]">{fileName}</span>
                    </div>
                )}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveAttachment(attachment, isExisting, commentId); }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-slate-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove"
                >
                    <FaTimes size={6} />
                </button>
            </div>
        );
    };

    const CommentForm = ({ onSubmit, initialContent = '', buttonText, onCancel, commentId = null }) => (
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
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-1 focus:ring-slate-400 focus:border-slate-400 focus:outline-none transition-all resize-none placeholder-slate-400"
                        placeholder={buttonText === 'Reply' ? 'Write a reply...' : 'Write your comment...'}
                    />
                    <ErrorMessage name="content" component="div" className="text-red-500 text-xs" />

                    <div className="flex items-center justify-between">
                        {/* Attachments */}
                        <div className="flex items-center gap-1.5">
                            {newAttachments.map((f, idx) => renderAttachmentPreview(f, false, idx))}
                            <label className="cursor-pointer flex items-center justify-center w-7 h-7 bg-slate-100 rounded hover:bg-slate-200 transition-colors" title="Add attachment">
                                <FaPlus className="text-slate-400 text-[10px]" />
                                <input type="file" multiple onChange={handleAddNewAttachments} className="hidden" />
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={isSubmitting} className="px-3 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-xs font-medium disabled:opacity-50">
                                {isSubmitting ? '...' : buttonText}
                            </button>
                        </div>
                    </div>
                </Form>
            )}
        </Formik>
    );

    const CommentItem = ({ comment, level = 0 }) => {
        const [isVisible, setIsVisible] = React.useState(false);

        React.useEffect(() => {
            requestAnimationFrame(() => setIsVisible(true));
        }, []);

        const isOwner = comment.authorId === currentUserId;

        return (
            <div className={`${level > 0 ? 'ml-6 mt-2' : 'mt-2'} transition-all duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex gap-2.5">
                    {/* Avatar */}
                    {comment.authorProfilePicture ? (
                        <img src={getImageUrl(comment.authorProfilePicture)} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                        <div className={`h-7 w-7 bg-gradient-to-br ${getAvatarColor({ firstname: comment.authorName?.split(' ')[0], lastname: comment.authorName?.split(' ')[1] })} rounded-full flex items-center justify-center flex-shrink-0`}>
                            <span className="text-[10px] font-semibold text-white">
                                {getAvatarInitials({ firstname: comment.authorName?.split(' ')[0], lastname: comment.authorName?.split(' ')[1] })}
                            </span>
                        </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {editingComment?.id === comment.id ? (
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <CommentForm
                                    onSubmit={(values, actions) => handleUpdateComment(comment, values, actions)}
                                    initialContent={comment.content}
                                    buttonText="Update"
                                    onCancel={() => { setEditingComment(null); setNewAttachments([]); }}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="bg-slate-50 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-medium text-slate-900 text-sm">{comment.authorName}</span>
                                        <span className="text-[11px] text-slate-400" title={new Date(comment.timestamp).toLocaleString()}>
                                            {formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}
                                        </span>
                                        {comment.editedAt && <span className="text-[10px] text-slate-400">(edited)</span>}
                                    </div>
                                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</div>

                                    {/* Attachments inline */}
                                    {comment.attachments?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {comment.attachments.map((a, idx) => renderAttachmentPreview(a, true, idx, comment.id))}
                                        </div>
                                    )}
                                </div>

                                {/* Actions row */}
                                <div className="flex items-center gap-3 mt-1 ml-1">
                                    <button
                                        onClick={() => handleReactToComment(comment.id, 'LIKE')}
                                        className={`flex items-center gap-1 text-xs transition-colors ${
                                            comment.likedByCurrentUser ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                        disabled={comment.likedByCurrentUser || comment.dislikedByCurrentUser}
                                    >
                                        <svg className="w-3.5 h-3.5" fill={comment.likedByCurrentUser ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                        </svg>
                                        {comment.likeCount > 0 && comment.likeCount}
                                    </button>
                                    <button
                                        onClick={() => handleReactToComment(comment.id, 'DISLIKE')}
                                        className={`flex items-center gap-1 text-xs transition-colors ${
                                            comment.dislikedByCurrentUser ? 'text-red-500 font-medium' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                        disabled={comment.likedByCurrentUser || comment.dislikedByCurrentUser}
                                    >
                                        <svg className="w-3.5 h-3.5" fill={comment.dislikedByCurrentUser ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                                        </svg>
                                        {comment.dislikeCount > 0 && comment.dislikeCount}
                                    </button>
                                    <button
                                        onClick={() => setReplyingCommentId(comment.id)}
                                        className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
                                    >
                                        Reply
                                    </button>
                                    {isOwner && (
                                        <>
                                            <button onClick={() => setEditingComment(comment)} className="text-xs text-slate-500 hover:text-slate-700 transition-colors">Edit</button>
                                            <button onClick={() => handleDeleteComment(comment.id)} className="text-xs text-slate-500 hover:text-red-500 transition-colors">Delete</button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Reply form */}
                        {replyingCommentId === comment.id && (
                            <div className="mt-2">
                                <CommentForm
                                    onSubmit={(values, actions) => handleAddComment(values, actions, comment.id)}
                                    buttonText="Reply"
                                    onCancel={() => { setReplyingCommentId(null); setNewAttachments([]); }}
                                />
                            </div>
                        )}

                        {/* Nested replies */}
                        {comment.replies?.map(reply => (
                            <CommentItem key={reply.id} comment={reply} level={level + 1} />
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Comments</h3>
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {comments.length}
                    </span>
                </div>
                {!showCommentForm && (
                    <button
                        onClick={() => setShowCommentForm(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-xs font-medium"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add
                    </button>
                )}
            </div>

            {/* New Comment Form */}
            {showCommentForm && (
                <div className="mb-3">
                    <CommentForm
                        onSubmit={(values, actions) => handleAddComment(values, actions, null)}
                        buttonText="Post"
                        onCancel={() => { setShowCommentForm(false); setNewAttachments([]); }}
                    />
                </div>
            )}

            {/* Comments List */}
            {comments.length > 0 ? (
                <div>
                    {comments.map(comment => (
                        <CommentItem key={comment.id} comment={comment} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-6 bg-slate-50 rounded-lg">
                    <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-xs text-slate-500">No comments yet</p>
                </div>
            )}

            {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
        </div>
    );
}
