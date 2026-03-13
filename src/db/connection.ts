import mysql from 'mysql2/promise';
import { config } from '../config';

let pool: mysql.Pool | null = null;

function buildPoolConfig(): mysql.PoolOptions {
    if (config.databaseUrl) {
        return {
            uri: config.databaseUrl,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        };
    }

    return {
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    };
}

export function getPool(): mysql.Pool {
    if (!pool) {
        pool = mysql.createPool(buildPoolConfig());
    }
    return pool;
}

export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
