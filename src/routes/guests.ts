import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../config/database';

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
    const tableNumber = table ? table.table_number : 'unknown';

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

export default router;
