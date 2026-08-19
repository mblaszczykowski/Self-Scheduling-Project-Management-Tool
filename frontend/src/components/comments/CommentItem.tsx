import React, { useEffect, useRef, useState } from 'react';
import { FormikHelpers } from 'formik';
import { useAnimateIn } from '../../hooks/useAnimateIn';
import { formatDistanceToNow } from 'date-fns';
import { splitFullName } from '../../util/helpers';
import Avatar from '../common/Avatar';
import { ThumbsUpIcon, ThumbsDownIcon } from '../common/Icons';
import CommentForm, { CommentFormValues } from './CommentForm';
import { Comment, ReactionType } from '../../types';

const MAX_REPLY_DEPTH = 4;

interface ReactionButtonProps {
    type: ReactionType;
    active: boolean;
    disabled: boolean;
    activeClass: string;
    count: number;
    icon: React.ComponentType<{ filled: boolean }>;
    onClick: () => void;
}

const ReactionButton = ({ type, active, disabled, activeClass, count, icon: Icon, onClick }: ReactionButtonProps) => {
    const label = type === 'LIKE' ? 'Like' : 'Dislike';

    return (
        <button
            onClick={onClick}
            aria-label={active ? `Remove ${label.toLowerCase()}` : label}
            className={
                'flex items-center gap-0.5 text-xs transition-colors '
                + (active
                    ? activeClass
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300')
            }
            disabled={disabled}
        >
            <Icon filled={active} />
            {count > 0 && count}
        </button>
    );
};

export interface CommentItemProps {
    comment: Comment;
    level?: number;
    currentUserId?: number;
    editingComment: Comment | null;
    replyingCommentId: number | null;
    highlightCommentId: number | null;
    onSetEditingComment: (c: Comment | null) => void;
    onSetReplyingCommentId: (id: number | null) => void;
    onHandleUpdateComment: (comment: Comment, values: CommentFormValues, actions: FormikHelpers<CommentFormValues>, attachments: File[]) => void;
    onHandleAddComment: (values: CommentFormValues, actions: FormikHelpers<CommentFormValues>, parentCommentId: number | null, attachments: File[]) => void;
    onHandleDeleteComment: (commentId: number) => void;
    onHandleReactToComment: (commentId: number, reactionType: ReactionType) => void | Promise<void>;
    renderAttachmentPreview: (attachment: string, idx: number) => React.ReactNode;
}

const CommentItem = React.memo(({
    comment,
    level = 0,
    currentUserId,
    editingComment,
    replyingCommentId,
    highlightCommentId,
    onSetEditingComment,
    onSetReplyingCommentId,
    onHandleUpdateComment,
    onHandleAddComment,
    onHandleDeleteComment,
    onHandleReactToComment,
    renderAttachmentPreview,
}: CommentItemProps) => {
    const [isVisible] = useAnimateIn();
    const commentRef = useRef<HTMLDivElement | null>(null);
    const isHighlighted = highlightCommentId === comment.id;
    const [reactionPending, setReactionPending] = useState(false);

    const handleReact = async (reactionType: ReactionType) => {
        if (reactionPending) return;
        setReactionPending(true);
        try {
            await onHandleReactToComment(comment.id, reactionType);
        } finally {
            setReactionPending(false);
        }
    };

    useEffect(() => {
        if (!isHighlighted || !commentRef.current) return;
        const timer = setTimeout(() => {
            commentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
        return () => clearTimeout(timer);
    }, [isHighlighted]);

    const isOwner = comment.authorId === currentUserId;

    const authorParts = splitFullName(comment.authorName);

    const actionBtnClass = 'text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors';

    return (
        <div
            ref={commentRef}
            className={
                `${level > 0 ? 'ml-5 mt-2' : 'mt-2'}`
                + ` transition-all duration-500`
                + ` ${isVisible ? 'opacity-100' : 'opacity-0'}`
                + ` ${isHighlighted ? ' rounded-lg ring-2 ring-blue-400 dark:ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20 p-2 -m-2' : ''}`
            }
        >
            <div className="flex gap-2">
                <Avatar
                    user={authorParts}
                    profilePicture={comment.authorProfilePicture}
                    size="xs"
                    className="flex-shrink-0 mt-0.5"
                />

                <div className="flex-1 min-w-0">
                    {editingComment?.id === comment.id ? (
                        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-md p-2.5 border border-slate-200 dark:border-slate-700">
                            <CommentForm
                                onSubmit={(values, actions, attachments) =>
                                    onHandleUpdateComment(comment, values, actions, attachments)
                                }
                                initialContent={comment.content}
                                buttonText="Update"
                                onCancel={() => {
                                    onSetEditingComment(null);
                                }}
                            />
                        </div>
                    ) : (
                        <>
                            <div className="group">
                                <div className="flex items-baseline gap-1.5 mb-0.5">
                                    <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                                        {comment.authorName}
                                    </span>
                                    <span
                                        className="text-xs text-slate-400 dark:text-slate-500"
                                        title={new Date(comment.timestamp).toLocaleString('en-US')}
                                    >
                                        {formatDistanceToNow(
                                            new Date(comment.timestamp),
                                            { addSuffix: true },
                                        )}
                                    </span>
                                    {comment.editedAt && (
                                        <span className="text-xs text-slate-300 dark:text-slate-600">edited</span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                    {comment.content}
                                </div>

                                {comment.attachments?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        {comment.attachments.map((a, idx) =>
                                            renderAttachmentPreview(a, idx)
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2.5 mt-1">
                                <ReactionButton
                                    type="LIKE"
                                    active={comment.likedByCurrentUser}
                                    disabled={reactionPending}
                                    activeClass="text-slate-800 dark:text-slate-200 font-medium"
                                    count={comment.likeCount}
                                    icon={ThumbsUpIcon}
                                    onClick={() => handleReact('LIKE')}
                                />
                                <ReactionButton
                                    type="DISLIKE"
                                    active={comment.dislikedByCurrentUser}
                                    disabled={reactionPending}
                                    activeClass="text-red-500 font-medium"
                                    count={comment.dislikeCount}
                                    icon={ThumbsDownIcon}
                                    onClick={() => handleReact('DISLIKE')}
                                />
                                {level < MAX_REPLY_DEPTH ? (
                                    <button
                                        onClick={() => onSetReplyingCommentId(comment.id)}
                                        className={actionBtnClass}
                                    >
                                        Reply
                                    </button>
                                ) : (
                                    <span className="text-xs text-slate-300 dark:text-slate-600 italic">max depth</span>
                                )}
                                {isOwner && (
                                    <>
                                        <button
                                            onClick={() => onSetEditingComment(comment)}
                                            className={actionBtnClass}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => onHandleDeleteComment(comment.id)}
                                            className={actionBtnClass + ' hover:!text-red-500'}
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
                                onSubmit={(values, actions, attachments) =>
                                    onHandleAddComment(values, actions, comment.id, attachments)
                                }
                                buttonText="Reply"
                                onCancel={() => {
                                    onSetReplyingCommentId(null);
                                }}
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
                            highlightCommentId={highlightCommentId}
                            onSetEditingComment={onSetEditingComment}
                            onSetReplyingCommentId={onSetReplyingCommentId}
                            onHandleUpdateComment={onHandleUpdateComment}
                            onHandleAddComment={onHandleAddComment}
                            onHandleDeleteComment={onHandleDeleteComment}
                            onHandleReactToComment={onHandleReactToComment}
                            renderAttachmentPreview={renderAttachmentPreview}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
});

CommentItem.displayName = 'CommentItem';

export default CommentItem;
