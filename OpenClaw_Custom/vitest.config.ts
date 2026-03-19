import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,js}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': './src',
      '@core': './src/core',
      '@decorators': './src/decorators',
      '@hooks': './src/hooks',
      '@mitigations': './src/mitigations',
      '@strategies': './src/strategies',
      '@utils': './src/utils'
    }
  }
});
