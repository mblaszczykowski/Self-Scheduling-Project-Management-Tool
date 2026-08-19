const config = {
    API_BASE_URL: process.env.REACT_APP_API_URL ?? 'http://localhost:8080',

    REQUEST_TIMEOUT_MS: 60_000,

    DEBOUNCE_DELAY: 300,
} as const;

export default config;
