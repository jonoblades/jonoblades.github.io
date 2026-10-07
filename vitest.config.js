import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    testTimeout: 15000,
    coverage: {
      include: ['src/site/**/*.js', 'src/server/**/*.js'],
      exclude: ['src/server/dev.js', '**/.wrangler/**', '**/node_modules/**'],
      provider: 'v8',
      reporter: ['html', 'lcov', 'text'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    },
    exclude: ['node_modules', '_site/**'],
  },
  resolve: {
    alias: {
      // Redirect the app's absolute BaseClass import to the test double.
      '/scripts/BaseClass.js': fileURLToPath(
        new URL('./tests/mocks/BaseClass.js', import.meta.url),
      ),
      '/scripts': fileURLToPath(
        new URL('./src/site/scripts', import.meta.url),
      ),
    },
  },
});