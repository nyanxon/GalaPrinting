import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Use VITE_API_URL if set, otherwise fall back to localhost:3001
  const backendTarget = env.VITE_API_URL || 'http://localhost:3001';

  return {
    plugins: [react()],

    build: {
      // Explicit asset filenames — content-hashed so they can be cached forever.
      // The hash changes when file content changes, making stale caches impossible.
      rollupOptions: {
        output: {
          // JS chunks: assets/[name]-[hash].js
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          // CSS and other assets: assets/[name]-[hash][extname]
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
      // Raise the inline threshold to 0 so no assets get inlined into HTML
      // (keeps all assets as separately-cacheable files with hashes)
      assetsInlineLimit: 0,
    },

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
      setupFiles: ['./src/test/setup.js'],
      globals: true,
    },
  };
});
