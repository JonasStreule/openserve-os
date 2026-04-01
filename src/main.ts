import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { testConnection } from './config/database';
import { wsService } from './services/WebSocketService';
import guestRoutes from './routes/guests';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import cashRoutes from './routes/cash';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/guests', guestRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api', paymentRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/admin', adminRoutes);

// Error Handler
app.use((err: any, req: any, res: any, next: any) => {
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
