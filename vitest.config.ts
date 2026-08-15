import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest の設定定義
 * jsdom テスト環境、対象テストファイルの限定、およびパスエイリアスの統合を実施
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1,
      },
    },
    testTimeout: 30000,
    hookTimeout: 45000,
    teardownTimeout: 5000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
