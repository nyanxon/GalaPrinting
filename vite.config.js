import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Use VITE_API_URL if set, otherwise fall back to localhost:3001
  const backendTarget = env.VITE_API_URL || 'http://localhost:3001';

  return {
    plugins: [
      react(),
      // Generate .gz files for all assets — served by Express compression middleware
      compression({ algorithm: 'gzip' }),
    ],

    build: {
      // Explicit asset filenames — content-hashed so they can be cached forever.
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
          manualChunks: {
            // Core React ecosystem — loaded on every page
            'vendor-react': ['react', 'react-dom', 'react-router'],
            // HTTP + realtime
            'vendor-network': ['axios', 'socket.io-client'],
            // i18n — loaded eagerly (needed before first paint for translations)
            'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            // Heavy UI libraries — only needed on specific pages
            'vendor-emoji': ['emoji-mart', '@emoji-mart/data', '@emoji-mart/react'],
            'vendor-crop': ['react-easy-crop'],
          },
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
      // The server has its own vitest.config.js (node env, DB mocks). The root
      // config is the client (jsdom) suite, so never sweep server tests in here.
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/server/**',
      ],
    },
  };
});
