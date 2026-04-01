import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { pool } from '../config/database';
import guestRoutes from '../routes/guests';
import orderRoutes from '../routes/orders';
import paymentRoutes from '../routes/payments';
import cashRoutes from '../routes/cash';
import adminRoutes from '../routes/admin';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/guests', guestRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api', paymentRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/admin', adminRoutes);

afterAll(async () => {
  await pool.end();
});

describe('Health & Orders API', () => {
  let orderId: string;

  it('POST /api/guests/session - creates session', async () => {
    const res = await request(app)
      .post('/api/guests/session')
      .send({ qr_token: 'test-token', device_id: 'test-device' });

    expect(res.status).toBe(200);
    expect(res.body.session_token).toBeTruthy();
  });

  it('POST /api/guests/session - requires qr_token', async () => {
    const res = await request(app)
      .post('/api/guests/session')
      .send({});

    expect(res.status).toBe(400);
  });

  it('POST /api/orders - creates order', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        table_id: 'T-99',
        items: [
          { name: 'Test Pizza', price: 15.00, quantity: 2 },
          { name: 'Test Drink', price: 3.50, quantity: 1 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.table_number).toBe('T-99');
    expect(parseFloat(res.body.total_amount)).toBe(33.50);
    orderId = res.body.id;
  });

  it('GET /api/orders - lists orders', async () => {
    const res = await request(app).get('/api/orders');

    expect(res.status).toBe(200);
    expect(res.body.orders).toBeInstanceOf(Array);
    expect(res.body.orders.length).toBeGreaterThan(0);
  });

  it('PATCH /api/orders/:id - updates status', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}`)
      .send({ status: 'preparing' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('preparing');
  });

  it('PATCH /api/orders/:id - 404 for unknown order', async () => {
    const res = await request(app)
      .patch('/api/orders/00000000-0000-0000-0000-000000000000')
      .send({ status: 'preparing' });

    expect(res.status).toBe(404);
  });

  it('DELETE /api/orders/:id - cancels unpaid order', async () => {
    // Create a fresh order to cancel
    const createRes = await request(app)
      .post('/api/orders')
      .send({ table_id: 'T-CANCEL', items: [{ name: 'Cancel Test', price: 5 }] });

    const res = await request(app).delete(`/api/orders/${createRes.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('DELETE /api/orders/:id - rejects cancelling paid order', async () => {
    // Create and pay an order
    const createRes = await request(app)
      .post('/api/orders')
      .send({ table_id: 'T-NODEL', items: [{ name: 'No Delete', price: 10 }] });

    await request(app)
      .post(`/api/orders/${createRes.body.id}/payment`)
      .send({ amount: 10, method: 'card', idempotency_key: `cancel-test-${Date.now()}` });

    const res = await request(app).delete(`/api/orders/${createRes.body.id}`);
    expect(res.status).toBe(409);
  });
});

describe('Payments API', () => {
  let orderId: string;
  let paymentId: string;
  const testRun = Date.now();

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ table_id: 'T-PAY', items: [{ name: 'Pay Test', price: 20.00 }] });
    orderId = res.body.id;
  });

  it('POST /api/orders/:id/payment - processes payment', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .send({ amount: 20.00, method: 'card', idempotency_key: `test-key-${testRun}` });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.status).toBe('completed');
    paymentId = res.body.id;
  });

  it('POST /api/orders/:id/payment - idempotency returns same payment', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .send({ amount: 20.00, method: 'card', idempotency_key: `test-key-${testRun}` });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(paymentId);
  });

  it('POST /api/orders/:id/payment - rejects double payment', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/payment`)
      .send({ amount: 20.00, method: 'card', idempotency_key: `test-key-${testRun}-2` });

    expect(res.status).toBe(409);
  });

  it('POST /api/orders/:id/payment - rejects invalid method', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .send({ table_id: 'T-X', items: [{ name: 'X', price: 5 }] });

    const res = await request(app)
      .post(`/api/orders/${orderRes.body.id}/payment`)
      .send({ amount: 5, method: 'bitcoin' });

    expect(res.status).toBe(400);
  });

  it('GET /api/orders/:id/payments - lists payments', async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}/payments`);

    expect(res.status).toBe(200);
    expect(res.body.payments.length).toBe(1);
  });

  it('POST /api/payments/:id/refund - refunds payment', async () => {
    const res = await request(app)
      .post(`/api/payments/${paymentId}/refund`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('refunded');
  });

  it('POST /api/payments/:id/refund - rejects double refund', async () => {
    const res = await request(app)
      .post(`/api/payments/${paymentId}/refund`);

    expect(res.status).toBe(409);
  });
});

