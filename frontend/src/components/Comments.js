import React, { useContext, useEffect, useState, useCallback } from 'react';
import { DataContext } from '../context/DataContext';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { FaDownload, FaFileAlt, FaFilePdf, FaPlus, FaTimes } from 'react-icons/fa';
import { MdAccountCircle, MdDelete, MdEdit, MdReply, MdThumbDown, MdThumbUp } from 'react-icons/md';
import { formatDistanceToNow } from 'date-fns';
import { getImageUrl, getFileInfo, getAvatarColor, getAvatarInitials } from '../util/helpers';

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
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[60] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleClose}
        >
            <div className={`relative bg-white rounded-xl shadow-2xl p-6 max-w-[90vw] max-h-[90vh] transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">{preview.fileName}</h3>
                    <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <FaTimes className="text-slate-500" />
                    </button>
                </div>
                {preview.fileType === 'image' ? (
                    <img src={preview.url} alt={preview.fileName} className="max-h-[70vh] max-w-full rounded-lg" />
                ) : (
                    <iframe src={preview.url} title={preview.fileName} className="w-[80vw] h-[70vh] rounded-lg border border-slate-200" />
                )}
                <div className="mt-4 flex justify-end">
<a
                    href={preview.url}
                    download={preview.fileName}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all text-sm font-medium"
                    >
                    <FaDownload /> Download
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
                    <img src={url} alt={fileName} className="h-20 w-auto object-cover rounded-lg shadow-sm hover:shadow-md transition-shadow" />
                ) : fileType === 'pdf' ? (
                    <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
                        <FaFilePdf className="text-red-500" />
                        <span className="text-sm text-slate-700 truncate max-w-[120px]">{fileName}</span>
                    </div>
                ) : (
                    <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
                        <FaFileAlt className="text-slate-500" />
                        <span className="text-sm text-slate-700 truncate max-w-[120px]">{fileName}</span>
                    </div>
                )}
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveAttachment(attachment, isExisting, commentId); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <FaTimes size={10} />
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
                <Form className="space-y-4">
                    <div>
                        <Field
                            as="textarea"
                            name="content"
                            rows={3}
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition-colors resize-none"
                            placeholder={buttonText === 'Reply' ? 'Write a reply...' : 'Add a comment...'}
                        />
                        <ErrorMessage name="content" component="div" className="text-red-500 text-xs mt-1" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-2">Attachments</label>
                        <div className="flex flex-wrap gap-3 items-center">
                            {newAttachments.map((f, idx) => renderAttachmentPreview(f, false, idx))}
                            <label className="cursor-pointer flex items-center justify-center w-10 h-10 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                                <FaPlus className="text-slate-500" />
                                <input type="file" multiple onChange={handleAddNewAttachments} className="hidden" />
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all text-sm font-medium disabled:opacity-50"
                        >
                            {isSubmitting ? 'Submitting...' : buttonText}
                        </button>
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

        return (
            <div className={`mt-4 ${level > 0 ? 'ml-8' : ''} transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        {comment.authorProfilePicture ? (
                            <img src={getImageUrl(comment.authorProfilePicture)} alt="Profile" className="h-9 w-9 rounded-lg object-cover ring-2 ring-white shadow-sm" />
                        ) : (
                            <div className={`h-9 w-9 bg-gradient-to-br ${getAvatarColor({ firstname: comment.authorName?.split(' ')[0], lastname: comment.authorName?.split(' ')[1] })} rounded-lg flex items-center justify-center ring-2 ring-white shadow-sm`}>
                                <span className="text-sm font-semibold text-white">
                                    {getAvatarInitials({ firstname: comment.authorName?.split(' ')[0], lastname: comment.authorName?.split(' ')[1] })}
                                </span>
                            </div>
                        )}
                        <div className="flex flex-col">
                            <span className="font-medium text-slate-800 text-sm">{comment.authorName}</span>
                            <span className="text-xs text-slate-500 cursor-pointer" title={new Date(comment.timestamp).toLocaleString()}>
                                {formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}
                                {comment.editedAt && <span className="ml-1 text-slate-400">(Edited)</span>}
                            </span>
                        </div>
                    </div>
                    <div className="flex space-x-1">
                        {comment.authorId === currentUserId && (
                            <>
                                <button onClick={() => setEditingComment(comment)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors" title="Edit">
                                    <MdEdit className="h-4 w-4 text-slate-500" />
                                </button>
                                <button onClick={() => handleDeleteComment(comment.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                    <MdDelete className="h-4 w-4 text-red-400" />
                                </button>
                            </>
                        )}
                        <button onClick={() => setReplyingCommentId(comment.id)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Reply">
                            <MdReply className="h-4 w-4 text-slate-600" />
                        </button>
                    </div>
                </div>

                {/* Content or Edit Form */}
                {editingComment?.id === comment.id ? (
                    <div className="mt-4">
                        <CommentForm
                            onSubmit={(values, actions) => handleUpdateComment(comment, values, actions)}
                            initialContent={comment.content}
                            buttonText="Update"
                            onCancel={() => { setEditingComment(null); setNewAttachments([]); }}
                        />
                    </div>
                ) : (
                    <div className="mt-3">
                        <div className="whitespace-pre-wrap text-sm text-slate-700">{comment.content}</div>
                        {comment.attachments?.length > 0 && (
                            <div className="mt-3">
                                <h4 className="text-xs font-medium text-slate-500 mb-2">Attachments</h4>
                                <div className="flex flex-wrap gap-3">
                                    {comment.attachments.map((a, idx) => renderAttachmentPreview(a, true, idx, comment.id))}
                                </div>
                            </div>
                        )}

                        {/* Reactions */}
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-200">
                            <button
                                onClick={() => handleReactToComment(comment.id, 'LIKE')}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                                    comment.likedByCurrentUser ? 'text-slate-900 bg-slate-100' : 'text-slate-500 hover:bg-slate-100'
                                }`}
                                disabled={comment.likedByCurrentUser || comment.dislikedByCurrentUser}
                            >
                                <MdThumbUp className="h-4 w-4" /> <span className="text-xs font-medium">{comment.likeCount}</span>
                            </button>
                            <button
                                onClick={() => handleReactToComment(comment.id, 'DISLIKE')}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                                    comment.dislikedByCurrentUser ? 'text-red-600 bg-red-50' : 'text-slate-500 hover:bg-slate-100'
                                }`}
                                disabled={comment.likedByCurrentUser || comment.dislikedByCurrentUser}
                            >
                                <MdThumbDown className="h-4 w-4" /> <span className="text-xs font-medium">{comment.dislikeCount}</span>
                            </button>

                            {/* Reaction tooltips */}
                            {comment.likeCount > 0 && (
                                <div
                                    className="relative inline-block"
                                    onMouseEnter={() => setHoveredReaction(`${comment.id}-like`)}
                                    onMouseLeave={() => setHoveredReaction(null)}
                                >
                                    <button className="text-slate-700 hover:underline text-xs font-medium">{comment.likeCount} Likes</button>
                                    {hoveredReaction === `${comment.id}-like` && (
                                        <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10 p-3">
                                            {comment.likedByUsernames?.map((username, i) => (
                                                <div key={i} className="text-slate-700 text-sm py-1">{username}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {comment.dislikeCount > 0 && (
                                <div
                                    className="relative inline-block"
                                    onMouseEnter={() => setHoveredReaction(`${comment.id}-dislike`)}
                                    onMouseLeave={() => setHoveredReaction(null)}
                                >
                                    <button className="text-red-600 hover:underline text-xs font-medium">{comment.dislikeCount} Dislikes</button>
                                    {hoveredReaction === `${comment.id}-dislike` && (
                                        <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10 p-3">
                                            {comment.dislikedByUsernames?.map((username, i) => (
                                                <div key={i} className="text-slate-700 text-sm py-1">{username}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Reply form */}
                {replyingCommentId === comment.id && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
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
        );
    };

    return (
        <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Comments</h3>

            {!showCommentForm ? (
                <button
                    onClick={() => setShowCommentForm(true)}
                    className="px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-medium flex items-center gap-2"
                >
                    <FaPlus className="h-3 w-3" /> <span>Add comment</span>
                </button>
            ) : (
                <div className="mb-6 p-4 bg-white border border-slate-200 rounded-xl animate-[fadeInSlide_0.3s_ease-out]">
                    <CommentForm
                        onSubmit={(values, actions) => handleAddComment(values, actions, null)}
                        buttonText="Publish"
                        onCancel={() => { setShowCommentForm(false); setNewAttachments([]); }}
                    />
                </div>
            )}

            <div className="space-y-4">
                {comments.map(comment => (
                    <CommentItem key={comment.id} comment={comment} />
                ))}
            </div>

            {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
        </div>
    );
}