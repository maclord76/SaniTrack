/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Plugin Vite pour copier le dossier api/ (fichiers PHP) dans le dossier de build
 */
function copyApiPlugin() {
  const apiFiles = [
    { srcDir: 'api', file: 'login.php' },
    { srcDir: 'api', file: 'pollen-proxy.php' },
    { srcDir: 'public/api', file: 'upload.php' },
  ];

  return {
    name: 'copy-api-files',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist', 'api');

      if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      
      for (const { srcDir, file } of apiFiles) {
        const srcPath = resolve(__dirname, srcDir, file);
        const destPath = resolve(outDir, file);
        if (existsSync(srcPath)) {
          copyFileSync(srcPath, destPath);
          console.log(`  ✓ Copié: ${srcDir}/${file} → dist/api/${file}`);
        }
      }
    }
  };
}

export default defineConfig({
  base: '',
  plugins: [react(), tailwindcss(), copyApiPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
