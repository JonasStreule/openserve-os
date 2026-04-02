import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { testConnection } from './config/database';
import { wsService } from './services/WebSocketService';
import { requireAuth, requireRole } from './middleware/auth';
import authRoutes from './routes/auth';

// Sentry must be initialised before anything else (no-op if DSN not set)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.2,
  });
  console.log('Sentry initialised');
}
import guestRoutes from './routes/guests';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import cashRoutes from './routes/cash';
import adminRoutes from './routes/admin';
import productRoutes from './routes/products';
import tableRoutes from './routes/tables';
import userRoutes from './routes/users';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health Check (both paths for convenience)
const healthHandler = async (req: any, res: any) => {
  const start = Date.now();
  let dbStatus = 'ok';
  let dbLatencyMs = 0;
  try {
    const { pool } = await import('./config/database');
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

// Public routes (no auth needed)
app.use('/api/auth', authRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/products', productRoutes);  // Menu is public for guests

// Protected routes (require login)
app.use('/api/orders', requireAuth, orderRoutes);
app.use('/api', requireAuth, paymentRoutes);
app.use('/api/cash', requireAuth, requireRole('admin', 'service'), cashRoutes);

// Admin-only routes
app.use('/api/admin', requireAuth, requireRole('admin'), adminRoutes);
app.use('/api/tables', requireAuth, requireRole('admin'), tableRoutes);
app.use('/api/users', requireAuth, requireRole('admin'), userRoutes);

// Error handler — report to Sentry if configured, then respond
app.use((err: any, req: any, res: any, _next: any) => {
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Initialize WebSocket
wsService.init(server);

server.listen(PORT, async () => {
  console.log(`OpenServe OS server running on port ${PORT}`);
  console.log(`WebSocket server ready on ws://localhost:${PORT}`);
  await testConnection();
});

export default app;
