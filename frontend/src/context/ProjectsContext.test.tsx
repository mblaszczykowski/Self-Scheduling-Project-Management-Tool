import { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './AuthContext';
import { ProjectsProvider, useProjects } from './ProjectsContext';
import { getAllProjects, logout } from '../util/api';
import { CurrentUser, Project } from '../types';

jest.mock('../util/api');
const getProjects = jest.mocked(getAllProjects);
const signOut = jest.mocked(logout);
const currentUser: CurrentUser = { id: 1, email: 'one@example.com', firstname: 'One', lastname: 'User', emailNotificationsEnabled: true, emailOnTaskAssigned: true, emailOnCommentReply: true, emailOnProjectInvitation: true };
const privateProject: Project = { id: 1, projectKey: 'PRIVATE', summary: 'Private', tasks: [], members: [], attachments: [], dependencies: [] };

const createWrapper = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
        <AuthProvider initialUser={currentUser}><ProjectsProvider>{children}</ProjectsProvider></AuthProvider>
    </QueryClientProvider>;
    return { client, wrapper };
};

test('a newly signed-in account cannot see the previous account project cache', async () => {
    getProjects.mockResolvedValueOnce([privateProject]);
    getProjects.mockReturnValueOnce(new Promise(() => {}));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => ({ auth: useAuth(), projects: useProjects() }), { wrapper });
    await waitFor(() => expect(result.current.projects.projects).toHaveLength(1));
    act(() => { result.current.auth.setUser({ ...currentUser, id: 2, email: 'two@example.com' }); });
    expect(result.current.projects.projects).toEqual([]);
    expect(result.current.projects.projectsLoading).toBe(true);
});

test('failed logout keeps the authenticated state and propagates an actionable error', async () => {
    getProjects.mockResolvedValue([]);
    signOut.mockRejectedValue(new Error('offline'));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => { await expect(result.current.handleLogout()).rejects.toThrow('offline'); });
    expect(result.current.user?.id).toBe(1);
});

test('successful logout removes cached private data', async () => {
    getProjects.mockResolvedValue([]);
    signOut.mockResolvedValue(undefined);
    const { client, wrapper } = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });
    client.setQueryData(['private-example'], { secret: 'private-data' });
    await act(async () => { await result.current.handleLogout(); });
    expect(result.current.user).toBeNull();
    expect(client.getQueryData(['private-example'])).toBeUndefined();
});
