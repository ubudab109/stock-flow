import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { Client } from 'pg';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(rootDir, '.env.test'), override: true });

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set — expected it to come from apps/api/.env.test');
  }

  const targetUrl = new URL(databaseUrl);
  const dbName = targetUrl.pathname.replace(/^\//, '');
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created test database "${dbName}"`);
    }
  } finally {
    await client.end();
  }

  // `shell: true` is required for npx resolution on Windows (npx.cmd). Safe
  // here: the command and args are fixed literals, never user input.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: process.env,
    cwd: rootDir,
    shell: true,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
