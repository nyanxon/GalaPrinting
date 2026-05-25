# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Vercel & Supabase

If you deploy the frontend to Vercel and use Supabase as your database, add the following environment variables in the Vercel project settings (or via the Vercel CLI). Vite requires env names that are exposed to the client to begin with `VITE_`.

- **VITE_SUPABASE_URL** — your Supabase project URL (example: `https://xxxx.supabase.co`)
- **VITE_SUPABASE_PUBLISHABLE_KEY** — your Supabase anon/publishable key
- **VITE_USE_BACKEND** — set to `false` when the frontend talks directly to Supabase (recommended for this repo)

Examples (Vercel CLI):

```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
vercel env add VITE_USE_BACKEND production
```

Local testing: keep a local `.env` file (do not commit it) with the same keys and run:

```bash
# install deps
npm install
# dev server
npm run dev
# build + preview
npm run build
npm run preview
```

Security: never commit secrets into the repository. Use Vercel's environment variables for production builds.
