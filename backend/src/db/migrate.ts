import fs from 'fs';
import path from 'path';
import { pool, query } from './index';
import { logger } from '../utils/logger';

export async function runMigrations() {
  logger.info('Running database migrations...');
  let schemaPath = path.resolve(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(__dirname, '../../src/db/schema.sql');
  }
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await query(schemaSql);
    logger.info('Database migrations executed successfully');
  } catch (err: any) {
    logger.error('Failed to run database migrations', { error: err.message });
    throw err;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
