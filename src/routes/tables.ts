import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../config/database';

const router = Router();

// GET /api/tables - List all tables
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tables ORDER BY table_number');
    res.json({ tables: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// POST /api/tables - Create table (auto-generates QR token)
router.post('/', async (req, res) => {
  try {
    const { table_number, capacity } = req.body;
    if (!table_number) {
      res.status(400).json({ error: 'table_number required' });
      return;
    }

    const qr_token = `table-${table_number}-${randomUUID().slice(0, 8)}`;

    const result = await pool.query(
      'INSERT INTO tables (table_number, qr_token, capacity) VALUES ($1, $2, $3) RETURNING *',
      [table_number, qr_token, capacity || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Table number already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// PUT /api/tables/:id - Update table
router.put('/:id', async (req, res) => {
  try {
    const { table_number, capacity } = req.body;
    const result = await pool.query(
      'UPDATE tables SET table_number = COALESCE($1, table_number), capacity = COALESCE($2, capacity) WHERE id = $3 RETURNING *',
      [table_number, capacity, req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update table' });
  }
});

// DELETE /api/tables/:id - Delete table
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM tables WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }
    res.json({ deleted: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

export default router;
