import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// POST /api/cash/open - Open a cash session (check-in)
router.post('/open', async (req, res) => {
  try {
    const { user_id, opening_amount } = req.body;

    // Check if there's already an open session
    const existing = await pool.query(
      "SELECT * FROM cash_sessions WHERE status = 'open'"
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'A cash session is already open', session: existing.rows[0] });
      return;
    }

    const result = await pool.query(
      `INSERT INTO cash_sessions (user_id, opening_amount, status)
       VALUES ($1, $2, 'open')
       RETURNING *`,
      [user_id || null, opening_amount || 0]
    );

    await pool.query(
      `INSERT INTO audit_events (entity_type, entity_id, event_type, new_value)
       VALUES ('cash_session', $1, 'opened', $2)`,
      [result.rows[0]!.id, JSON.stringify({ opening_amount: opening_amount || 0 })]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to open cash session:', error);
    res.status(500).json({ error: 'Failed to open cash session' });
  }
});

// POST /api/cash/close - Close a cash session (check-out)
router.post('/close', async (req, res) => {
  const client = await pool.connect();
  try {
    const { closing_amount, notes } = req.body;

    await client.query('BEGIN');

    const sessionResult = await client.query(
      "SELECT * FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1"
    );

    if (sessionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'No open cash session found' });
      return;
    }

    const session = sessionResult.rows[0]!;

    // Calculate expected amount from transactions
    const transResult = await client.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE session_id = $1',
      [session.id]
    );
    const transactionTotal = parseFloat(transResult.rows[0]!.total);
    const expectedAmount = parseFloat(session.opening_amount) + transactionTotal;

    const result = await client.query(
      `UPDATE cash_sessions
       SET status = 'closed', closed_at = NOW(), closing_amount = $1, expected_amount = $2, notes = $3
       WHERE id = $4
       RETURNING *`,
      [closing_amount || 0, expectedAmount, notes || null, session.id]
    );

    const difference = (closing_amount || 0) - expectedAmount;

    await client.query(
      `INSERT INTO audit_events (entity_type, entity_id, event_type, new_value)
       VALUES ('cash_session', $1, 'closed', $2)`,
      [session.id, JSON.stringify({ closing_amount, expected_amount: expectedAmount, difference })]
    );

    await client.query('COMMIT');

    res.json({
      ...result.rows[0],
      transaction_total: transactionTotal,
      difference: difference,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to close cash session:', error);
    res.status(500).json({ error: 'Failed to close cash session' });
  } finally {
    client.release();
  }
});

// GET /api/cash/current - Get current open session with summary
router.get('/current', async (req, res) => {
  try {
    const sessionResult = await pool.query(
      "SELECT * FROM cash_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1"
    );

    if (sessionResult.rows.length === 0) {
      res.json({ session: null });
      return;
    }

    const session = sessionResult.rows[0]!;

    const transResult = await pool.query(
      `SELECT type, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM cash_transactions WHERE session_id = $1
       GROUP BY type`,
      [session.id]
    );

    const totalResult = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE session_id = $1',
      [session.id]
    );

    res.json({
      session,
      breakdown: transResult.rows,
      current_total: parseFloat(session.opening_amount) + parseFloat(totalResult.rows[0]!.total),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cash session' });
  }
});

// GET /api/cash/history - Get closed sessions
router.get('/history', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM cash_sessions WHERE status = 'closed' ORDER BY closed_at DESC LIMIT 20"
    );
    res.json({ sessions: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cash history' });
  }
});

export default router;
