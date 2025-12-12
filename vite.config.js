import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  const buildConfig = {
    outDir: 'dist',
    emptyOutDir: true,
  };

  if (isProduction) {
    buildConfig.esbuild = {
      drop: ['console', 'debugger']
    };
  }

  return {
    root: '.',
    publicDir: 'public',
    build: buildConfig,
    server: {
      port: 3000,
      strictPort: true,
      open: true,
      fs: {
        strict: false
      },
      // Proxy API requests to local server in dev, production API in build
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});

