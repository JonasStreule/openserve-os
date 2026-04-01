import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// GET /api/admin/metrics - Dashboard overview
router.get('/metrics', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [ordersToday, revenueToday, ordersByStatus, paymentMethods, hourlyRevenue] = await Promise.all([
      // Total orders today
      pool.query(
        "SELECT COUNT(*) as count FROM orders WHERE created_at::date = $1",
        [today]
      ),
      // Revenue today
      pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total, COALESCE(SUM(CASE WHEN p.order_id IN (SELECT id FROM orders WHERE tip_amount > 0) THEN (SELECT tip_amount FROM orders WHERE id = p.order_id) ELSE 0 END), 0) as tips FROM payments p WHERE p.status = 'completed' AND p.created_at::date = $1",
        [today]
      ),
      // Orders by status
      pool.query(
        "SELECT status, COUNT(*) as count FROM orders WHERE created_at::date = $1 GROUP BY status",
        [today]
      ),
      // Payment method breakdown
      pool.query(
        "SELECT method, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed' AND created_at::date = $1 GROUP BY method",
        [today]
      ),
      // Hourly revenue today
      pool.query(
        `SELECT EXTRACT(HOUR FROM p.created_at) as hour, COALESCE(SUM(p.amount), 0) as total, COUNT(*) as count
         FROM payments p WHERE p.status = 'completed' AND p.created_at::date = $1
         GROUP BY hour ORDER BY hour`,
        [today]
      ),
    ]);

    // Tips today
    const tipsResult = await pool.query(
      "SELECT COALESCE(SUM(tip_amount), 0) as total FROM orders WHERE payment_status = 'paid' AND created_at::date = $1",
      [today]
    );

    // Average order value
    const avgResult = await pool.query(
      "SELECT COALESCE(AVG(total_amount), 0) as avg_amount FROM orders WHERE payment_status = 'paid' AND created_at::date = $1",
      [today]
    );

    res.json({
      date: today,
      orders: {
        total: parseInt(ordersToday.rows[0]!.count),
        by_status: ordersByStatus.rows,
      },
      revenue: {
        total: parseFloat(revenueToday.rows[0]!.total),
        tips: parseFloat(tipsResult.rows[0]!.total),
        average_order: parseFloat(parseFloat(avgResult.rows[0]!.avg_amount).toFixed(2)),
        by_method: paymentMethods.rows,
        hourly: hourlyRevenue.rows,
      },
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/admin/metrics/weekly - Last 7 days
router.get('/metrics/weekly', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         created_at::date as date,
         COUNT(*) as orders,
         COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as revenue,
         COALESCE(SUM(tip_amount), 0) as tips
       FROM orders
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY date
       ORDER BY date DESC`
    );
    res.json({ days: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weekly metrics' });
  }
});

// GET /api/admin/audit - Audit log
router.get('/audit', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const entityType = req.query.entity_type as string;

    let query = 'SELECT * FROM audit_events';
    const params: any[] = [];

    if (entityType) {
      params.push(entityType);
      query += ` WHERE entity_type = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    const countQuery = entityType
      ? 'SELECT COUNT(*) FROM audit_events WHERE entity_type = $1'
      : 'SELECT COUNT(*) FROM audit_events';
    const countResult = await pool.query(countQuery, entityType ? [entityType] : []);

    res.json({
      events: result.rows,
      total: parseInt(countResult.rows[0]!.count),
      limit,
      offset,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// GET /api/admin/leaderboard - Staff leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const period = (req.query.period as string) || 'daily';
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT * FROM staff_scores
       WHERE period = $1 AND period_date = $2
       ORDER BY points DESC
       LIMIT 20`,
      [period, date]
    );

    res.json({ leaderboard: result.rows, period, date });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// POST /api/admin/leaderboard/score - Add/update staff score
router.post('/leaderboard/score', async (req, res) => {
  try {
    const { username, points, orders_served, tips_earned, avg_service_time } = req.body;

    if (!username) {
      res.status(400).json({ error: 'username required' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `INSERT INTO staff_scores (username, points, orders_served, tips_earned, avg_service_time, period, period_date)
       VALUES ($1, $2, $3, $4, $5, 'daily', $6)
       ON CONFLICT (username, period, period_date)
       DO UPDATE SET
         points = staff_scores.points + EXCLUDED.points,
         orders_served = staff_scores.orders_served + EXCLUDED.orders_served,
         tips_earned = staff_scores.tips_earned + EXCLUDED.tips_earned,
         avg_service_time = EXCLUDED.avg_service_time
       RETURNING *`,
      [username, points || 0, orders_served || 0, tips_earned || 0, avg_service_time || 0, today]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Score update error:', error);
    res.status(500).json({ error: 'Failed to update score' });
  }
});

export default router;
