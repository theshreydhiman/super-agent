import { getPool } from '../db/connection';
import { encrypt, decrypt, maskSecret } from '../services/encryption';
import { RowDataPacket } from 'mysql2';

const SENSITIVE_KEYS = [
    'gemini_api_key',
    'openai_api_key',
    'claude_api_key',
    'groq_api_key',
    'webhook_secret',
];

export class ConfigRepository {
    async getAll(userId: number): Promise<Record<string, string>> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT config_key, config_value FROM user_configs WHERE user_id = ?',
            [userId]
        );

        const result: Record<string, string> = {};
        for (const row of rows as any[]) {
            let value = row.config_value;
            if (SENSITIVE_KEYS.includes(row.config_key)) {
                try {
                    value = decrypt(value);
                } catch {
                    // Not encrypted yet
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
            masked[key] = SENSITIVE_KEYS.includes(key) ? maskSecret(value) : value;
        }
        return masked;
    }

    async get(userId: number, key: string): Promise<string | null> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT config_value FROM user_configs WHERE user_id = ? AND config_key = ?',
            [userId, key]
        );
        if (rows.length === 0) return null;

        let value = (rows[0] as any).config_value;
        if (SENSITIVE_KEYS.includes(key)) {
            try {
                value = decrypt(value);
            } catch {
                // Not encrypted
            }
        }
        return value;
    }

    async set(userId: number, key: string, value: string): Promise<void> {
        const pool = getPool();
        const storedValue = SENSITIVE_KEYS.includes(key) ? encrypt(value) : value;

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
}
