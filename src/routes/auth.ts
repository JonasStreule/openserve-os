import { Router } from 'express';
import { pool } from '../config/database';
import { AuthService } from '../services/AuthService';
import { requireAuth } from '../middleware/auth';

const router = Router();

// POST /api/auth/login - Login with username + PIN
router.post('/login', async (req, res) => {
  try {
    const { username, pin } = req.body;
    if (!username || !pin) {
      res.status(400).json({ error: 'username and pin required' });
      return;
    }

    const result = await pool.query(
      'SELECT id, username, pin_hash, role FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0]!;
    const valid = await AuthService.verifyPin(pin, user.pin_hash);

    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = AuthService.generateToken(user.id, user.role);

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
