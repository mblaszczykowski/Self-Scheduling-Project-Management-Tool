import { useCallback, useEffect, useRef, useState } from 'react';
import {
    createComment as apiCreateComment,
    deleteComment as apiDeleteComment,
    getComments,
    reactToComment as apiReactToComment,
    updateComment as apiUpdateComment,
} from '../util/api';
import { getErrorMessage } from '../util/helpers';
import { Comment, ReactionType } from '../types';

export function useComments(taskId: number | null) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestIdRef = useRef(0);

    const load = useCallback(async () => {
        if (taskId == null) {
            setComments([]);
            return;
        }
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError(null);
        try {
            const page = await getComments(taskId);
            if (requestId === requestIdRef.current) setComments(page.content);
        } catch (err) {
            if (requestId === requestIdRef.current) {
                setError(getErrorMessage(err, 'Could not load comments'));
            }
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        load();
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            requestIdRef.current++;
        };
    }, [load]);

    const replaceInTree = useCallback((updated: Comment) => {
        const replace = (list: Comment[]): Comment[] => list.map((comment) => {
            if (comment.id === updated.id) return { ...updated, replies: comment.replies };
            if (comment.replies.length === 0) return comment;
            return { ...comment, replies: replace(comment.replies) };
        });
        setComments(replace);
    }, []);

    const addComment = useCallback(async (content: string, attachments: File[] = [],
                                          parentCommentId?: number | null) => {
        if (taskId == null) return;
        await apiCreateComment(taskId, content, attachments, parentCommentId);
        await load();
    }, [taskId, load]);

    const editComment = useCallback(async (commentId: number, content: string,
                                           attachments: File[] = []) => {
        if (taskId == null) return;
        replaceInTree(await apiUpdateComment(taskId, commentId, content, attachments));
    }, [taskId, replaceInTree]);

    const removeComment = useCallback(async (commentId: number) => {
        if (taskId == null) return;
        await apiDeleteComment(taskId, commentId);
        await load();
    }, [taskId, load]);

    const react = useCallback(async (commentId: number, type: ReactionType) => {
        if (taskId == null) return;
        replaceInTree(await apiReactToComment(taskId, commentId, type));
    }, [taskId, replaceInTree]);

    return { comments, loading, error, reload: load, addComment, editComment, removeComment, react };
}

export default useComments;
