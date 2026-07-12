import {
    getComments,
    createComment,
    updateComment,
    deleteComment,
    reactToComment,
} from '../util/api';
import { Comment } from '../types';

interface CommentContent {
    content: string;
}

interface CommentApi {
    getComments: (taskId: number) => Promise<Comment[]>;
    createComment: (taskId: number, content: CommentContent, attachments: File[], parentCommentId?: number | null) => Promise<Comment>;
    updateComment: (taskId: number, commentId: number, content: CommentContent, attachments: File[]) => Promise<Comment>;
    deleteComment: (taskId: number, commentId: number) => Promise<void>;
    reactToComment: (taskId: number, commentId: number, reactionType: string) => Promise<Comment>;
}

// Stable, module-level accessor for the comment API. These are the raw api
// functions (already stable references), grouped so comment components depend on
// a focused surface instead of reaching into ProjectsContext for a concern that
// has nothing to do with project state.
const COMMENT_API: CommentApi = { getComments, createComment, updateComment, deleteComment, reactToComment };

export const useComments = () => COMMENT_API;

export default useComments;
