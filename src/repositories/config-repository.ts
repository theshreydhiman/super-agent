import { getPool } from '../db/connection';
import { encrypt, decrypt, maskSecret } from '../services/encryption';
import { RowDataPacket } from 'mysql2';
import { createLogger } from '../utils/logger';

const log = createLogger('ConfigRepository');

const SENSITIVE_KEYS = new Set([
    'gemini_api_key',
    'openai_api_key',
    'claude_api_key',
    'groq_api_key',
    'webhook_secret',
]);

/** Mask pattern used by maskSecret — detects re-saved masked values */
const MASK_PATTERN = /^.{4}\*{4}.{4}$/;

interface ConfigRow extends RowDataPacket {
    config_key: string;
    config_value: string;
}

export class ConfigRepository {
    async getAll(userId: number): Promise<Record<string, string>> {
        const pool = getPool();
        const [rows] = await pool.execute<ConfigRow[]>(
            'SELECT config_key, config_value FROM user_configs WHERE user_id = ?',
            [userId]
        );

        const result: Record<string, string> = {};
        for (const row of rows) {
            let value = row.config_value;
            if (SENSITIVE_KEYS.has(row.config_key)) {
                try {
                    value = decrypt(value);
                } catch {
                    log.warn(`Failed to decrypt config key "${row.config_key}" for user ${userId} — value may be corrupted or unencrypted`);
                }
            }
            result[row.config_key] = value;
        }
        return result;
    }

    async getAllMasked(userId: number): Promise<Record<string, string>> {
        const all = await this.getAll(userId);
        const masked: Record<string, string> = {};
        for (const [key, value] of Object.entries(all)) {
            masked[key] = SENSITIVE_KEYS.has(key) ? maskSecret(value) : value;
        }
        return masked;
    }

    async get(userId: number, key: string): Promise<string | null> {
        const pool = getPool();
        const [rows] = await pool.execute<ConfigRow[]>(
            'SELECT config_value FROM user_configs WHERE user_id = ? AND config_key = ?',
            [userId, key]
        );
        if (rows.length === 0) return null;

        let value = rows[0].config_value;
        if (SENSITIVE_KEYS.has(key)) {
            try {
                value = decrypt(value);
            } catch {
                log.warn(`Failed to decrypt config key "${key}" for user ${userId}`);
            }
        }
        return value;
    }

    async set(userId: number, key: string, value: string): Promise<void> {
        // Reject masked values being saved back — prevents data corruption
        if (SENSITIVE_KEYS.has(key) && MASK_PATTERN.test(value)) {
            return;
        }

        const pool = getPool();
        const storedValue = SENSITIVE_KEYS.has(key) ? encrypt(value) : value;

        await pool.execute(
            `INSERT INTO user_configs (user_id, config_key, config_value)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
            [userId, key, storedValue]
        );
    }

    async setMultiple(userId: number, configs: Record<string, string>): Promise<void> {
        for (const [key, value] of Object.entries(configs)) {
            if (value !== undefined && value !== '') {
                await this.set(userId, key, value);
            }
        }
    }

    async delete(userId: number, key: string): Promise<void> {
        const pool = getPool();
        await pool.execute(
            'DELETE FROM user_configs WHERE user_id = ? AND config_key = ?',
            [userId, key]
        );
    }

    async deleteMultiple(userId: number, keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        const pool = getPool();
        const placeholders = keys.map(() => '?').join(',');
        await pool.execute(
            `DELETE FROM user_configs WHERE user_id = ? AND config_key IN (${placeholders})`,
            [userId, ...keys]
        );
    }
}
