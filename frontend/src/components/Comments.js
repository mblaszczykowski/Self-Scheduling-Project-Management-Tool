import React, {useContext, useEffect, useState} from 'react';
import {DataContext} from '../context/DataContext';
import {ErrorMessage, Field, Form, Formik} from 'formik';
import * as Yup from 'yup';
import {FaDownload, FaFileAlt, FaFilePdf, FaPlus, FaTimes} from 'react-icons/fa';
import {MdAccountCircle, MdDelete, MdEdit, MdReply, MdThumbDown, MdThumbUp} from 'react-icons/md';
import {formatDistanceToNow} from 'date-fns';

const backendBaseURL = 'http://localhost:8080';

export default function Comments({ taskId, currentUserId }) {
    const {
        getComments,
        createComment,
        updateComment,
        deleteComment,
        reactToComment,
    } = useContext(DataContext);

    const [comments, setComments] = useState([]);
    const [editingComment, setEditingComment] = useState(null);
    const [replyingCommentId, setReplyingCommentId] = useState(null);
    const [newAttachments, setNewAttachments] = useState([]);
    const [existingAttachments] = useState([]);
    const [showCommentForm, setShowCommentForm] = useState(false);

    const [hoveredReaction, setHoveredReaction] = useState(null);
    const [preview, setPreview] = useState(null);

    useEffect(() => {
        fetchComments();
    }, [taskId]);

    async function fetchComments() {
        try {
            const fetchedComments = await getComments(taskId);
            const sortedComments = fetchedComments.sort(
                (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
            );
            setComments(sortedComments);
        } catch (error) {
            console.error('Error fetching comments:', error);
        }
    }

    const CommentSchema = Yup.object().shape({
        content: Yup.string().required('Comment cannot be empty'),
    });

    async function handleAddComment(values, { resetForm, setSubmitting }, parentCommentId = null) {
        setSubmitting(true);
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
    }

    async function handleUpdateComment(comment, values, { setSubmitting }) {
        setSubmitting(true);
        try {
            await updateComment(
                taskId,
                comment.id,
                { content: values.content },
                newAttachments
            );

            await fetchComments();
            setEditingComment(null);
            setNewAttachments([]);
        } catch (error) {
            console.error('Error updating comment:', error);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDeleteComment(commentId) {
        if (window.confirm('Are you sure you want to delete this comment?')) {
            try {
                await deleteComment(taskId, commentId);
                await fetchComments();
            } catch (error) {
                console.error('Error deleting comment:', error);
            }
        }
    }

    async function handleReactToComment(commentId, reactionType) {
        try {
            await reactToComment(taskId, commentId, reactionType);
            await fetchComments();
        } catch (error) {
            console.error('Error reacting to comment:', error);
        }
    }

    function handleAddNewAttachments(e) {
        const files = Array.from(e.target.files);
        setNewAttachments(prev => [...prev, ...files]);
    }

    function handleRemoveAttachment(commentId, attachment, isExisting) {
        if (isExisting) {
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
    }

    function getFileTypeFromPath(path) {
        const extension = path.split('.').pop().toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        if (imageExts.includes(extension)) return 'image';
        if (extension === 'pdf') return 'application';
        return 'application';
    }

    function openPreview(attachment) {
        const isFile = attachment instanceof File;
        const url = isFile ? URL.createObjectURL(attachment) : `${backendBaseURL}${attachment}`;
        const fileName = isFile ? attachment.name : attachment.split('/').pop();
        const fileType = isFile ? attachment.type.split('/')[0] : getFileTypeFromPath(attachment);
        setPreview({ url, fileName, fileType });
    }

    function renderAttachmentPreview(commentId, attachment, isExisting, idx) {
        const isFile = attachment instanceof File;
        const url = isFile ? URL.createObjectURL(attachment) : `${backendBaseURL}${attachment}`;
        const fileName = isFile ? attachment.name : attachment.split('/').pop();
        const fileType = isFile ? attachment.type.split('/')[0] : getFileTypeFromPath(attachment);

        return (
            <div
                key={isFile ? `file-${fileName}-${idx}` : attachment}
                className="relative cursor-pointer"
                onClick={() => openPreview(attachment)}
            >
                {fileType === 'image' ? (
                    <img
                        src={url}
                        alt={fileName}
                        className="h-20 w-auto object-cover rounded-md shadow-sm"
                    />
                ) : fileType === 'application' && fileName.toLowerCase().endsWith('.pdf') ? (
                    <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded-md">
                        <FaFilePdf className="text-red-500" />
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {fileName}
                        </a>
                    </div>
                ) : (
                    <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded-md">
                        <FaFileAlt className="text-gray-500" />
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {fileName}
                        </a>
                    </div>
                )}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAttachment(commentId, attachment, isExisting);
                    }}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"
                    title="Remove Attachment"
                >
                    <FaTimes size={12} />
                </button>
            </div>
        );
    }

    const PreviewModal = ({ preview, onClose }) => {
        if (!preview) return null;
        return (
            <div
                className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50"
                onClick={onClose}
            >
                <div className="relative bg-white p-4 rounded shadow-lg" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-semibold mb-2">{preview.fileName}</h3>
                    {preview.fileType === 'image' ? (
                        <img src={preview.url} alt={preview.fileName} className="max-h-[80vh] max-w-[90vw]" />
                    ) : (
                        <iframe
                            src={preview.url}
                            title={preview.fileName}
                            className="w-[80vw] h-[80vh]"
                        ></iframe>
                    )}
                    <div className="mt-2 flex justify-between items-center">
                        <a
                            href={preview.url}
                            download={preview.fileName}
                            className="flex items-center gap-x-1 text-blue-600 hover:underline"
                        >
                            <FaDownload /> Download
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    function CommentItem({ comment, level = 0 }) {
        return (
            <div className={`mt-4 ${level > 0 ? 'ml-8' : ''}`}>
                <div className="p-3 bg-gray-100 rounded-lg relative">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            {comment.authorProfilePicture ? (
                                <img
                                    src={`http://localhost:8080${comment.authorProfilePicture}`}
                                    alt="Profile"
                                    className="h-8 w-8 rounded-full object-cover"
                                />
                            ) : (
                                <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                                    <MdAccountCircle className="h-5 w-5 text-gray-500" />
                                </div>
                            )}
                            <span className="font-medium">{comment.authorName}</span>
                            <span
                                className="text-sm text-gray-500 cursor-pointer"
                                title={new Date(comment.timestamp).toLocaleString('en-US', { timeZoneName: 'short' })}
                            >
                                {formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}
                                {comment.editedAt && <span className="ml-2 text-xs text-gray-400">(Edited)</span>}
                            </span>
                        </div>
                        <div className="flex space-x-2">
                            {comment.authorId === currentUserId && (
                                <>
                                    <button
                                        onClick={() => setEditingComment(comment)}
                                        className="text-gray-600 hover:text-blue-700 bg-gray-300 rounded-xl p-1"
                                        title="Edit Comment"
                                    >
                                        <MdEdit className="h-5 w-5 text-gray-500" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="text-gray-600 hover:text-blue-700 bg-gray-300 rounded-xl p-1"
                                        title="Delete Comment"
                                    >
                                        <MdDelete className="h-5 w-5 text-red-400" />
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setReplyingCommentId(comment.id)}
                                className="text-gray-600 hover:text-blue-700 bg-gray-300 rounded-xl p-1"
                                title="Reply to Comment"
                            >
                                <MdReply className="h-5 w-5 text-blue-500" />
                            </button>
                        </div>
                    </div>

                    {/* Editing Form */}
                    {editingComment && editingComment.id === comment.id ? (
                        <Formik
                            initialValues={{ content: comment.content }}
                            validationSchema={CommentSchema}
                            onSubmit={(values, actions) => handleUpdateComment(comment, values, actions)}
                        >
                            {({ isSubmitting }) => (
                                <Form>
                                    <div className="flex flex-col gap-4 mt-2">
                                        <div className="border border-gray-300 rounded-lg p-2 shadow-sm">
                                            <Field
                                                as="textarea"
                                                name="content"
                                                className="w-full p-2 border border-gray-300 rounded-lg"
                                                placeholder="Edit your comment..."
                                            />
                                            <ErrorMessage name="content" component="div" className="text-red-600 text-sm" />
                                        </div>
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {comment.attachments?.map((a, idx) => renderAttachmentPreview(comment.id, a, true, idx))}
                                                {newAttachments.map((f, idx) => renderAttachmentPreview(comment.id, f, false, idx))}
                                                <label
                                                    htmlFor={`attachment-upload-edit-${comment.id}`}
                                                    className="cursor-pointer flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full hover:bg-gray-300"
                                                    title="Add Attachment"
                                                >
                                                    <FaPlus />
                                                    <input
                                                        type="file"
                                                        id={`attachment-upload-edit-${comment.id}`}
                                                        multiple
                                                        onChange={handleAddNewAttachments}
                                                        className="hidden"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingComment(null);
                                                    setNewAttachments([]);
                                                }}
                                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                            >
                                                {isSubmitting ? 'Updating...' : 'Update'}
                                            </button>
                                        </div>
                                    </div>
                                </Form>
                            )}
                        </Formik>
                    ) : (
                        <div className="mt-2 text-gray-800">
                            <div className="whitespace-pre-wrap">{comment.content}</div>
                            {comment.attachments && comment.attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    <h4 className="text-sm font-semibold">Attachments:</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {comment.attachments.map((a, idx) => renderAttachmentPreview(comment.id, a, true, idx))}
                                    </div>
                                </div>
                            )}
                            <div className="flex space-x-2 mt-2">
                                <button
                                    onClick={() => handleReactToComment(comment.id, 'LIKE')}
                                    className={`flex items-center ${
                                        comment.likedByCurrentUser ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'
                                    }`}
                                    disabled={comment.likedByCurrentUser || comment.dislikedByCurrentUser}
                                    title="Like Comment"
                                >
                                    <MdThumbUp className="h-5 w-5" /> <span className="ml-1">{comment.likeCount}</span>
                                </button>
                                <button
                                    onClick={() => handleReactToComment(comment.id, 'DISLIKE')}
                                    className={`flex items-center ${
                                        comment.dislikedByCurrentUser ? 'text-red-600' : 'text-gray-500 hover:text-red-500'
                                    }`}
                                    disabled={comment.likedByCurrentUser || comment.dislikedByCurrentUser}
                                    title="Dislike Comment"
                                >
                                    <MdThumbDown className="h-5 w-5" /> <span className="ml-1">{comment.dislikeCount}</span>
                                </button>
                                {comment.likeCount > 0 && (
                                    <div
                                        className="relative inline-block"
                                        onMouseEnter={() => setHoveredReaction(comment.id + '-like')}
                                        onMouseLeave={() => setHoveredReaction(null)}
                                    >
                                        <button className="text-blue-600 hover:underline text-sm" title="View who liked this comment">
                                            {comment.likeCount} Likes
                                        </button>
                                        {hoveredReaction === comment.id + '-like' && (
                                            <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 p-2">
                                                {comment.likedByUsernames.map((username, i) => (
                                                    <div key={i} className="text-gray-700 text-sm">
                                                        {username}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {comment.dislikeCount > 0 && (
                                    <div
                                        className="relative inline-block"
                                        onMouseEnter={() => setHoveredReaction(comment.id + '-dislike')}
                                        onMouseLeave={() => setHoveredReaction(null)}
                                    >
                                        <button className="text-red-600 hover:underline text-sm" title="View who disliked this comment">
                                            {comment.dislikeCount} Dislikes
                                        </button>
                                        {hoveredReaction === comment.id + '-dislike' && (
                                            <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 p-2">
                                                {comment.dislikedByUsernames.map((username, i) => (
                                                    <div key={i} className="text-gray-700 text-sm">
                                                        {username}
                                                    </div>
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
                        <div className="mt-4">
                            <Formik
                                initialValues={{ content: '' }}
                                validationSchema={CommentSchema}
                                onSubmit={(values, actions) => handleAddComment(values, actions, comment.id)}
                            >
                                {({ isSubmitting }) => (
                                    <Form>
                                        <div className="flex flex-col gap-4">
                                            <div className="border border-gray-300 rounded-lg p-2 shadow-sm">
                                                <Field
                                                    as="textarea"
                                                    name="content"
                                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                                    placeholder="Write a reply..."
                                                />
                                                <ErrorMessage name="content" component="div" className="text-red-600 text-sm" />
                                                <div className="mb-1">
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        {comment.attachments?.map((a, idx) => renderAttachmentPreview(comment.id, a, true, idx))}
                                                        {newAttachments.map((f, idx) => renderAttachmentPreview(comment.id, f, false, idx))}
                                                        <label
                                                            htmlFor={`attachment-upload-reply-${comment.id}`}
                                                            className="cursor-pointer flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full hover:bg-gray-300"
                                                            title="Add Attachment"
                                                        >
                                                            <FaPlus />
                                                            <input
                                                                type="file"
                                                                id={`attachment-upload-reply-${comment.id}`}
                                                                multiple
                                                                onChange={handleAddNewAttachments}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end space-x-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setReplyingCommentId(null);
                                                            setNewAttachments([]);
                                                        }}
                                                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={isSubmitting}
                                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                                    >
                                                        {isSubmitting ? 'Replying...' : 'Reply'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </Form>
                                )}
                            </Formik>
                        </div>
                    )}

                    {/* Nested replies */}
                    {comment.replies?.map(reply => (
                        <CommentItem key={reply.id} comment={reply} level={level + 1} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Comments</h3>
            {!showCommentForm ? (
                <button
                    onClick={() => setShowCommentForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 flex items-center space-x-2"
                >
                    <FaPlus /> <span>Add comment</span>
                </button>
            ) : (
                <div className="mb-6">
                    <Formik
                        initialValues={{ content: '' }}
                        validationSchema={CommentSchema}
                        onSubmit={(values, actions) => handleAddComment(values, actions, null)}
                    >
                        {({ isSubmitting }) => (
                            <Form>
                                <div className="flex flex-col gap-4">
                                    <div className="border border-gray-300 rounded-lg p-2 shadow-sm">
                                        <Field
                                            as="textarea"
                                            name="content"
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                            placeholder="Add a comment..."
                                        />
                                        <ErrorMessage name="content" component="div" className="text-red-600 text-sm" />
                                        <div className="mb-1">
                                            <label className="block text-sm font-medium text-gray-700 mb-1 mt-1">Attachments</label>
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {existingAttachments.map((a, idx) => renderAttachmentPreview(null, a, true, idx))}
                                                {newAttachments.map((f, idx) => renderAttachmentPreview(null, f, false, idx))}
                                                <label
                                                    htmlFor="attachment-upload-new"
                                                    className="cursor-pointer flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full hover:bg-gray-300"
                                                    title="Add Attachment"
                                                >
                                                    <FaPlus />
                                                    <input
                                                        type="file"
                                                        id="attachment-upload-new"
                                                        multiple
                                                        onChange={handleAddNewAttachments}
                                                        className="hidden"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowCommentForm(false);
                                                    setNewAttachments([]);
                                                }}
                                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                                            >
                                                {isSubmitting ? 'Publishing...' : 'Publish'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Form>
                        )}
                    </Formik>
                </div>
            )}
            <div className="space-y-4">
                {comments.map(comment => (
                    <CommentItem key={comment.id} comment={comment} />
                ))}
            </div>
            {/* Preview Modal */}
            {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
        </div>
    );
}
