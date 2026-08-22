// scripts/migrate.ts
// CLI script to apply PostgreSQL / Supabase database migrations
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { runMigrations } from '../src/server/store/migrations';

// Helper to parse .env.local / .env files if DATABASE_URL is not in process.env
function loadEnv() {
  if (process.env.DATABASE_URL) return;

  const envFiles = ['.env.local', '.env.production', '.env'];
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;

      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL environment variable is not set in environment or .env.local.');
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
