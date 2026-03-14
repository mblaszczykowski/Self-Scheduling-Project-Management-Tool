import React from 'react';
import { useAnimateIn } from '../../hooks/useAnimateIn';
import { formatDistanceToNow } from 'date-fns';
import {
    getImageUrl, getAvatarColor, getAvatarInitials,
} from '../../util/helpers';
import { ThumbsUpIcon, ThumbsDownIcon } from '../common/Icons';
import CommentForm from './CommentForm';

const MAX_REPLY_DEPTH = 4;

const CommentItem = React.memo(({
    comment,
    level = 0,
    currentUserId,
    editingComment,
    replyingCommentId,
    newAttachments,
    onSetEditingComment,
    onSetReplyingCommentId,
    onSetNewAttachments,
    onHandleUpdateComment,
    onHandleAddComment,
    onHandleDeleteComment,
    onHandleReactToComment,
    onAddAttachments,
    renderAttachmentPreview,
    openPreview,
}) => {
    const [isVisible] = useAnimateIn();

    const isOwner = comment.authorId === currentUserId;

    const authorParts = {
        firstname: comment.authorName?.split(' ')[0],
        lastname: comment.authorName?.split(' ')[1],
    };

    return (
        <div
            className={
                `${level > 0 ? 'ml-6 mt-2' : 'mt-2'}`
                + ` transition-all duration-200`
                + ` ${isVisible ? 'opacity-100' : 'opacity-0'}`
            }
        >
            <div className="flex gap-2.5">
                {comment.authorProfilePicture ? (
                    <img
                        src={getImageUrl(comment.authorProfilePicture)}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover flex-shrink-0"
                    />
                ) : (
                    <div
                        className={
                            'h-7 w-7 bg-gradient-to-br '
                            + `${getAvatarColor(authorParts)} `
                            + 'rounded-full flex items-center justify-center flex-shrink-0'
                        }
                    >
                        <span className="text-[10px] font-semibold text-white">
                            {getAvatarInitials(authorParts)}
                        </span>
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    {editingComment?.id === comment.id ? (
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <CommentForm
                                onSubmit={(values, actions) =>
                                    onHandleUpdateComment(comment, values, actions)
                                }
                                initialContent={comment.content}
                                buttonText="Update"
                                onCancel={() => {
                                    onSetEditingComment(null);
                                    onSetNewAttachments([]);
                                }}
                                newAttachments={newAttachments}
                                onAddAttachments={onAddAttachments}
                                renderAttachmentPreview={renderAttachmentPreview}
                            />
                        </div>
                    ) : (
                        <>
                            <div className="bg-slate-50 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-medium text-slate-900 text-sm">
                                        {comment.authorName}
                                    </span>
                                    <span
                                        className="text-[11px] text-slate-400"
                                        title={new Date(comment.timestamp).toLocaleString()}
                                    >
                                        {formatDistanceToNow(
                                            new Date(comment.timestamp),
                                            { addSuffix: true },
                                        )}
                                    </span>
                                    {comment.editedAt && (
                                        <span className="text-[10px] text-slate-400">
                                            (edited)
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-700 whitespace-pre-wrap">
                                    {comment.content}
                                </div>

                                {comment.attachments?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {comment.attachments.map((a, idx) =>
                                            renderAttachmentPreview(a, true, idx, comment.id)
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3 mt-1 ml-1">
                                <button
                                    onClick={() =>
                                        onHandleReactToComment(comment.id, 'LIKE')
                                    }
                                    className={
                                        'flex items-center gap-1 text-xs transition-colors '
                                        + (comment.likedByCurrentUser
                                            ? 'text-slate-900 font-medium'
                                            : 'text-slate-500 hover:text-slate-700')
                                    }
                                    disabled={
                                        comment.likedByCurrentUser
                                        || comment.dislikedByCurrentUser
                                    }
                                >
                                    <ThumbsUpIcon filled={comment.likedByCurrentUser} />
                                    {comment.likeCount > 0 && comment.likeCount}
                                </button>
                                <button
                                    onClick={() =>
                                        onHandleReactToComment(comment.id, 'DISLIKE')
                                    }
                                    className={
                                        'flex items-center gap-1 text-xs transition-colors '
                                        + (comment.dislikedByCurrentUser
                                            ? 'text-red-500 font-medium'
                                            : 'text-slate-500 hover:text-slate-700')
                                    }
                                    disabled={
                                        comment.likedByCurrentUser
                                        || comment.dislikedByCurrentUser
                                    }
                                >
                                    <ThumbsDownIcon filled={comment.dislikedByCurrentUser} />
                                    {comment.dislikeCount > 0 && comment.dislikeCount}
                                </button>
                                {level < MAX_REPLY_DEPTH && (
                                    <button
                                        onClick={() => onSetReplyingCommentId(comment.id)}
                                        className={
                                            'text-xs text-slate-500 hover:text-slate-700'
                                            + ' font-medium transition-colors'
                                        }
                                    >
                                        Reply
                                    </button>
                                )}
                                {isOwner && (
                                    <>
                                        <button
                                            onClick={() => onSetEditingComment(comment)}
                                            className={
                                                'text-xs text-slate-500'
                                                + ' hover:text-slate-700 transition-colors'
                                            }
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => onHandleDeleteComment(comment.id)}
                                            className={
                                                'text-xs text-slate-500'
                                                + ' hover:text-red-500 transition-colors'
                                            }
                                        >
                                            Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    )}

                    {replyingCommentId === comment.id && (
                        <div className="mt-2">
                            <CommentForm
                                onSubmit={(values, actions) =>
                                    onHandleAddComment(values, actions, comment.id)
                                }
                                buttonText="Reply"
                                onCancel={() => {
                                    onSetReplyingCommentId(null);
                                    onSetNewAttachments([]);
                                }}
                                newAttachments={newAttachments}
                                onAddAttachments={onAddAttachments}
                                renderAttachmentPreview={renderAttachmentPreview}
                            />
                        </div>
                    )}

                    {comment.replies?.map(reply => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            level={level + 1}
                            currentUserId={currentUserId}
                            editingComment={editingComment}
                            replyingCommentId={replyingCommentId}
                            newAttachments={newAttachments}
                            onSetEditingComment={onSetEditingComment}
                            onSetReplyingCommentId={onSetReplyingCommentId}
                            onSetNewAttachments={onSetNewAttachments}
                            onHandleUpdateComment={onHandleUpdateComment}
                            onHandleAddComment={onHandleAddComment}
                            onHandleDeleteComment={onHandleDeleteComment}
                            onHandleReactToComment={onHandleReactToComment}
                            onAddAttachments={onAddAttachments}
                            renderAttachmentPreview={renderAttachmentPreview}
                            openPreview={openPreview}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
});

CommentItem.displayName = 'CommentItem';

export default CommentItem;
