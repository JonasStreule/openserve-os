import { Router } from 'express';
import { pool } from '../config/database';
import { wsService } from '../services/WebSocketService';

const router = Router();

// Generate daily order number (#001, #002, ... resets each day)
async function getNextOrderNumber(client: any): Promise<number> {
  const result = await client.query(
    `SELECT COALESCE(MAX(order_number), 0) + 1 AS next_num
     FROM orders
     WHERE created_at::date = CURRENT_DATE`
  );
  return result.rows[0].next_num;
}

// Check if all items of an order are ready → auto-set order to 'ready'
async function checkAutoReady(client: any, orderId: string) {
  const result = await client.query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'ready') AS ready_count,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count
     FROM order_items WHERE order_id = $1`,
    [orderId]
  );
  const { total, ready_count, cancelled_count } = result.rows[0];
  const activeItems = parseInt(total) - parseInt(cancelled_count);

  // All active items are ready → mark order as ready
  if (activeItems > 0 && parseInt(ready_count) >= activeItems) {
    const orderCheck = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    const currentStatus = orderCheck.rows[0]?.status;
    if (currentStatus === 'preparing' || currentStatus === 'pending') {
      await client.query(
        `UPDATE orders SET status = 'ready', updated_at = NOW() WHERE id = $1`,
        [orderId]
      );
      return true; // Order was auto-set to ready
    }
  }

  // If at least one item is preparing, ensure order is 'preparing'
  const preparingCheck = await client.query(
    `SELECT COUNT(*) FILTER (WHERE status = 'preparing') AS prep_count,
            COUNT(*) FILTER (WHERE status = 'ready') AS ready_count
     FROM order_items WHERE order_id = $1 AND status != 'cancelled'`,
    [orderId]
  );
  if (parseInt(preparingCheck.rows[0].prep_count) > 0 || parseInt(preparingCheck.rows[0].ready_count) > 0) {
    const orderCheck = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    if (orderCheck.rows[0]?.status === 'pending') {
      await client.query(
        `UPDATE orders SET status = 'preparing', updated_at = NOW() WHERE id = $1`,
        [orderId]
      );
    }
  }

  return false;
}

// POST /api/orders - Create order
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { table_id, items } = req.body;

    if (!table_id || !items || !Array.isArray(items)) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'table_id and items required' });
      return;
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1), 0);
    const orderNumber = await getNextOrderNumber(client);

    const orderResult = await client.query(
      `INSERT INTO orders (table_number, status, total_amount, payment_status, order_number)
       VALUES ($1, 'pending', $2, 'unpaid', $3)
       RETURNING *`,
      [table_id, totalAmount, orderNumber]
    );

    const order = orderResult.rows[0]!;

    // Insert order items with station from product
    for (const item of items) {
      if (item.product_id) {
        // Look up product station
        const prodResult = await client.query(
          'SELECT station FROM products WHERE id = $1',
          [item.product_id]
        );
        const station = prodResult.rows[0]?.station || 'kitchen';

        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, status, station)
           VALUES ($1, $2, $3, $4, 'pending', $5)`,
          [order.id, item.product_id, item.quantity || 1, item.price, station]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch full order with items for response
    const fullOrder = await getFullOrder(order.id);
    wsService.notifyOrderCreated(fullOrder);
    res.status(201).json(fullOrder);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Order creation failed:', error);
    res.status(400).json({ error: 'Order creation failed' });
  } finally {
    client.release();
  }
});

// Helper: get full order with items
async function getFullOrder(orderId: string) {
  const result = await pool.query(
    `SELECT o.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity,
            'unit_price', oi.unit_price, 'name', p.name, 'status', oi.status,
            'station', oi.station, 'category', p.category
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.id = $1
     GROUP BY o.id`,
    [orderId]
  );
  return result.rows[0];
}

// GET /api/orders - List orders with items (includes station + order_number)
router.get('/', async (req, res) => {
  try {
    const station = req.query.station as string; // optional: 'kitchen' or 'bar'

    const result = await pool.query(
      `SELECT o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity,
              'unit_price', oi.unit_price, 'name', p.name, 'status', oi.status,
              'station', oi.station, 'category', p.category
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );

    let orders = result.rows;

    // If station filter is set, only return orders that have items for that station
    if (station) {
      orders = orders
        .map(order => ({
          ...order,
          items: order.items.filter((item: any) => item.station === station),
        }))
        .filter(order => order.items.length > 0);
    }

    res.json({ orders });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Single order
router.get('/:id', async (req, res) => {
  try {
    const order = await getFullOrder(req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PATCH /api/orders/:id - Update order status
router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      pending: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: [],
    };

    const current = await pool.query('SELECT status FROM orders WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const currentStatus = current.rows[0]!.status;
    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `Cannot transition from '${currentStatus}' to '${status}'` });
      return;
    }

    const result = await pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // If order is cancelled, also cancel all pending items
    if (status === 'cancelled') {
      await pool.query(
        `UPDATE order_items SET status = 'cancelled' WHERE order_id = $1 AND status != 'ready'`,
        [req.params.id]
      );
    }

    const fullOrder = await getFullOrder(req.params.id);
    wsService.notifyOrderUpdated(fullOrder);
    res.json(fullOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// ─── ITEM-LEVEL STATUS ────────────────────────────────────────
// PATCH /api/orders/:orderId/items/:itemId - Update single item status
router.patch('/:orderId/items/:itemId', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { status } = req.body;
    const validStatuses = ['pending', 'preparing', 'ready', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: `Item status must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    // Verify item belongs to order
    const itemResult = await client.query(
      'SELECT * FROM order_items WHERE id = $1 AND order_id = $2',
      [req.params.itemId, req.params.orderId]
    );
    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Update item status
    await client.query(
      'UPDATE order_items SET status = $1 WHERE id = $2',
      [status, req.params.itemId]
    );

    // Check if all items are ready → auto-set order to ready
    const autoReady = await checkAutoReady(client, req.params.orderId);

    await client.query('COMMIT');

    // Fetch and broadcast updated order
    const fullOrder = await getFullOrder(req.params.orderId);
    wsService.notifyOrderUpdated(fullOrder);

    if (autoReady) {
      wsService.broadcast('service', 'order:ready', fullOrder);
    }

    res.json(fullOrder);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to update item status:', error);
    res.status(500).json({ error: 'Failed to update item status' });
  } finally {
    client.release();
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
      `UPDATE order_items SET status = 'cancelled' WHERE order_id = $1`,
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
