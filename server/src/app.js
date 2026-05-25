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
const distPath  = path.resolve(__dirname, '../../dist');

export function createApp() {
  const app = express();

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

  // ── Request logging (development only) ───────────────────────────────────
  if (config.isDev) {
    app.use(morgan('dev'));
  }

  // ── Static file serving for uploads ──────────────────────────────────────
  const uploadsAbsPath = path.resolve(process.cwd(), config.uploadDir);
  app.use('/uploads', express.static(uploadsAbsPath));

  // ── Serve React frontend build in production
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
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

  // ── SPA catch-all — serve index.html for all non-API routes ─────────────
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
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
