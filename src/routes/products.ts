import { Router } from 'express';
import { pool } from '../config/database';

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

// POST /api/products - Create product
router.post('/', async (req, res) => {
  try {
    const { name, category, price } = req.body;
    if (!name || !price) {
      res.status(400).json({ error: 'name and price required' });
      return;
    }

    const result = await pool.query(
      'INSERT INTO products (name, category, price) VALUES ($1, $2, $3) RETURNING *',
      [name, category || 'Uncategorized', price]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', async (req, res) => {
  try {
    const { name, category, price } = req.body;
    const result = await pool.query(
      'UPDATE products SET name = COALESCE($1, name), category = COALESCE($2, category), price = COALESCE($3, price) WHERE id = $4 RETURNING *',
      [name, category, price, req.params.id]
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

// DELETE /api/products/:id - Delete product
router.delete('/:id', async (req, res) => {
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