describe('Cash Management API', () => {
  it('POST /api/cash/open - opens cash session', async () => {
    // Close any existing session first
    await request(app).post('/api/cash/close').send({ closing_amount: 0 });

    const res = await request(app)
      .post('/api/cash/open')
      .send({ opening_amount: 100.00 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
    expect(parseFloat(res.body.opening_amount)).toBe(100.00);
  });

  it('POST /api/cash/open - rejects duplicate open', async () => {
    const res = await request(app)
      .post('/api/cash/open')
      .send({ opening_amount: 50 });

    expect(res.status).toBe(409);
  });

  it('GET /api/cash/current - shows current session', async () => {
    const res = await request(app).get('/api/cash/current');

    expect(res.status).toBe(200);
    expect(res.body.session).toBeTruthy();
    expect(res.body.session.status).toBe('open');
  });

  it('POST /api/cash/close - closes session with summary', async () => {
    const res = await request(app)
      .post('/api/cash/close')
      .send({ closing_amount: 105.00, notes: 'End of shift test' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('closed');
    expect(res.body.difference).toBeDefined();
  });

  it('GET /api/cash/history - lists closed sessions', async () => {
    const res = await request(app).get('/api/cash/history');

    expect(res.status).toBe(200);
    expect(res.body.sessions).toBeInstanceOf(Array);
  });
});

describe('Admin API', () => {
  it('GET /api/admin/metrics - returns dashboard metrics', async () => {
    const res = await request(app).get('/api/admin/metrics');

    expect(res.status).toBe(200);
    expect(res.body.date).toBeTruthy();
    expect(res.body.orders).toBeDefined();
    expect(res.body.revenue).toBeDefined();
    expect(res.body.revenue.total).toBeDefined();
  });

  it('GET /api/admin/metrics/weekly - returns weekly data', async () => {
    const res = await request(app).get('/api/admin/metrics/weekly');

    expect(res.status).toBe(200);
    expect(res.body.days).toBeInstanceOf(Array);
  });

  it('GET /api/admin/audit - returns audit events', async () => {
    const res = await request(app).get('/api/admin/audit');

    expect(res.status).toBe(200);
    expect(res.body.events).toBeInstanceOf(Array);
    expect(res.body.total).toBeDefined();
  });

  it('GET /api/admin/audit?entity_type=order - filters audit events', async () => {
    const res = await request(app).get('/api/admin/audit?entity_type=order');

    expect(res.status).toBe(200);
    expect(res.body.events).toBeInstanceOf(Array);
  });

  it('POST /api/admin/leaderboard/score - adds staff score', async () => {
    const uniqueName = `Staff-${Date.now()}`;
    const res = await request(app)
      .post('/api/admin/leaderboard/score')
      .send({ username: uniqueName, points: 50, orders_served: 5, tips_earned: 12.50 });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe(uniqueName);
    expect(res.body.points).toBe(50);

    // Accumulate
    const res2 = await request(app)
      .post('/api/admin/leaderboard/score')
      .send({ username: uniqueName, points: 30, orders_served: 3, tips_earned: 8 });

    expect(res2.status).toBe(200);
    expect(res2.body.points).toBe(80); // 50 + 30
  });

  it('GET /api/admin/leaderboard - returns leaderboard', async () => {
    const res = await request(app).get('/api/admin/leaderboard');

    expect(res.status).toBe(200);
    expect(res.body.leaderboard).toBeInstanceOf(Array);
    expect(res.body.leaderboard.length).toBeGreaterThan(0);
  });
});
