import { act, renderHook, waitFor } from '@testing-library/react';
import { useComments } from './useComments';
import { getComments, updateComment } from '../util/api';
import { Comment } from '../types';

jest.mock('../util/api');
const get = jest.mocked(getComments);
const update = jest.mocked(updateComment);
const comment = (id: number, taskId: number): Comment => ({ id, taskId, content: `Comment ${id}`, timestamp: '2026-10-15T12:00:00Z', attachments: [], replies: [], likeCount: 0, dislikeCount: 0, likedByCurrentUser: false, dislikedByCurrentUser: false });
const page = (content: Comment[], hasNext = false) => ({ content, hasNext, page: 0, size: 50, totalElements: content.length, totalPages: hasNext ? 2 : 1 });

test('loads subsequent comment pages without dropping the first page', async () => {
    get.mockResolvedValueOnce(page([comment(1, 1)], true));
    get.mockResolvedValueOnce(page([comment(2, 1)]));
    const { result } = renderHook(() => useComments(1));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.comments.map(item => item.id)).toEqual([1, 2]);
    expect(result.current.hasMore).toBe(false);
    expect(get).toHaveBeenLastCalledWith(1, 1);
});

test('a delayed mutation for the old task cannot overwrite a newly selected task', async () => {
    get.mockResolvedValueOnce(page([comment(1, 1)]));
    get.mockResolvedValueOnce(page([comment(2, 2)]));
    let finish: (value: Comment) => void = () => {};
    update.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(({ taskId }) => useComments(taskId), { initialProps: { taskId: 1 } });
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    let pending: Promise<void>;
    act(() => { pending = result.current.editComment(1, 'Edited'); });
    rerender({ taskId: 2 });
    await waitFor(() => expect(result.current.comments[0].taskId).toBe(2));
    await act(async () => { finish({ ...comment(1, 1), content: 'Edited' }); await pending; });
    expect(result.current.comments[0].taskId).toBe(2);
    expect(result.current.comments[0].content).toBe('Comment 2');
});
