import { Router } from 'express';
import { pool } from '../config/database';
import { wsService } from '../services/WebSocketService';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { table_id, items } = req.body;

    if (!table_id || !items || !Array.isArray(items)) {
      res.status(400).json({ error: 'table_id and items required' });
      return;
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1), 0);

    const orderResult = await pool.query(
      `INSERT INTO orders (table_number, status, total_amount, payment_status)
       VALUES ($1, 'pending', $2, 'unpaid')
       RETURNING *`,
      [table_id, totalAmount]
    );

    const order = orderResult.rows[0]!;

    // Insert order items if products exist
    for (const item of items) {
      if (item.product_id) {
        await pool.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, status)
           VALUES ($1, $2, $3, $4, 'pending')`,
          [order.id, item.product_id, item.quantity || 1, item.price]
        );
      }
    }

    wsService.notifyOrderCreated(order);
    res.status(201).json(order);
  } catch (error) {
    console.error('Order creation failed:', error);
    res.status(400).json({ error: 'Order creation failed' });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*,
        COALESCE(
          json_agg(
            json_build_object('id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'name', p.name, 'status', oi.status)
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );
    res.json({ orders: result.rows });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const itemsResult = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]);

    res.json({ ...result.rows[0], items: itemsResult.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    wsService.notifyOrderUpdated(result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// DELETE /api/orders/:id - Cancel an order
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const order = result.rows[0]!;
    if (order.payment_status === 'paid') {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'Cannot cancel a paid order' });
      return;
    }

    await client.query(
      "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );

    await client.query(
      `INSERT INTO audit_events (entity_type, entity_id, event_type, old_value)
       VALUES ('order', $1, 'cancelled', $2)`,
      [req.params.id, JSON.stringify(order)]
    );

    await client.query('COMMIT');

    const cancelled = { ...order, status: 'cancelled' };
    wsService.notifyOrderUpdated(cancelled);
    res.json({ status: 'cancelled', order_id: req.params.id });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to cancel order' });
  } finally {
    client.release();
  }
});

export default router;
