import {
    getComments,
    createComment,
    updateComment,
    deleteComment,
    reactToComment,
} from '../util/api';

// Stable, module-level accessor for the comment API. These are the raw api
// functions (already stable references), grouped so comment components depend on
// a focused surface instead of reaching into ProjectsContext for a concern that
// has nothing to do with project state.
const COMMENT_API = { getComments, createComment, updateComment, deleteComment, reactToComment };

export const useComments = () => COMMENT_API;

export default useComments;
