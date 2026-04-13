import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { testConnection, pool } from './config/database';
import { wsService } from './services/WebSocketService';
import { requireAuth, requireRole } from './middleware/auth';
import authRoutes from './routes/auth';
import guestRoutes from './routes/guests';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import cashRoutes from './routes/cash';
import adminRoutes from './routes/admin';
import productRoutes from './routes/products';
import tableRoutes from './routes/tables';
import userRoutes from './routes/users';
import taskRoutes from './routes/tasks';

dotenv.config();

// ── Sentry (no-op if DSN not set) ────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.2,
  });
  console.log('Sentry initialised');
}

const app = express();
app.set('trust proxy', 1); // trust first proxy (Caddy) for correct client IP behind Cloudflare→Caddy
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ── CORS ──────────────────────────────────────────────────────
// In production set CORS_ORIGIN=https://pos.yourrestaurant.ch
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:80'];

// ── Security headers ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,  // CSP handled by frontend/Nginx in production
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, same-origin)
    if (!origin || process.env.NODE_ENV === 'development') return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '16kb' }));

// ── Rate limiting ─────────────────────────────────────────────
// Strict limit on login to prevent PIN brute-force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,                     // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// General API limiter — generous but stops abuse
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 minute
  max: 300,                    // 300 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) => req.path === '/api/health' || req.path === '/health',
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);

// ── Health check ──────────────────────────────────────────────
const healthHandler = async (_req: any, res: any) => {
  const start = Date.now();
  let dbStatus = 'ok';
  let dbLatencyMs = 0;
  try {
    await pool.query('SELECT 1');
    dbLatencyMs = Date.now() - start;
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    db: { status: dbStatus, latency_ms: dbLatencyMs },
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// ── Public routes ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/products', productRoutes);

// ── Protected routes ──────────────────────────────────────────
app.use('/api/orders', requireAuth, orderRoutes);
app.use('/api', requireAuth, paymentRoutes);
app.use('/api/cash', requireAuth, requireRole('admin', 'service'), cashRoutes);

// ── Admin-only routes ─────────────────────────────────────────
app.use('/api/admin', requireAuth, requireRole('admin'), adminRoutes);
app.use('/api/tables', requireAuth, tableRoutes);
app.use('/api/users', requireAuth, requireRole('admin'), userRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);

// ── Error handler ─────────────────────────────────────────────
app.use((err: any, _req: any, res: any, _next: any) => {
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ── Process error handlers ────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — shutting down:', err);
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  if (process.env.SENTRY_DSN) Sentry.captureException(reason);
});

// ── Graceful shutdown ─────────────────────────────────────────
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${signal} received — graceful shutdown started`);

  // 1. Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
  });

  // 2. Close WebSocket connections
  wsService.shutdown();

  // 3. Drain database pool
  try {
    await pool.end();
    console.log('Database pool drained');
  } catch (err) {
    console.error('Error draining DB pool:', err);
  }

  // 4. Force exit after 10s if still hanging
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ── Start ─────────────────────────────────────────────────────
wsService.init(server);

server.listen(PORT, async () => {
  console.log(`OpenServe OS server running on port ${PORT}`);
  console.log(`WebSocket server ready on ws://localhost:${PORT}`);
  console.log(`DB pool: max=${process.env.DB_POOL_MAX || 25}, min=${process.env.DB_POOL_MIN || 5}`);
  await testConnection();
});

export default app;
