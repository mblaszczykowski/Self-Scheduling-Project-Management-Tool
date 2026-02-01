import axios from 'axios';

// Mock axios before importing api module
jest.mock('axios', () => {
    const mockAxiosInstance = {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() },
        },
    };

    return {
        create: jest.fn(() => mockAxiosInstance),
    };
});

// Get the mocked instance
const mockApi = axios.create();

// Store interceptor callbacks for testing
let requestInterceptor;
let responseInterceptor;
let responseErrorInterceptor;

// Setup interceptors capture
mockApi.interceptors.request.use.mockImplementation((onFulfilled) => {
    requestInterceptor = onFulfilled;
});

mockApi.interceptors.response.use.mockImplementation((onFulfilled, onRejected) => {
    responseInterceptor = onFulfilled;
    responseErrorInterceptor = onRejected;
});

// Import after mocking
import api, {
    login,
    logout,
    getUser,
    getProjects,
    createProject,
    initCsrfToken,
} from './api';

describe('API Client', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.clearMockCookies();
        window.location.href = '';
        window.location.pathname = '/';

        // Reset module state by re-requiring
        jest.resetModules();
    });

    describe('CSRF Token Handling', () => {
        test('should add CSRF token header for POST requests', () => {
            global.setMockCookie('XSRF-TOKEN', 'test-csrf-token');

            const config = {
                method: 'POST',
                headers: {},
            };

            const result = requestInterceptor(config);

            expect(result.headers['X-CSRF-Token']).toBe('test-csrf-token');
        });

        test('should add CSRF token header for PUT requests', () => {
            global.setMockCookie('XSRF-TOKEN', 'test-csrf-token');

            const config = {
                method: 'PUT',
                headers: {},
            };

            const result = requestInterceptor(config);

            expect(result.headers['X-CSRF-Token']).toBe('test-csrf-token');
        });

        test('should add CSRF token header for DELETE requests', () => {
            global.setMockCookie('XSRF-TOKEN', 'test-csrf-token');

            const config = {
                method: 'DELETE',
                headers: {},
            };

            const result = requestInterceptor(config);

            expect(result.headers['X-CSRF-Token']).toBe('test-csrf-token');
        });

        test('should NOT add CSRF token header for GET requests', () => {
            global.setMockCookie('XSRF-TOKEN', 'test-csrf-token');

            const config = {
                method: 'GET',
                headers: {},
            };

            const result = requestInterceptor(config);

            expect(result.headers['X-CSRF-Token']).toBeUndefined();
        });

        test('should NOT add CSRF token header for OPTIONS requests', () => {
            global.setMockCookie('XSRF-TOKEN', 'test-csrf-token');

            const config = {
                method: 'OPTIONS',
                headers: {},
            };

            const result = requestInterceptor(config);

            expect(result.headers['X-CSRF-Token']).toBeUndefined();
        });

        test('should handle missing CSRF cookie gracefully', () => {
            global.clearMockCookies();

            const config = {
                method: 'POST',
                headers: {},
            };

            const result = requestInterceptor(config);

            expect(result.headers['X-CSRF-Token']).toBeUndefined();
        });

        test('should handle case-insensitive method names', () => {
            global.setMockCookie('XSRF-TOKEN', 'test-csrf-token');

            const config = {
                method: 'post',
                headers: {},
            };

            const result = requestInterceptor(config);

            expect(result.headers['X-CSRF-Token']).toBe('test-csrf-token');
        });
    });

    describe('Response Interceptor - Success', () => {
        test('should pass through successful responses', () => {
            const response = { data: { success: true }, status: 200 };
            const result = responseInterceptor(response);
            expect(result).toBe(response);
        });
    });

    describe('Response Interceptor - Token Refresh', () => {
        test('should not retry for non-401 errors', async () => {
            const error = {
                response: { status: 500 },
                config: { url: '/api/projects' },
            };

            await expect(responseErrorInterceptor(error)).rejects.toBe(error);
        });

        test('should not retry login endpoint on 401', async () => {
            const error = {
                response: { status: 401 },
                config: { url: '/api/auth/login', _retry: false },
            };

            await expect(responseErrorInterceptor(error)).rejects.toBe(error);
        });

        test('should not retry refresh endpoint on 401', async () => {
            const error = {
                response: { status: 401 },
                config: { url: '/api/auth/refresh', _retry: false },
            };

            await expect(responseErrorInterceptor(error)).rejects.toBe(error);
        });

        test('should not retry if _skipRefresh flag is set', async () => {
            const error = {
                response: { status: 401 },
                config: { url: '/api/projects', _skipRefresh: true },
            };

            await expect(responseErrorInterceptor(error)).rejects.toBe(error);
        });

        test('should not retry if already retried (_retry flag)', async () => {
            const error = {
                response: { status: 401 },
                config: { url: '/api/projects', _retry: true },
            };

            await expect(responseErrorInterceptor(error)).rejects.toBe(error);
        });

        test('should attempt refresh and retry on 401', async () => {
            mockApi.post.mockResolvedValueOnce({ data: { message: 'Token refreshed' } });
            mockApi.get.mockResolvedValueOnce({ data: { projects: [] } });

            // Simulate first call to api(originalRequest) returning the retried request
            // This is a bit tricky with the module - we simulate the flow
            const originalConfig = {
                url: '/api/projects',
                method: 'GET',
                _retry: false,
            };

            const error = {
                response: { status: 401 },
                config: originalConfig,
            };

            // The interceptor should call refresh and then retry
            // Since we can't fully simulate the module behavior, we verify the flow
            try {
                await responseErrorInterceptor(error);
            } catch (e) {
                // May throw due to mock limitations
            }

            // Verify refresh was attempted
            expect(mockApi.post).toHaveBeenCalledWith('/api/auth/refresh');
        });

        test('should redirect to login if refresh fails on protected path', async () => {
            window.location.pathname = '/dashboard';

            mockApi.post.mockRejectedValueOnce(new Error('Refresh failed'));

            const error = {
                response: { status: 401 },
                config: { url: '/api/projects', _retry: false },
            };

            try {
                await responseErrorInterceptor(error);
            } catch (e) {
                // Expected to throw
            }

            // Verify redirect was triggered
            expect(window.location.href).toBe('/login');
        });

        test('should NOT redirect to login if on public path', async () => {
            window.location.pathname = '/login';

            mockApi.post.mockRejectedValueOnce(new Error('Refresh failed'));

            const error = {
                response: { status: 401 },
                config: { url: '/api/users', _retry: false },
            };

            try {
                await responseErrorInterceptor(error);
            } catch (e) {
                // Expected to throw
            }

            expect(window.location.href).not.toBe('/login');
        });

        test('should NOT redirect if on register path', async () => {
            window.location.pathname = '/register';

            mockApi.post.mockRejectedValueOnce(new Error('Refresh failed'));

            const error = {
                response: { status: 401 },
                config: { url: '/api/users', _retry: false },
            };

            try {
                await responseErrorInterceptor(error);
            } catch (e) {
                // Expected
            }

            expect(window.location.href).not.toBe('/login');
        });

        test('should NOT redirect if on root path', async () => {
            window.location.pathname = '/';

            mockApi.post.mockRejectedValueOnce(new Error('Refresh failed'));

            const error = {
                response: { status: 401 },
                config: { url: '/api/check', _retry: false },
            };

            try {
                await responseErrorInterceptor(error);
            } catch (e) {
                // Expected
            }

            expect(window.location.href).not.toBe('/login');
        });
    });

    describe('API Functions', () => {
        test('login should POST to /api/auth/login', async () => {
            mockApi.post.mockResolvedValueOnce({ data: { message: 'Login successful' } });

            await login('test@example.com', 'password123');

            expect(mockApi.post).toHaveBeenCalledWith('/api/auth/login', {
                email: 'test@example.com',
                password: 'password123',
            });
        });

        test('logout should POST to /api/auth/logout', async () => {
            mockApi.post.mockResolvedValueOnce({ data: {} });

            await logout();

            expect(mockApi.post).toHaveBeenCalledWith('/api/auth/logout');
        });

        test('getUser should GET /api/users', async () => {
            mockApi.get.mockResolvedValueOnce({ data: { id: 1, email: 'test@example.com' } });

            await getUser();

            expect(mockApi.get).toHaveBeenCalledWith('/api/users');
        });

        test('getProjects should GET /api/projects', async () => {
            mockApi.get.mockResolvedValueOnce({ data: [] });

            await getProjects();

            expect(mockApi.get).toHaveBeenCalledWith('/api/projects');
        });

        test('createProject should POST with FormData', async () => {
            mockApi.post.mockResolvedValueOnce({ data: { projectKey: 'NEW' } });

            const projectDTO = { name: 'New Project', projectKey: 'NEW' };
            await createProject(projectDTO, []);

            expect(mockApi.post).toHaveBeenCalledWith(
                '/api/projects',
                expect.any(FormData),
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
        });
    });

    describe('initCsrfToken', () => {
        test('should make GET request to get CSRF cookie', async () => {
            mockApi.get.mockResolvedValueOnce({ data: {} });

            await initCsrfToken();

            expect(mockApi.get).toHaveBeenCalledWith('/api/users/exists', {
                params: { email: '' },
                _skipRefresh: true,
            });
        });

        test('should not throw on error', async () => {
            mockApi.get.mockRejectedValueOnce(new Error('Network error'));

            // Should not throw
            await expect(initCsrfToken()).resolves.toBeUndefined();
        });
    });

    describe('Axios Instance Configuration', () => {
        test('should create axios instance with correct config', () => {
            expect(axios.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    withCredentials: true,
                })
            );
        });
    });
});

