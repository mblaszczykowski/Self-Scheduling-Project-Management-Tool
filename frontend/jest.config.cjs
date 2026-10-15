module.exports = {
    testEnvironment: 'jsdom',
    testEnvironmentOptions: { url: 'http://localhost/' },
    roots: ['<rootDir>/src'],
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
    transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
    moduleNameMapper: {
        '\\.(css|less)$': '<rootDir>/test/styleMock.cjs',
        '\\.(svg|png|jpe?g|gif|webp)$': '<rootDir>/test/fileMock.cjs',
    },
    clearMocks: true,
};
