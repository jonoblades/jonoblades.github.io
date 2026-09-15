import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['html', 'lcov', 'text'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    },
    exclude: ['node_modules', '_site/**']
  },
  resolve: {
    alias: {
      // Redirect the app's absolute BaseClass import to the test double.
      '/scripts/BaseClass.js': fileURLToPath(
        new URL('./tests/mocks/BaseClass.js', import.meta.url),
      ),
    },
  },
});