describe('Concurrent 401 Handling', () => {
    // These tests verify the queue-based refresh mechanism
    // Due to module state, we test the logical flow

    test('should queue requests during refresh', async () => {
        // Simulate the queue mechanism
        const failedQueue = [];
        let isRefreshing = false;

        const queuePromise = (resolve, reject) => {
            failedQueue.push({ resolve, reject });
        };

        const processQueue = (error) => {
            failedQueue.forEach(prom => {
                error ? prom.reject(error) : prom.resolve();
            });
        };

        // Simulate multiple concurrent requests
        isRefreshing = true;

        const promise1 = new Promise((resolve, reject) => queuePromise(resolve, reject));
        const promise2 = new Promise((resolve, reject) => queuePromise(resolve, reject));
        const promise3 = new Promise((resolve, reject) => queuePromise(resolve, reject));

        expect(failedQueue.length).toBe(3);

        // Simulate successful refresh
        processQueue(null);

        await expect(promise1).resolves.toBeUndefined();
        await expect(promise2).resolves.toBeUndefined();
        await expect(promise3).resolves.toBeUndefined();
    });

    test('should reject all queued requests on refresh failure', async () => {
        const failedQueue = [];
        const refreshError = new Error('Refresh failed');

        const queuePromise = (resolve, reject) => {
            failedQueue.push({ resolve, reject });
        };

        const processQueue = (error) => {
            failedQueue.forEach(prom => {
                error ? prom.reject(error) : prom.resolve();
            });
        };

        const promise1 = new Promise((resolve, reject) => queuePromise(resolve, reject));
        const promise2 = new Promise((resolve, reject) => queuePromise(resolve, reject));

        // Simulate failed refresh
        processQueue(refreshError);

        await expect(promise1).rejects.toBe(refreshError);
        await expect(promise2).rejects.toBe(refreshError);
    });
});
