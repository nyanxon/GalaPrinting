import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'VanillaJS-Code']),

  // ── Frontend (React + browser globals) ─────────────────────────────────────
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Must be last — disables ESLint rules that would conflict with Prettier
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Calling setState inside useEffect is a valid and common React pattern
      // for initialising state from synchronous data sources (localStorage, etc.)
      'react-hooks/set-state-in-effect': 'off',
      // Allow intentionally unused variables/parameters prefixed with _
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // Context files intentionally export both the context object and the
      // provider component from the same file — disable the fast-refresh rule
      // for those files via per-file override below.
    },
  },

  // ── Backend (Node.js globals) ───────────────────────────────────────────────
  // The server/ directory and Vite/build config files run in Node — they use
  // Node built-ins (process, crypto, Buffer, etc.) and must not be linted
  // with browser globals.
  {
    files: ['server/**/*.js', 'vite.config.js', 'vite.config.ts', 'eslint.config.js'],
    extends: [js.configs.recommended, prettier],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },

  // ── Context files (fast-refresh exception) ──────────────────────────────────
  {
    // Context files export both context and provider — fast-refresh rule
    // does not apply here because these are not hot-reloaded leaf components.
    files: ['src/components/context/*.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
