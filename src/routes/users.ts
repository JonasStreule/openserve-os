import { Router } from 'express';
import { pool } from '../config/database';
import { AuthService } from '../services/AuthService';

const router = Router();

// GET /api/users - List all users (without pin_hash)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users - Create user
router.post('/', async (req, res) => {
  try {
    const { username, pin, role } = req.body;
    if (!username || !pin || !role) {
      res.status(400).json({ error: 'username, pin, and role required' });
      return;
    }
    if (!['admin', 'service', 'kitchen'].includes(role)) {
      res.status(400).json({ error: 'role must be admin, service, or kitchen' });
      return;
    }

    const pin_hash = await AuthService.hashPin(pin);
    const result = await pool.query(
      'INSERT INTO users (username, pin_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
      [username, pin_hash, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res) => {
  try {
    const { username, role, pin } = req.body;

    // Update pin if provided
    if (pin) {
      const pin_hash = await AuthService.hashPin(pin);
      await pool.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [pin_hash, req.params.id]);
    }

    const result = await pool.query(
      'UPDATE users SET username = COALESCE($1, username), role = COALESCE($2, role) WHERE id = $3 RETURNING id, username, role, created_at',
      [username, role, req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ deleted: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
