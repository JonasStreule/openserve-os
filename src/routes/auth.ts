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

// POST /api/auth/change-pin - Change own PIN (requires current PIN)
router.post('/change-pin', requireAuth, async (req, res) => {
  try {
    const { current_pin, new_pin } = req.body;
    if (!current_pin || !new_pin) {
      res.status(400).json({ error: 'current_pin and new_pin required' });
      return;
    }
    if (new_pin.length < 4) {
      res.status(400).json({ error: 'PIN must be at least 4 digits' });
      return;
    }

    const result = await pool.query(
      'SELECT pin_hash FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const valid = await AuthService.verifyPin(current_pin, result.rows[0]!.pin_hash);
    if (!valid) {
      res.status(401).json({ error: 'Current PIN is incorrect' });
      return;
    }

    const new_hash = await AuthService.hashPin(new_pin);
    await pool.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [new_hash, req.user!.userId]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to change PIN' });
  }
});

// POST /api/auth/reset-pin/:id - Admin resets another user's PIN
router.post('/reset-pin/:id', requireAuth, async (req, res) => {
  try {
    const { new_pin } = req.body;
    if (!new_pin || new_pin.length < 4) {
      res.status(400).json({ error: 'new_pin (min 4 digits) required' });
      return;
    }

    // Only admins can reset other users' PINs
    if (req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const new_hash = await AuthService.hashPin(new_pin);
    const result = await pool.query(
      'UPDATE users SET pin_hash = $1 WHERE id = $2 RETURNING id, username',
      [new_hash, req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ success: true, user: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to reset PIN' });
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
