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

/**
 * Owns one task's comment thread: loading, mutating, and keeping the two in step.
 *
 * A real hook, unlike its predecessor — which called no hooks and simply returned a module
 * constant, so the `use` prefix advertised a lifecycle it did not have and forced every consumer to
 * list stable api functions in their dependency arrays.
 *
 * Mutations apply the server's response in place rather than refetching. The reaction endpoint
 * already returns the updated comment; discarding it and re-reading the list turned one click into
 * two round trips.
 */
export function useComments(taskId: number | null) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Guards against a slow earlier response overwriting a newer one.
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
            // Any response still in flight belongs to the previous task.
            // Reading the ref at cleanup time is the point, not a mistake: the lint rule guards
            // against capturing a DOM node that has since changed, but this is a counter, and
            // copying it into a local would increment a snapshot and stop invalidating anything.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            requestIdRef.current++;
        };
    }, [load]);

    /** Replaces one comment wherever it sits in the reply tree. */
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
        // A new reply changes the tree's shape, so this is the one case worth re-reading.
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
