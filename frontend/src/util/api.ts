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

const api = axios.create({
    baseURL: config.API_BASE_URL,
    withCredentials: true,
    timeout: config.REQUEST_TIMEOUT_MS,
});

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

const refreshSession = (): Promise<unknown> => {
    if (!refreshPromise) {
        refreshPromise = api.post('/api/auth/refresh')
            .finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
};

const NO_REFRESH_PATHS = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'];

const redirectToLogin = () => {
    const publicPaths = ['/login', '/register', '/'];
    if (publicPaths.includes(window.location.pathname)) return;
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

        try {
            await refreshSession();
            return api(originalRequest);
        } catch (refreshError) {
            redirectToLogin();
            return Promise.reject(refreshError);
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

export const checkUserAuth = async (): Promise<CurrentUser> => {
    const probe = () =>
        api.get<CurrentUser>('/api/users/me', { _skipRefresh: true } as AxiosRequestConfig).then(body);
    try {
        return await probe();
    } catch (error) {
        if ((error as AxiosError).response?.status !== 401) throw error;
        await refreshSession();
        return probe();
    }
};

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

const PROJECT_PAGE_SIZE = 100;
const MAX_PROJECT_PAGES = 50;

export const getAllProjects = async (): Promise<Project[]> => {
    const first = await getProjects(0, PROJECT_PAGE_SIZE);
    if (!first.hasNext) {
        return first.content;
    }
    const wanted = Math.min(first.totalPages, MAX_PROJECT_PAGES);
    if (first.totalPages > MAX_PROJECT_PAGES) {
        console.warn('Loaded only the first %d of %d project pages', wanted, first.totalPages);
    }
    const rest = await Promise.all(
        Array.from({ length: wanted - 1 }, (_, index) => getProjects(index + 1, PROJECT_PAGE_SIZE)));
    return [first, ...rest].flatMap((page) => page.content);
};

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

export const getUnreadNotificationCount = () =>
    api.get<{ count: number }>('/api/notifications/unread-count').then(body);

export const markNotificationsAsRead = (notificationIds: number[]) =>
    api.post<void>('/api/notifications/mark-as-read', notificationIds).then(body);

export const markAllNotificationsRead = () =>
    api.post<{ count: number }>('/api/notifications/mark-all-read').then(body);

export const globalSearch = (query: string) =>
    api.get<SearchResults>('/api/search', { params: { q: query } }).then(body);

export const simulateOptimization = (request: OptimizationRequest) =>
    api.post<OptimizationResult>('/api/optimization/simulate', request).then(body);

export const applyOptimization = (request: ApplyOptimizationRequest) =>
    api.post<{ tasksUpdated: number }>('/api/optimization/apply', request).then(body);

export default api;
