import '@testing-library/jest-dom';

delete window.location;
window.location = {
    href: 'http://localhost/',
    origin: 'http://localhost',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
};

Object.defineProperty(document, 'visibilityState', {
    writable: true,
    value: 'visible',
});

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

global.clearMockCookies = () => {
    cookies = {};
};

global.setMockCookie = (name, value) => {
    cookies[name] = value;
};

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
