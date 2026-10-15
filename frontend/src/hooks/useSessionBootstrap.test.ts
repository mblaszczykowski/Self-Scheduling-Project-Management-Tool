import { act, renderHook, waitFor } from '@testing-library/react';
import { checkUserAuth } from '../util/api';
import { CurrentUser } from '../types';
import { useSessionBootstrap } from './useSessionBootstrap';

jest.mock('../util/api', () => ({ checkUserAuth: jest.fn() }));
const check = jest.mocked(checkUserAuth);
const user: CurrentUser = { id: 1, email: 'me@example.com', firstname: 'Me', lastname: 'User', emailNotificationsEnabled: true, emailOnTaskAssigned: true, emailOnCommentReply: true, emailOnProjectInvitation: true };

test('an expired session opens public routes without a service failure', async () => {
    check.mockRejectedValueOnce({ response: { status: 401 } });
    const { result } = renderHook(() => useSessionBootstrap());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
});

test('service unavailability preserves a retry screen instead of pretending the user signed out', async () => {
    check.mockRejectedValueOnce({ response: { status: 503 } });
    check.mockResolvedValueOnce(user);
    const { result } = renderHook(() => useSessionBootstrap());
    await waitFor(() => expect(result.current.error).toContain('temporarily unavailable'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.user).toEqual(user));
    expect(result.current.error).toBeNull();
});

test('a network failure explains that the session could not be verified', async () => {
    check.mockRejectedValueOnce(new Error('Network Error'));
    const { result } = renderHook(() => useSessionBootstrap());
    await waitFor(() => expect(result.current.error).toContain('Check your connection'));
});

test('a late response from the previous attempt cannot replace a successful retry', async () => {
    let rejectFirst: (error: unknown) => void = () => {};
    check.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectFirst = reject; }));
    check.mockResolvedValueOnce(user);
    const { result } = renderHook(() => useSessionBootstrap());
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.user).toEqual(user));
    await act(async () => { rejectFirst({ response: { status: 401 } }); });
    expect(result.current.user).toEqual(user);
});
