// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock window.location
delete window.location;
window.location = {
    href: '',
    pathname: '/',
    assign: jest.fn(),
    reload: jest.fn(),
};

// Mock document.visibilityState
Object.defineProperty(document, 'visibilityState', {
    writable: true,
    value: 'visible',
});

// Mock document.cookie
let cookies = {};
Object.defineProperty(document, 'cookie', {
    get: () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
    set: (value) => {
        const [nameValue] = value.split(';');
        const [name, val] = nameValue.split('=');
        if (val === '' || value.includes('Max-Age=0')) {
            delete cookies[name];
        } else {
            cookies[name] = val;
        }
    },
});

// Helper to clear cookies between tests
global.clearMockCookies = () => {
    cookies = {};
};

// Helper to set mock cookies
global.setMockCookie = (name, value) => {
    cookies[name] = value;
};

// Mock console.error to avoid noisy test output for expected errors
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = (...args) => {
        if (
            args[0]?.includes?.('Warning: ReactDOM.render is no longer supported') ||
            args[0]?.includes?.('Error refreshing')
        ) {
            return;
        }
        originalConsoleError(...args);
    };
});

afterAll(() => {
    console.error = originalConsoleError;
});
