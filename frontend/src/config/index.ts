/**
 * Centralised configuration.
 *
 * `API_BASE_URL` is checked against `undefined` rather than for truthiness: the container build
 * passes an empty string on purpose, so the app issues same-origin relative requests and goes
 * through the reverse proxy. A `||` fallback treated that empty string as "unset" and hard-coded
 * localhost into the production bundle, bypassing the proxy entirely.
 */
const config = {
    API_BASE_URL: process.env.REACT_APP_API_URL ?? 'http://localhost:8080',

    /** Generous enough for a 10 MB multipart upload on a slow connection. */
    REQUEST_TIMEOUT_MS: 60_000,

    DEBOUNCE_DELAY: 300,
} as const;

export default config;
