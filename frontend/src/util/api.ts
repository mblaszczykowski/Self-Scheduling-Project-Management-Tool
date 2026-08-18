import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import config from '../config';
import {
    Activity,
    ApplyOptimizationRequest,
    Comment,
    CurrentUser,
    EmailPreferencesPayload,
    Notification,
    OptimizationRequest,
    OptimizationResult,
    Paged,
    Project,
    ProjectPayload,
    ProfilePayload,
    ReactionType,
    RegistrationPayload,
    SearchResults,
    Task,
    TaskPayload,
} from '../types';

/**
 * The single HTTP boundary.
 *
 * Every function here declares what the server returns, so a DTO that drifts on the backend
 * becomes a compile error in the components that read it. Previously this file was untyped
 * JavaScript, which meant every response entered the app as `any` and the domain types in
 * `types.ts` were decorative everywhere except the two places that re-asserted them by hand.
 */
const api = axios.create({
    baseURL: config.API_BASE_URL,
    withCredentials: true,
    timeout: config.REQUEST_TIMEOUT_MS,
});

/** Axios passes unknown config keys straight through, which is how the retry flags travel. */
interface RetryableConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
    _skipRefresh?: boolean;
}

const readCookie = (name: string): string | null => {
    if (!document.cookie) return null;
    for (const entry of document.cookie.split('; ')) {
        const separator = entry.indexOf('=');
        if (separator < 0) continue;
        if (entry.slice(0, separator) === name) {
            const raw = entry.slice(separator + 1);
            try {
                return decodeURIComponent(raw);
            } catch {
                return raw;
            }
        }
    }
    return null;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

api.interceptors.request.use((requestConfig) => {
    const method = requestConfig.method?.toUpperCase();
    if (method && !SAFE_METHODS.has(method)) {
        const csrfToken = readCookie('XSRF-TOKEN');
        if (csrfToken) {
            requestConfig.headers.set('X-CSRF-Token', csrfToken);
        }
    }
    return requestConfig;
});

let refreshPromise: Promise<unknown> | null = null;

/**
 * Endpoints for which a 401 must not trigger a refresh: the two that mint the session, and
 * logout — where refreshing only to then discard the session produces a misleading "your session
 * expired" toast instead of a clean sign-out.
 */
const NO_REFRESH_PATHS = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'];

const redirectToLogin = () => {
    const publicPaths = ['/login', '/register', '/'];
    if (publicPaths.includes(window.location.pathname)) return;
    // Remember where the user was so they land back there after signing in.
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?expired=true&next=${next}`;
};

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as RetryableConfig | undefined;

        if (error.response?.status !== 401 || !originalRequest) {
            return Promise.reject(error);
        }
        if (originalRequest._retry
            || originalRequest._skipRefresh
            || NO_REFRESH_PATHS.includes(originalRequest.url ?? '')) {
            return Promise.reject(error);
        }
        originalRequest._retry = true;

        // Concurrent 401s share one refresh: the flag and the promise are read together with no
        // await in between, so there is no window for a second refresh to start.
        if (refreshPromise) {
            await refreshPromise;
            return api(originalRequest);
        }

        refreshPromise = api.post('/api/auth/refresh');
        try {
            await refreshPromise;
            // Retrying is safe even for a POST: the 401 came from the authentication filter,
            // before any handler ran, so the request was never processed.
            return api(originalRequest);
        } catch (refreshError) {
            redirectToLogin();
            return Promise.reject(refreshError);
        } finally {
            refreshPromise = null;
        }
    }
);

const body = <T>(response: AxiosResponse<T>): T => response.data;

const multipart = (data: unknown, attachments: File[], dataKey: string): FormData => {
    const formData = new FormData();
    formData.append(dataKey, JSON.stringify(data));
    attachments.forEach((file) => formData.append('attachments', file));
    return formData;
};

const MULTIPART: AxiosRequestConfig = { headers: { 'Content-Type': 'multipart/form-data' } };

export const login = (email: string, password: string) =>
    api.post<{ message: string; userId: number; email: string; name: string }>(
        '/api/auth/login', { email, password }).then(body);

export const logout = () => api.post<void>('/api/auth/logout').then(body);

export const register = (payload: RegistrationPayload) =>
    api.post<{ message: string; userId: number; email: string }>('/api/users', payload).then(body);

export const getCurrentUser = () => api.get<CurrentUser>('/api/users/me').then(body);

/**
 * The boot-time auth probe. Skips the 401 refresh so an anonymous visitor does not pay a wasted
 * round-trip, or get hard-redirected, before the router's own auth gate runs.
 */
export const checkUserAuth = () =>
    api.get<CurrentUser>('/api/users/me', { _skipRefresh: true } as AxiosRequestConfig).then(body);

export const updateProfile = (payload: ProfilePayload, profilePicture?: File | null) => {
    const formData = new FormData();
    formData.append('profile', JSON.stringify(payload));
    if (profilePicture) formData.append('profilePicture', profilePicture);
    return api.put<CurrentUser>('/api/users/me', formData, MULTIPART).then(body);
};

export const updateEmailPreferences = (preferences: EmailPreferencesPayload) =>
    api.patch<CurrentUser>('/api/users/me/email-preferences', preferences).then(body);

export const getProjects = (page = 0, size = 100) =>
    api.get<Paged<Project>>('/api/projects', { params: { page, size } }).then(body);

export const getProject = (projectKey: string) =>
    api.get<Project>(`/api/projects/${encodeURIComponent(projectKey)}`).then(body);

export const createProject = (payload: ProjectPayload, attachments: File[] = []) =>
    api.post<Project>('/api/projects', multipart(payload, attachments, 'projectDTO'), MULTIPART)
        .then(body);

export const updateProject = (projectKey: string, payload: ProjectPayload, attachments: File[] = []) =>
    api.put<Project>(`/api/projects/${encodeURIComponent(projectKey)}`,
        multipart(payload, attachments, 'projectDTO'), MULTIPART).then(body);

export const deleteProject = (projectKey: string) =>
    api.delete<void>(`/api/projects/${encodeURIComponent(projectKey)}`).then(body);

export const createTask = (projectKey: string, payload: TaskPayload, attachments: File[] = []) =>
    api.post<Task>(`/api/projects/${encodeURIComponent(projectKey)}/tasks`,
        multipart(payload, attachments, 'taskDTO'), MULTIPART).then(body);

export const updateTask = (projectKey: string, taskKey: string, payload: TaskPayload,
                           attachments: File[] = []) =>
    api.put<Task>(`/api/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(taskKey)}`,
        multipart(payload, attachments, 'taskDTO'), MULTIPART).then(body);

/**
 * Moves a task in time and nothing else.
 *
 * The timeline drag uses this rather than the full update, which is what stops a drag from
 * resetting the fields it never intended to send.
 */
export const updateTaskSchedule = (projectKey: string, taskKey: string,
                                   startDate: string, dueDate: string) =>
    api.patch<Task>(
        `/api/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(taskKey)}/schedule`,
        { startDate, dueDate }).then(body);

export const deleteTask = (projectKey: string, taskKey: string) =>
    api.delete<void>(
        `/api/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(taskKey)}`)
        .then(body);

export const getComments = (taskId: number, page = 0, size = 50) =>
    api.get<Paged<Comment>>(`/api/tasks/${taskId}/comments`, { params: { page, size } }).then(body);

export const createComment = (taskId: number, content: string, attachments: File[] = [],
                              parentCommentId?: number | null) => {
    const formData = new FormData();
    formData.append('content', content);
    attachments.forEach((file) => formData.append('attachments', file));
    const params = parentCommentId ? { parentCommentId } : undefined;
    return api.post<Comment>(`/api/tasks/${taskId}/comments`, formData, { ...MULTIPART, params })
        .then(body);
};

export const updateComment = (taskId: number, commentId: number, content: string,
                              attachments: File[] = []) => {
    const formData = new FormData();
    formData.append('content', content);
    attachments.forEach((file) => formData.append('attachments', file));
    return api.put<Comment>(`/api/tasks/${taskId}/comments/${commentId}`, formData, MULTIPART)
        .then(body);
};

export const deleteComment = (taskId: number, commentId: number) =>
    api.delete<void>(`/api/tasks/${taskId}/comments/${commentId}`).then(body);

export const reactToComment = (taskId: number, commentId: number, type: ReactionType) =>
    api.post<Comment>(`/api/tasks/${taskId}/comments/${commentId}/reactions`, null, { params: { type } })
        .then(body);

export const getTaskActivities = (taskId: number, page = 0, size = 50) =>
    api.get<Paged<Activity>>(`/api/tasks/${taskId}/activities`, { params: { page, size } }).then(body);

export const getNotifications = (page = 0, size = 50) =>
    api.get<Paged<Notification>>('/api/notifications', { params: { page, size } }).then(body);

/** From the database, so the badge does not under-count once a user passes one page. */
export const getUnreadNotificationCount = () =>
    api.get<{ count: number }>('/api/notifications/unread-count').then(body);

export const markNotificationsAsRead = (notificationIds: number[]) =>
    api.post<void>('/api/notifications/mark-as-read', notificationIds).then(body);

export const globalSearch = (query: string) =>
    api.get<SearchResults>('/api/search', { params: { q: query } }).then(body);

export const simulateOptimization = (request: OptimizationRequest) =>
    api.post<OptimizationResult>('/api/optimization/simulate', request).then(body);

/**
 * Applies an optimization by asking the server to recompute it, rather than sending dates back.
 * What lands in the database is then feasible by construction.
 */
export const applyOptimization = (request: ApplyOptimizationRequest) =>
    api.post<{ tasksUpdated: number }>('/api/optimization/apply', request).then(body);

export default api;
