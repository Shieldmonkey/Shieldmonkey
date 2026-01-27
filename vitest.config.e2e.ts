import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        testTimeout: 60000,
        hookTimeout: 30000,
        fileParallelism: false,
        include: ['tests/e2e/**/*.test.ts'],
        reporters: ['verbose'],
    },
});
