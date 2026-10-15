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
    const taskIdRef = useRef(taskId);
    taskIdRef.current = taskId;
    const [nextPage, setNextPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const load = useCallback(async () => {
        if (taskIdRef.current !== taskId) return;
        if (taskId == null) {
            setComments([]);
            setLoading(false);
            setError(null);
            setHasMore(false);
            return;
        }
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setLoadingMore(false);
        setError(null);
        try {
            const page = await getComments(taskId);
            if (requestId === requestIdRef.current) {
                setComments(page.content);
                setNextPage(1);
                setHasMore(page.hasNext);
            }
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

    const loadMore = useCallback(async () => {
        if (taskId == null || loadingMore || !hasMore) return;
        const requestId = requestIdRef.current;
        setLoadingMore(true);
        setError(null);
        try {
            const page = await getComments(taskId, nextPage);
            if (requestId !== requestIdRef.current) return;
            setComments(previous => {
                const ids = new Set(previous.map(comment => comment.id));
                return [...previous, ...page.content.filter(comment => !ids.has(comment.id))];
            });
            setNextPage(nextPage + 1);
            setHasMore(page.hasNext);
        } catch (err) {
            if (requestId === requestIdRef.current) setError(getErrorMessage(err, 'Could not load more comments'));
        } finally {
            if (requestId === requestIdRef.current) setLoadingMore(false);
        }
    }, [taskId, nextPage, hasMore, loadingMore]);

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
        if (taskIdRef.current === taskId) await load();
    }, [taskId, load]);

    const editComment = useCallback(async (commentId: number, content: string,
                                           attachments: File[] = []) => {
        if (taskId == null) return;
        const updated = await apiUpdateComment(taskId, commentId, content, attachments);
        if (taskIdRef.current === taskId) replaceInTree(updated);
    }, [taskId, replaceInTree]);

    const removeComment = useCallback(async (commentId: number) => {
        if (taskId == null) return;
        await apiDeleteComment(taskId, commentId);
        if (taskIdRef.current === taskId) await load();
    }, [taskId, load]);

    const react = useCallback(async (commentId: number, type: ReactionType) => {
        if (taskId == null) return;
        const updated = await apiReactToComment(taskId, commentId, type);
        if (taskIdRef.current === taskId) replaceInTree(updated);
    }, [taskId, replaceInTree]);

    return { comments, loading, loadingMore, hasMore, loadMore, error, reload: load, addComment, editComment, removeComment, react };
}

export default useComments;
