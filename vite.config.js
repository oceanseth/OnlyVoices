import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  const buildConfig = {
    outDir: 'dist',
    emptyOutDir: true,
  };

  if (isProduction) {
    buildConfig.esbuild = {
      drop: ['debugger']
    };
  }

  return {
    root: '.',
    publicDir: 'public',
    plugins: [react()],
    build: buildConfig,
    server: {
      port: 3000,
      strictPort: true,
      open: true,
      fs: {
        strict: false
      },
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          secure: false
        }
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: true,
    }
  };
});
