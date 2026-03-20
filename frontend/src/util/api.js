import axios from 'axios';
import config from '../config';

const api = axios.create({
    baseURL: config.API_BASE_URL,
    withCredentials: true,
    timeout: 30000,
});

const getCsrfToken = () => {
    if (!document.cookie) return null;

    const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
        const [key, ...valueParts] = cookie.split('=');
        if (key && valueParts.length > 0) {
            acc[key] = valueParts.join('=');
        }
        return acc;
    }, {});

    const token = cookies['XSRF-TOKEN'];
    if (!token) return null;

    try {
        return decodeURIComponent(token);
    } catch {
        return token;
    }
};

api.interceptors.request.use((config) => {
    const method = config.method?.toUpperCase();

    if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
        }
    }

    return config;
});

let isRefreshing = false;
let refreshPromise = null;

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status !== 401) {
            return Promise.reject(error);
        }

        const skipRefreshUrls = ['/api/auth/login', '/api/auth/refresh'];
        if (originalRequest._retry || skipRefreshUrls.includes(originalRequest.url) || originalRequest._skipRefresh) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        if (isRefreshing) {
            return refreshPromise.then(() => api(originalRequest));
        }

        isRefreshing = true;
        refreshPromise = api.post('/api/auth/refresh');

        try {
            await refreshPromise;
            return api(originalRequest);
        } catch (refreshError) {
            const publicPaths = ['/login', '/register', '/'];
            if (!publicPaths.includes(window.location.pathname)) {
                window.location.href = '/login?expired=true';
            }
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    }
);

const createFormData = (data, attachments = [], dataKey = 'data') => {
    const formData = new FormData();
    formData.append(dataKey, JSON.stringify(data));
    attachments.forEach(file => formData.append('attachments', file));
    return formData;
};

export const getUser = () => api.get('/api/users').then(res => res.data);

export const checkUserAuth = getUser;

export const getUserByEmail = (email) =>
    api.get(`/api/users/${email}`).then(res => res.data);

export const updateUser = (formData) =>
    api.put('/api/users', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);

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

export const getNotifications = () =>
    api.get('/api/notifications').then(res => res.data);

export const markNotificationsAsRead = (notificationIds) =>
    api.post('/api/notifications/mark-as-read', notificationIds).then(res => res.data);

export const login = (email, password) =>
    api.post('/api/auth/login', { email, password }).then(res => res.data);

export const logout = () => api.post('/api/auth/logout');

export const register = (userData) =>
    api.post('/api/users', userData).then(res => res.data);

export const initCsrfToken = async () => {
    try {
        await api.get('/api/users/exists', { params: { email: '' }, _skipRefresh: true });
    } catch (e) {
    }
};

export const simulateOptimization = (requestDTO) =>
    api.post('/api/optimization/simulate', requestDTO).then(res => res.data);

export const applyOptimization = (suggestions) =>
    api.post('/api/optimization/apply', suggestions).then(res => res.data);

export default api;
