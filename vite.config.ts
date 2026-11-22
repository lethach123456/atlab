import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'emit-demo-dashboard',
        closeBundle() {
          const dist = path.resolve(__dirname, 'dist');
          const index = path.join(dist, 'index.html');
          const destDir = path.join(dist, 'demo-dashboard');
          if (!fs.existsSync(index)) return;
          fs.mkdirSync(destDir, { recursive: true });
          fs.copyFileSync(index, path.join(destDir, 'index.html'));
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
