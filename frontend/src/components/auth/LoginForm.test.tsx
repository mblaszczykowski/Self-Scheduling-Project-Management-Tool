import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LoginForm from './LoginForm';
import { AuthProvider } from '../../context/AuthContext';
import { login, getCurrentUser } from '../../util/api';
import { CurrentUser } from '../../types';

jest.mock('../../util/api', () => ({
    login: jest.fn(),
    getCurrentUser: jest.fn(),
}));

const mockedLogin = login as jest.MockedFunction<typeof login>;
const mockedGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;

const currentUser: CurrentUser = {
    id: 1,
    email: 'user@example.com',
    firstname: 'Test',
    lastname: 'User',
    emailNotificationsEnabled: true,
    emailOnTaskAssigned: true,
    emailOnCommentReply: true,
    emailOnProjectInvitation: true,
};

const LocationDisplay = () => {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}{location.search}</div>;
};

const renderLoginAt = (pathWithQuery: string) => {
    window.history.replaceState({}, '', pathWithQuery);

    render(
        <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[pathWithQuery]}>
            <AuthProvider initialUser={null}>
                <LocationDisplay />
                <Routes>
                    <Route path="/login" element={<LoginForm onToggleForm={jest.fn()} />} />
                    <Route path="/dashboard" element={<div>Dashboard page</div>} />
                    <Route path="/projects" element={<div>Projects page</div>} />
                </Routes>
            </AuthProvider>
        </MemoryRouter>
        </QueryClientProvider>,
    );
};

const submitLoginForm = () => {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
};

describe('LoginForm redirect', () => {
    beforeEach(() => {
        mockedLogin.mockResolvedValue({
            message: 'ok', userId: 1, email: 'user@example.com', name: 'Test User',
        });
        mockedGetCurrentUser.mockResolvedValue(currentUser);
    });

    afterEach(() => {
        window.history.replaceState({}, '', '/');
        jest.clearAllMocks();
    });

    test('a same-origin ?next= target is decoded and navigated to after login', async () => {
        renderLoginAt('/login?next=%2Fprojects%3FselectedIssue%3DWEB-42');
        submitLoginForm();

        await waitFor(() =>
            expect(screen.getByTestId('location')).toHaveTextContent('/projects?selectedIssue=WEB-42'));
    });

    test('an absolute off-origin ?next= falls back to /dashboard instead of navigating there', async () => {
        renderLoginAt('/login?next=https://evil.com');
        submitLoginForm();

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard'));
        expect(screen.getByTestId('location')).not.toHaveTextContent('evil.com');
        expect(window.location.origin).toBe('http://localhost');
        expect(window.location.href).not.toContain('http://evil.com');
    });

    test('a protocol-relative ?next=//evil.com falls back to /dashboard', async () => {
        renderLoginAt('/login?next=//evil.com');
        submitLoginForm();

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard'));
        expect(screen.getByTestId('location')).not.toHaveTextContent('evil.com');
        expect(window.location.origin).toBe('http://localhost');
        expect(window.location.href).not.toContain('http://evil.com');
    });
});
