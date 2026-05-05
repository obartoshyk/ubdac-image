import pg from 'pg';
import { secret } from './secrets.js';

const { Pool } = pg;

export const pool = new Pool({ connectionString: secret('DATABASE_URL') });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      email      VARCHAR(255) UNIQUE NOT NULL,
      name       VARCHAR(255) NOT NULL,
      password   VARCHAR(255),
      google_id  VARCHAR(255),
      photo      BYTEA,
      photo_mime VARCHAR(64),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Migrations for existing databases
  await pool.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(15,2) NOT NULL DEFAULT 0.00`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key
    ON users(google_id) WHERE google_id IS NOT NULL
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stripe_sessions (
      session_id VARCHAR(255) PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      amount     NUMERIC(15,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
