import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
import fs from 'fs';

/**
 * dist ディレクトリ内の index.html 以外の不要な中間ファイルを削除するプラグイン
 */
function cleanExtraDistFiles(): Plugin {
  return {
    name: 'clean-extra-dist-files',
    closeBundle() {
      const distDir = path.resolve(__dirname, './dist');
      if (fs.existsSync(distDir)) {
        const files = fs.readdirSync(distDir);
        for (const file of files) {
          if (file !== 'index.html') {
            const filePath = path.join(distDir, file);
            fs.rmSync(filePath, { recursive: true, force: true });
          }
        }
      }
    },
  };
}

/**
 * Vite の設定定義
 * React プラグイン、単一 HTML 出力プラグイン、およびパスエイリアスの設定を実施
 */
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile(), cleanExtraDistFiles()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  worker: {
    format: 'es',
  },
});
