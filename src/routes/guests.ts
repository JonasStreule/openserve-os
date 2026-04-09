import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../config/database';
import { wsService } from '../services/WebSocketService';

const router = Router();

router.post('/session', async (req, res) => {
  try {
    const { qr_token, device_id } = req.body;

    if (!qr_token) {
      res.status(400).json({ error: 'qr_token required' });
      return;
    }

    // Look up table by QR token
    const tableResult = await pool.query(
      'SELECT * FROM tables WHERE qr_token = $1',
      [qr_token]
    );

    const table = tableResult.rows[0];
    const tableNumber = table?.table_number || 'unknown';

    const sessionToken = randomUUID();
    res.json({
      session_id: sessionToken,
      table_number: tableNumber,
      session_token: sessionToken,
      expires_at: new Date(Date.now() + 8 * 3600000).toISOString()
    });
  } catch (error) {
    console.error('Session creation failed:', error);
    res.status(500).json({ error: 'Session creation failed' });
  }
});

// POST /api/guests/order — Guest order (no auth required)
router.post('/order', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { table_id, items } = req.body;

    if (!table_id || !items || !Array.isArray(items) || items.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'table_id and items required' });
      return;
    }

    // Verify table exists
    const tableCheck = await client.query('SELECT id FROM tables WHERE table_number = $1 OR id::text = $1', [table_id]);
    if (tableCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Table not found' });
      return;
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + (Math.max(0, parseFloat(item.price) || 0)) * (Math.max(1, parseInt(item.quantity, 10) || 1)), 0);

    // Daily order number
    const numResult = await client.query(
      `SELECT COALESCE(MAX(order_number), 0) + 1 AS next_num FROM orders WHERE created_at::date = CURRENT_DATE`
    );
    const orderNumber = numResult.rows[0].next_num;

    const orderResult = await client.query(
      `INSERT INTO orders (table_number, status, total_amount, payment_status, order_number)
       VALUES ($1, 'pending', $2, 'unpaid', $3)
       RETURNING *`,
      [table_id, totalAmount, orderNumber]
    );
    const order = orderResult.rows[0]!;

    for (const item of items) {
      if (item.product_id) {
        const prodResult = await client.query('SELECT station FROM products WHERE id = $1', [item.product_id]);
        const station = prodResult.rows[0]?.station || 'kitchen';
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, status, station)
           VALUES ($1, $2, $3, $4, 'pending', $5)`,
          [order.id, item.product_id, item.quantity || 1, item.price, station]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch full order with items
    const fullResult = await pool.query(
      `SELECT o.*, json_agg(json_build_object(
         'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity,
         'unit_price', oi.unit_price, 'status', oi.status, 'station', oi.station
       )) AS items
       FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1 GROUP BY o.id`,
      [order.id]
    );
    const fullOrder = fullResult.rows[0];

    wsService.notifyOrderCreated(fullOrder);
    res.status(201).json(fullOrder);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Guest order creation failed:', error);
    res.status(400).json({ error: 'Order creation failed' });
  } finally {
    client.release();
  }
});

export default router;
