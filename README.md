# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Hostinger deployment

This repo contains both the React frontend and the Node.js backend.

### Local development

1. Install frontend dependencies in the root:
   ```bash
   npm install
   ```
2. Install backend dependencies in `server`:
   ```bash
   cd server
   npm install
   ```
3. Start the frontend:
   ```bash
   npm run dev
   ```
4. Start the backend separately:
   ```bash
   cd server
   npm run dev
   ```

During development the frontend proxies `/api` to the backend.

### Local frontend env

For local Vite development, create a root `.env` with:

```bash
VITE_USE_BACKEND=true
```

If the frontend and backend are served from the same origin in production, you do not need `VITE_API_URL`.
Use `VITE_API_URL` only when the frontend is served from a different origin than the backend.

### Production deployment on Hostinger

1. Build the React app in the root:
   ```bash
   npm run build
   ```
2. Copy the generated `dist` folder to the project root if needed.
3. Install backend dependencies in `server`.
4. Configure Hostinger environment variables for the backend:
   - `DB_HOST`
   - `DB_PORT` (optional; defaults to `3306`)
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASSWORD`
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `CLIENT_ORIGIN` (optional; if using a separate frontend origin)
5. Start the backend on Hostinger with:
   ```bash
   cd server
   npm start
   ```

The backend will automatically serve the built React app from `dist` and expose API routes under `/api`.

### Clean migration notes

- Removed Supabase client/demo artifacts from the frontend.
- The app now relies on the existing MySQL backend in `server`.
- No Vercel or ngrok-specific deployment configuration is required.
