import { Router } from 'express';
import { pool } from '../config/database';
import { wsService } from '../services/WebSocketService';

const router = Router();

// GET /api/tasks/stats — Task stats
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open') AS open_count,
        COUNT(*) FILTER (WHERE status = 'claimed') AS claimed_count,
        COUNT(*) FILTER (WHERE status = 'done' AND completed_at::date = CURRENT_DATE) AS done_today
      FROM tasks
    `);

    const pointsResult = await pool.query(`
      SELECT username, COALESCE(points, 0) AS points_today
      FROM staff_scores
      WHERE period = 'daily'
        AND period_date = CURRENT_DATE
      ORDER BY points_today DESC
    `);

    res.json({
      ...result.rows[0],
      points_today_by_user: pointsResult.rows,
    });
  } catch (error) {
    console.error('Failed to fetch task stats:', error);
    res.status(500).json({ error: 'Failed to fetch task stats' });
  }
});

// GET /api/tasks — List tasks
router.get('/', async (req, res) => {
  try {
    const statusParam = (req.query.status as string) || 'open,claimed';
    const category = req.query.category as string;
    const my = req.query.my as string;
    const user = (req as any).user;

    const validStatuses = ['open', 'claimed', 'done', 'cancelled'];
    const statuses = statusParam.split(',').map(s => s.trim()).filter(s => validStatuses.includes(s));
    if (statuses.length === 0) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }
    const params: any[] = [];
    const conditions: string[] = [];

    // Status filter
    params.push(statuses);
    conditions.push(`t.status = ANY($${params.length})`);

    // Category filter
    if (category) {
      params.push(category);
      conditions.push(`t.category = $${params.length}`);
    }

    // My tasks filter
    if (my === 'true' && user) {
      params.push(user.userId);
      conditions.push(`(t.assigned_to = $${params.length} OR t.claimed_by = $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const query = `
      SELECT t.*,
        assigned_user.username AS assigned_to_username,
        claimed_user.username AS claimed_by_username,
        completed_user.username AS completed_by_username
      FROM tasks t
      LEFT JOIN users assigned_user ON assigned_user.id = t.assigned_to
      LEFT JOIN users claimed_user ON claimed_user.id = t.claimed_by
      LEFT JOIN users completed_user ON completed_user.id = t.completed_by
      ${whereClause}
      ORDER BY
        CASE t.priority
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END,
        t.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks — Create task
router.post('/', async (req, res) => {
  try {
    const user = (req as any).user;
    const {
      title, description, category, priority, points,
      assigned_to, due_by, recurring, recurring_interval,
    } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    const safePriority = validPriorities.includes(priority) ? priority : 'normal';
    const safePoints = Math.max(0, Math.min(100, parseInt(points, 10) || 0));

    const result = await pool.query(
      `INSERT INTO tasks (title, description, category, priority, points, assigned_to, due_by, recurring, recurring_interval, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        title.trim(),
        description || null,
        category || null,
        safePriority,
        safePoints,
        assigned_to || null,
        due_by || null,
        recurring || false,
        recurring_interval || null,
        user.userId,
      ]
    );

    const task = result.rows[0];
    wsService.broadcastAll('task:created', task);
    res.status(201).json({ task });
  } catch (error) {
    console.error('Failed to create task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PATCH /api/tasks/:id/claim — Claim a pool task (atomic)
router.patch('/:id/claim', async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    // Atomic claim: only succeeds if task is still open and not assigned to someone else
    const result = await pool.query(
      `UPDATE tasks
       SET claimed_by = $1, claimed_at = NOW(), status = 'claimed'
       WHERE id = $2
         AND status = 'open'
         AND (assigned_to IS NULL OR assigned_to = $1)
       RETURNING *`,
      [user.userId, id]
    );

    if (result.rows.length === 0) {
      // Check why it failed
      const existing = await pool.query('SELECT status, assigned_to FROM tasks WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      if (existing.rows[0].status !== 'open') {
        return res.status(400).json({ error: 'Task is not open for claiming' });
      }
      return res.status(403).json({ error: 'Task is assigned to another user' });
    }

    const updated = result.rows[0];
    wsService.broadcastAll('task:claimed', updated);
    res.json({ task: updated });
  } catch (error) {
    console.error('Failed to claim task:', error);
    res.status(500).json({ error: 'Failed to claim task' });
  }
});

// PATCH /api/tasks/:id/unclaim — Unclaim a task (atomic)
router.patch('/:id/unclaim', async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    // Atomic unclaim: only succeeds if claimed by this user
    const result = await pool.query(
      `UPDATE tasks
       SET claimed_by = NULL, claimed_at = NULL, status = 'open'
       WHERE id = $1 AND claimed_by = $2
       RETURNING *`,
      [id, user.userId]
    );

    if (result.rows.length === 0) {
      const existing = await pool.query('SELECT id FROM tasks WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.status(403).json({ error: 'You can only unclaim tasks you claimed' });
    }

    const updated = result.rows[0];
    wsService.broadcastAll('task:unclaimed', updated);
    res.json({ task: updated });
  } catch (error) {
    console.error('Failed to unclaim task:', error);
    res.status(500).json({ error: 'Failed to unclaim task' });
  }
});

// PATCH /api/tasks/:id/done — Complete a task
router.patch('/:id/done', async (req, res) => {
  const client = await pool.connect();
  try {
    const user = (req as any).user;
    const { id } = req.params;

    await client.query('BEGIN');

    // Lock row to prevent concurrent completion
    const existing = await client.query('SELECT * FROM tasks WHERE id = $1 FOR UPDATE', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = existing.rows[0];

    if (task.status === 'done' || task.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Task is already ${task.status}` });
    }

    const result = await client.query(
      `UPDATE tasks
       SET completed_by = $1, completed_at = NOW(), status = 'done'
       WHERE id = $2
       RETURNING *`,
      [user.userId, id]
    );

    const updated = result.rows[0];

    // Award points to staff_scores (atomic upsert)
    if (task.points && task.points > 0) {
      const userResult = await client.query('SELECT username FROM users WHERE id = $1', [user.userId]);
      const username = userResult.rows[0]?.username || 'Unknown';
      await client.query(
        `INSERT INTO staff_scores (user_id, username, points, orders_served, tips_earned, avg_service_time, period, period_date)
         VALUES ($1, $2, $3, 0, 0, 0, 'daily', CURRENT_DATE)
         ON CONFLICT (username, period, period_date)
         DO UPDATE SET points = staff_scores.points + $3`,
        [user.userId, username, task.points]
      );
    }

    await client.query('COMMIT');

    wsService.broadcastAll('task:done', updated);
    res.json({ task: updated });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to complete task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  } finally {
    client.release();
  }
});

// DELETE /api/tasks/:id — Cancel a task (admin or creator only)
router.delete('/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const existing = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = existing.rows[0];

    if (user.role !== 'admin' && task.created_by !== user.userId) {
      return res.status(403).json({ error: 'Only admin or task creator can cancel tasks' });
    }

    const result = await pool.query(
      `UPDATE tasks SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [id]
    );

    const updated = result.rows[0];
    wsService.broadcastAll('task:cancelled', updated);
    res.json({ task: updated });
  } catch (error) {
    console.error('Failed to cancel task:', error);
    res.status(500).json({ error: 'Failed to cancel task' });
  }
});

export default router;
