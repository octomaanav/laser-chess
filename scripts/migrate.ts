// scripts/migrate.ts
// CLI script to apply PostgreSQL / Supabase database migrations
import { Pool } from 'pg';
import { runMigrations } from '../src/server/store/migrations';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new Pool({
    connectionString,
    ssl: local ? false : { rejectUnauthorized: false },
    max: 2,
  });

  try {
    console.log('Connecting to database and running pending migrations...');
    const result = await runMigrations(pool);
    console.log(`Done! Applied: ${result.applied.length}, Already applied: ${result.alreadyApplied.length}`);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
