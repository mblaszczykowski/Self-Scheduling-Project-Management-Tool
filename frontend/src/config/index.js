// Centralised configuration - change these values for different environments
const config = {
    API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:8080',

    // UI defaults
    DEFAULT_PAGE_SIZE: 20,
    DEBOUNCE_DELAY: 300,
};

export default config;