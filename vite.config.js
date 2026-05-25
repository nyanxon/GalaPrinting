import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Use VITE_API_URL if set, otherwise fall back to localhost:3001
  const backendTarget = env.VITE_API_URL || 'http://localhost:3001';

  return {
    plugins: [react()],

    server: {
      allowedHosts: 'all',
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          cookieDomainRewrite: 'localhost',
        },
        '/uploads': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: backendTarget,
          ws: true,
          changeOrigin: true,
          cookieDomainRewrite: 'localhost',
        },
      },
    },

    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.js'],
      globals: true,
    },
  };
});
