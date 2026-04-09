import { Router } from 'express';
import { pool } from '../config/database';
import { wsService } from '../services/WebSocketService';

const router = Router();

// POST /api/orders/:id/payment - Process payment for an order
router.post('/orders/:id/payment', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: orderId } = req.params;
    const { amount, method, tip, idempotency_key } = req.body;

    if (!amount || !method) {
      res.status(400).json({ error: 'amount and method required' });
      return;
    }

    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }

    if (tip !== undefined && tip !== null && (typeof tip !== 'number' || tip < 0)) {
      res.status(400).json({ error: 'tip must be a non-negative number' });
      return;
    }

    if (!['cash', 'card', 'twint'].includes(method)) {
      res.status(400).json({ error: 'method must be cash, card, or twint' });
      return;
    }

    await client.query('BEGIN');

    // Idempotency check - return existing payment if key already used
    if (idempotency_key) {
      const existing = await client.query(
        'SELECT * FROM payments WHERE idempotency_key = $1',
        [idempotency_key]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        res.json(existing.rows[0]);
        return;
      }
    }

    // Verify order exists and is unpaid (lock to prevent double-pay)
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const order = orderResult.rows[0]!;
    if (order.payment_status === 'paid') {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'Order already paid' });
      return;
    }

    // Create payment
    const paymentResult = await client.query(
      `INSERT INTO payments (order_id, amount, method, status, idempotency_key)
       VALUES ($1, $2, $3, 'completed', $4)
       RETURNING *`,
      [orderId, amount, method, idempotency_key || null]
    );

    // Update order payment status and tip
    const tipAmount = tip || 0;
    await client.query(
      `UPDATE orders SET payment_status = 'paid', tip_amount = $1, updated_at = NOW() WHERE id = $2`,
      [tipAmount, orderId]
    );

    // If cash payment, record cash transaction in active session
    if (method === 'cash') {
      const activeSession = await client.query(
        "SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1"
      );
      if (activeSession.rows.length > 0) {
        await client.query(
          `INSERT INTO cash_transactions (session_id, type, amount, payment_id, description)
           VALUES ($1, 'sale', $2, $3, $4)`,
          [activeSession.rows[0]!.id, amount, paymentResult.rows[0]!.id, `Payment for order ${orderId}`]
        );
        if (tipAmount > 0) {
          await client.query(
            `INSERT INTO cash_transactions (session_id, type, amount, payment_id, description)
             VALUES ($1, 'tip', $2, $3, $4)`,
            [activeSession.rows[0]!.id, tipAmount, paymentResult.rows[0]!.id, `Tip for order ${orderId}`]
          );
        }
      }
    }

    // Audit event
    await client.query(
      `INSERT INTO audit_events (entity_type, entity_id, event_type, new_value)
       VALUES ('order', $1, 'payment_completed', $2)`,
      [orderId, JSON.stringify({ amount, method, tip: tipAmount })]
    );

    await client.query('COMMIT');
    wsService.notifyPaymentCompleted(paymentResult.rows[0]);
    res.status(201).json(paymentResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Payment failed:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  } finally {
    client.release();
  }
});

// GET /api/orders/:id/payments - Get payments for an order
router.get('/orders/:id/payments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ payments: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /api/payments/:id/refund - Refund a payment
router.post('/payments/:id/refund', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const paymentResult = await client.query(
      'SELECT * FROM payments WHERE id = $1',
      [req.params.id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    const payment = paymentResult.rows[0]!;
    if (payment.status === 'refunded') {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'Payment already refunded' });
      return;
    }

    await client.query(
      "UPDATE payments SET status = 'refunded' WHERE id = $1",
      [req.params.id]
    );

    await client.query(
      "UPDATE orders SET payment_status = 'unpaid', updated_at = NOW() WHERE id = $1",
      [payment.order_id]
    );

    // Cash refund transaction
    if (payment.method === 'cash') {
      const activeSession = await client.query(
        "SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1"
      );
      if (activeSession.rows.length > 0) {
        await client.query(
          `INSERT INTO cash_transactions (session_id, type, amount, payment_id, description)
           VALUES ($1, 'refund', $2, $3, $4)`,
          [activeSession.rows[0]!.id, -payment.amount, req.params.id, `Refund for payment ${req.params.id}`]
        );
      }
    }

    await client.query(
      `INSERT INTO audit_events (entity_type, entity_id, event_type, old_value)
       VALUES ('payment', $1, 'refunded', $2)`,
      [req.params.id, JSON.stringify(payment)]
    );

    await client.query('COMMIT');
    res.json({ status: 'refunded', payment_id: req.params.id });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Refund failed' });
  } finally {
    client.release();
  }
});

export default router;
