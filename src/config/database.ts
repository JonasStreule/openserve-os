import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:dev123@localhost:5432/openserve',
  // Production-tuned pool settings
  max: parseInt(process.env.DB_POOL_MAX || '25'),           // max connections (default pg: 10 — too low)
  min: parseInt(process.env.DB_POOL_MIN || '5'),            // keep 5 warm connections ready
  idleTimeoutMillis: 30000,                                  // close idle connections after 30s
  connectionTimeoutMillis: 5000,                             // fail fast if DB unreachable (5s)
  allowExitOnIdle: false,                                    // keep pool alive in long-running server
});

// Log pool errors (don't crash, just log)
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Database connected successfully');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
