import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/products - List all products
router.get('/', async (req, res) => {
  try {
    const category = req.query.category as string;
    let query = 'SELECT * FROM products';
    const params: any[] = [];

    if (category) {
      params.push(category);
      query += ` WHERE category = $${params.length}`;
    }
    query += ' ORDER BY category, name';

    const result = await pool.query(query, params);
    res.json({ products: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/categories - List distinct categories
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT category FROM products ORDER BY category');
    res.json({ categories: result.rows.map(r => r.category) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/products - Create product (admin only)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, category, price, station } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const safePrice = parseFloat(price);
    if (isNaN(safePrice) || safePrice < 0) {
      res.status(400).json({ error: 'price must be a non-negative number' });
      return;
    }
    const validStations = ['kitchen', 'bar', 'grill', 'direct'];
    const safeStation = validStations.includes(station) ? station : 'kitchen';

    const result = await pool.query(
      'INSERT INTO products (name, category, price, station) VALUES ($1, $2, $3, $4) RETURNING *',
      [name.trim(), category || 'Uncategorized', safePrice, safeStation]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Update product (admin only)
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, category, price, station } = req.body;
    const result = await pool.query(
      'UPDATE products SET name = COALESCE($1, name), category = COALESCE($2, category), price = COALESCE($3, price), station = COALESCE($4, station) WHERE id = $5 RETURNING *',
      [name, category, price, station, req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Delete product (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ deleted: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
