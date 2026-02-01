import axios from 'axios';
import config from '../config';

// Single axios instance with proper configuration
const api = axios.create({
    baseURL: config.API_BASE_URL,
    withCredentials: true,
    timeout: 30000, // 30 second timeout to prevent indefinite waits
});

/**
 * Get CSRF token from cookie.
 * The server sets XSRF-TOKEN cookie on GET requests.
 * Uses proper cookie parsing with URL decoding for reliability.
 */
const getCsrfToken = () => {
    if (!document.cookie) return null;

    const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
        const [key, ...valueParts] = cookie.split('=');
        if (key && valueParts.length > 0) {
            acc[key] = valueParts.join('='); // Handle values containing '='
        }
        return acc;
    }, {});

    const token = cookies['XSRF-TOKEN'];
    if (!token) return null;

    try {
        return decodeURIComponent(token);
    } catch {
        return token; // Return raw value if decoding fails
    }
};

/**
 * Request interceptor to add CSRF token to state-changing requests.
 * This implements the Double-Submit Cookie pattern.
 */
api.interceptors.request.use((config) => {
    const method = config.method?.toUpperCase();

    // Add CSRF token for non-safe methods (POST, PUT, DELETE, PATCH)
    if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
        }
    }

    return config;
});

// Token refresh logic
let isRefreshing = false;
let failedQueue = [];
let refreshPromise = null;

const processQueue = (error) => {
    failedQueue.forEach(prom => {
        error ? prom.reject(error) : prom.resolve();
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Only handle 401 errors
        if (error.response?.status !== 401) {
            return Promise.reject(error);
        }

        // Don't retry if already retried or should skip refresh
        const skipRefreshUrls = ['/api/auth/login', '/api/auth/refresh'];
        if (originalRequest._retry || skipRefreshUrls.includes(originalRequest.url) || originalRequest._skipRefresh) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        // If already refreshing, wait for the current refresh to complete
        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then(() => api(originalRequest))
              .catch(err => Promise.reject(err));
        }

        isRefreshing = true;

        try {
            // Store refresh promise so all waiting requests use the same one
            refreshPromise = api.post('/api/auth/refresh');
            await refreshPromise;

            processQueue(null);
            return api(originalRequest);
        } catch (refreshError) {
            processQueue(refreshError);

            // Clear any stale auth state and redirect
            const publicPaths = ['/login', '/register', '/'];
            if (!publicPaths.includes(window.location.pathname)) {
                // Store message to show on login page
                sessionStorage.setItem('session_expired', 'Your session has expired. Please sign in again.');
                window.location.href = '/login';
            }
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    }
);

// Helper for multipart form data requests
const createFormData = (data, attachments = [], dataKey = 'data') => {
    const formData = new FormData();
    formData.append(dataKey, JSON.stringify(data));
    attachments.forEach(file => formData.append('attachments', file));
    return formData;
};

// ============ USER API ============
export const getUser = () => api.get('/api/users').then(res => res.data);

export const checkUserAuth = () =>
    api.get('/api/users').then(res => res.data);

export const getUserByEmail = (email) =>
    api.get(`/api/users/${email}`).then(res => res.data);

export const checkUserExists = (email) =>
    api.get('/api/users/exists', { params: { email } }).then(res => res.data.exists);

export const updateUser = (formData) =>
    api.put('/api/users', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);

// ============ PROJECT API ============
export const getProjects = () => api.get('/api/projects').then(res => res.data);

export const getProject = (projectKey) =>
    api.get(`/api/projects/${projectKey}`).then(res => res.data);

export const createProject = (projectDTO, attachments = []) =>
    api.post('/api/projects', createFormData(projectDTO, attachments, 'projectDTO'), {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);

export const updateProject = (projectKey, projectDTO, attachments = []) =>
    api.put(`/api/projects/${projectKey}`, createFormData(projectDTO, attachments, 'projectDTO'), {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);

export const deleteProject = (projectKey) =>
    api.delete(`/api/projects/${projectKey}`).then(res => res.data);

// ============ TASK API ============
export const createTask = (projectKey, taskDTO, attachments = []) =>
    api.post(`/api/projects/${projectKey}/tasks`, createFormData(taskDTO, attachments, 'taskDTO'), {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);

export const updateTask = (projectKey, taskKey, taskDTO, attachments = []) =>
    api.put(`/api/projects/${projectKey}/tasks/${taskKey}`, createFormData(taskDTO, attachments, 'taskDTO'), {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);

export const deleteTask = (projectKey, taskKey) =>
    api.delete(`/api/projects/${projectKey}/tasks/${taskKey}`).then(res => res.data);

export const getUserTasks = () => api.get('/api/tasks/assigned').then(res => res.data);

// ============ COMMENT API ============
export const getComments = (taskId) =>
    api.get(`/api/tasks/${taskId}/comments`).then(res => res.data);

export const createComment = (taskId, content, attachments = [], parentCommentId = null) => {
    const formData = new FormData();
    formData.append('content', content.content);
    attachments.forEach(file => formData.append('attachments', file));
    if (parentCommentId) formData.append('parentCommentId', parentCommentId);
    return api.post(`/api/tasks/${taskId}/comments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);
};

export const updateComment = (taskId, commentId, content, attachments = []) => {
    const formData = new FormData();
    formData.append('content', content.content);
    attachments.forEach(file => formData.append('attachments', file));
    return api.put(`/api/tasks/${taskId}/comments/${commentId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);
};

export const deleteComment = (taskId, commentId) =>
    api.delete(`/api/tasks/${taskId}/comments/${commentId}`).then(res => res.data);

export const reactToComment = (taskId, commentId, reactionType) =>
    api.post(`/api/tasks/${taskId}/comments/${commentId}/react`, null, {
        params: { type: reactionType }
    }).then(res => res.data);

// ============ NOTIFICATION API ============
export const getNotifications = () =>
    api.get('/api/notifications').then(res => res.data);

export const markNotificationsAsRead = (notificationIds) =>
    api.post('/api/notifications/mark-as-read', notificationIds).then(res => res.data);

// ============ AUTH API ============
export const login = (email, password) =>
    api.post('/api/auth/login', { email, password }).then(res => res.data);

export const logout = () => api.post('/api/auth/logout');

export const register = (userData) =>
    api.post('/api/users', userData).then(res => res.data);

/**
 * Initialize CSRF token by making a GET request.
 * Call this on app initialization to ensure CSRF token is set.
 */
export const initCsrfToken = async () => {
    try {
        // Any GET request will set the CSRF token cookie
        await api.get('/api/users/exists', { params: { email: '' }, _skipRefresh: true });
    } catch (e) {
        // Ignore errors - this is just to get the CSRF cookie
    }
};

// Export the axios instance for edge cases
export default api;