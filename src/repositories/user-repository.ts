import { getPool } from '../db/connection';
import { encrypt, decrypt } from '../services/encryption';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface User {
    id: number;
    github_id: number;
    github_login: string;
    github_avatar_url: string | null;
    github_access_token: string;
    email: string | null;
    created_at: Date;
    updated_at: Date;
}

export class UserRepository {
    async findById(id: number): Promise<User | null> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT * FROM users WHERE id = ?',
            [id]
        );
        if (rows.length === 0) return null;
        return this.decryptUser(rows[0] as User);
    }

    async findByGithubId(githubId: number): Promise<User | null> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT * FROM users WHERE github_id = ?',
            [githubId]
        );
        if (rows.length === 0) return null;
        return this.decryptUser(rows[0] as User);
    }

    async upsert(data: {
        github_id: number;
        github_login: string;
        github_avatar_url?: string;
        github_access_token: string;
        email?: string;
    }): Promise<User> {
        const pool = getPool();
        const encryptedToken = encrypt(data.github_access_token);

        await pool.execute<ResultSetHeader>(
            `INSERT INTO users (github_id, github_login, github_avatar_url, github_access_token, email)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                github_login = VALUES(github_login),
                github_avatar_url = VALUES(github_avatar_url),
                github_access_token = VALUES(github_access_token),
                email = VALUES(email)`,
            [
                data.github_id,
                data.github_login,
                data.github_avatar_url || null,
                encryptedToken,
                data.email || null,
            ]
        );

        return (await this.findByGithubId(data.github_id))!;
    }

    async listAll(): Promise<User[]> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM users ORDER BY created_at DESC');
        return (rows as User[]).map((u) => this.decryptUser(u));
    }

    private decryptUser(user: User): User {
        try {
            user.github_access_token = decrypt(user.github_access_token);
        } catch {
            // Token may not be encrypted (legacy), leave as-is
        }
        return user;
    }
}
