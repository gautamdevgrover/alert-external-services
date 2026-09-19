import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed DB query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
  } catch (err: any) {
    logger.error('DB query error', { text: text.substring(0, 100), error: err.message });
    throw err;
  }
}

export async function checkDbHealth(): Promise<boolean> {
  try {
    const res = await query('SELECT 1 as healthy');
    return res.rows.length > 0 && res.rows[0].healthy === 1;
  } catch (err: any) {
    logger.error('PostgreSQL health check failed', { error: err.message });
    return false;
  }
}
