import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// Custom plugin to copy manifest.json to dist
function copyManifestPlugin() {
  return {
    name: 'copy-manifest',
    writeBundle() {
      fs.copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(__dirname, 'dist/manifest.json')
      );
      console.log('[Vite Build] Copied manifest.json to dist/');
    },
  };
}

export default defineConfig({
  plugins: [react(), copyManifestPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background/background.js'),
        leetcode: resolve(__dirname, 'src/content/leetcode.js'),
        codeforces: resolve(__dirname, 'src/content/codeforces.js'),
        atcoder: resolve(__dirname, 'src/content/atcoder.js'),
        codechef: resolve(__dirname, 'src/content/codechef.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (['background', 'leetcode', 'codeforces', 'atcoder', 'codechef'].includes(chunkInfo.name)) {
            return `src/${chunkInfo.name === 'background' ? 'background' : 'content'}/${chunkInfo.name}.js`;
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
