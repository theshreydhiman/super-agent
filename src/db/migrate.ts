import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { config } from '../config';
import { getPool } from './connection';
import { createLogger } from '../utils/logger';

const log = createLogger('Migrate');

async function ensureDatabase(): Promise<void> {
    if (config.databaseUrl) {
        // When using DATABASE_URL, the database is expected to already exist
        // (managed by the hosting provider like Render, Railway, etc.)
        const url = new URL(config.databaseUrl);
        log.info(`Using DATABASE_URL (database: "${url.pathname.slice(1)}")`);
        return;
    }

    const connection = await mysql.createConnection({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
    });

    await connection.execute(
        `CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.end();

    log.info(`Database "${config.mysql.database}" ensured`);
}

export async function runMigrations(): Promise<void> {
    // Create database if it doesn't exist
    await ensureDatabase();

    const pool = getPool();
    // schema.sql lives in src/db/ — resolve from project root
    let schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
        schemaPath = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
    }
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    const statements = schema
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
        try {
            await pool.execute(statement);
        } catch (error: any) {
            if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_KEYNAME') {
                continue;
            }
            log.error(`Migration failed: ${error.message}`);
            throw error;
        }
    }

    log.info('Database migrations completed');
}
