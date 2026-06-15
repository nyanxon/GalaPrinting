/**
 * app.js — Express application factory.
 * Does NOT call app.listen — that is done in server.js.
 *
 * Requirements: 2.3, 2.4, 15.4
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes      from './routes/auth.routes.js';
import { productRouter as productRoutes, categoryRouter as categoryRoutes } from './routes/products.routes.js';
import orderRoutes     from './routes/orders.routes.js';
import cartRoutes      from './routes/cart.routes.js';
import chatRoutes      from './routes/chat.routes.js';
import reviewRoutes    from './routes/reviews.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import userRoutes      from './routes/users.routes.js';
import promoRoutes     from './routes/promo.routes.js';
import profileRoutes   from './routes/profile.routes.js';
import addressRoutes   from './routes/addresses.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Try multiple possible dist paths for different deployment structures
const distPath  = path.resolve(__dirname, '../../dist'); // Default: server/src/../dist
const altDistPath = path.resolve(__dirname, '../../../dist'); // Alternative: server/src/../../dist
const finalDistPath = fs.existsSync(distPath) ? distPath : (fs.existsSync(altDistPath) ? altDistPath : null);

export function createApp() {
  const app = express();

  // Trust Hostinger's reverse proxy so express-rate-limit and req.ip work correctly
  app.set('trust proxy', 1);

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    })
  );


  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ── Request logging ─────────────────────────────────────────────────────────
  if (config.isDev) {
    app.use(morgan('dev'));
  } else {
    // Simple logging in production
    app.use((req, res, next) => {
      console.log(`[app] ${req.method} ${req.path}`);
      next();
    });
  }

  // ── Static file serving for uploads ──────────────────────────────────────
  // Supports both absolute UPLOAD_DIR (production / Hostinger persistent path)
  // and relative paths (development). path.resolve handles both correctly.
  const uploadsAbsPath = path.isAbsolute(config.uploadDir)
    ? config.uploadDir
    : path.resolve(process.cwd(), config.uploadDir);
  app.use('/uploads', express.static(uploadsAbsPath));
  console.log(`[app] Serving uploads from: ${uploadsAbsPath}`);

  // ── Serve React frontend build ───────────────────────────────────────────────
  // In production on Hostinger, backend serves both API and frontend
  if (finalDistPath && fs.existsSync(finalDistPath)) {
    console.log(`[app] Serving frontend from: ${finalDistPath}`);
    app.use(express.static(finalDistPath));
  } else {
    console.warn('[app] Frontend dist directory not found. API only mode.');
  }

  // ── API routes ────────────────────────────────────────────────────────────
  app.use('/api/auth',          authRoutes);
  app.use('/api/products',      productRoutes);
  app.use('/api/categories',    categoryRoutes);
  app.use('/api/orders',        orderRoutes);
  app.use('/api/cart',          cartRoutes);
  app.use('/api/conversations',  chatRoutes);
  app.use('/api/reviews',       reviewRoutes);
  app.use('/api/analytics',     analyticsRoutes);
  app.use('/api/users',         userRoutes);
  app.use('/api/promo',         promoRoutes);
  app.use('/api/profile',       profileRoutes);
  app.use('/api/addresses',     addressRoutes);

  // ── SPA catch-all — serve index.html for all non-API routes ──────────────────
  // Must be declared AFTER API routes
  if (finalDistPath && fs.existsSync(path.join(finalDistPath, 'index.html'))) {
    app.get('*', (req, res) => {
      // Don't intercept API routes
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return res.status(404).json({ ok: false, message: 'Endpoint tidak ditemukan.' });
      }
      res.sendFile(path.join(finalDistPath, 'index.html'));
    });
  }

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ ok: false, message: 'Endpoint tidak ditemukan.' });
  });

  // ── Global error handler (must be last) ──────────────────────────────────
  app.use(errorHandler);

  return app;
}
