import { getPool } from '../db/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface ProcessedIssue {
    id: number;
    user_id: number;
    repo_owner: string;
    repo_name: string;
    issue_number: number;
    issue_title: string;
    issue_url: string | null;
    status: 'processing' | 'success' | 'failed';
    branch_name: string | null;
    pr_number: number | null;
    pr_url: string | null;
    review_approved: boolean | null;
    review_score: number | null;
    error_message: string | null;
    created_at: Date;
    updated_at: Date;
}

/** Safely coerce a MySQL aggregate value (may be string, BigInt, or number) to a JS number. */
function toNumber(val: unknown): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'bigint') return Number(val);
    return parseInt(String(val), 10) || 0;
}

/** Columns allowed in dynamic UPDATE queries — prevents SQL injection via object keys */
const UPDATABLE_COLUMNS = new Set<string>([
    'status', 'branch_name', 'pr_number', 'pr_url',
    'review_approved', 'review_score', 'error_message',
]);

export class IssueRepository {
    async create(data: {
        user_id: number;
        repo_owner: string;
        repo_name: string;
        issue_number: number;
        issue_title: string;
        issue_url?: string;
    }): Promise<number> {
        const pool = getPool();
        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO processed_issues (user_id, repo_owner, repo_name, issue_number, issue_title, issue_url)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [data.user_id, data.repo_owner, data.repo_name, data.issue_number, data.issue_title, data.issue_url || null]
        );
        return result.insertId;
    }

    async update(
        id: number,
        data: Partial<Pick<ProcessedIssue, 'status' | 'branch_name' | 'pr_number' | 'pr_url' | 'review_approved' | 'review_score' | 'error_message'>>
    ): Promise<void> {
        const fields: string[] = [];
        const values: (string | number | boolean | null)[] = [];

        for (const [key, value] of Object.entries(data)) {
            if (value === undefined) continue;
            if (!UPDATABLE_COLUMNS.has(key)) {
                throw new Error(`Invalid column name for update: ${key}`);
            }
            fields.push(`${key} = ?`);
            values.push(value);
        }

        if (fields.length === 0) return;

        const pool = getPool();
        values.push(id);
        await pool.execute(
            `UPDATE processed_issues SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
    }

    async resetIssue(id: number): Promise<void> {
        const pool = getPool();
        await pool.execute(
            `UPDATE processed_issues SET status = 'processing', branch_name = NULL,
             pr_number = NULL, pr_url = NULL, review_approved = NULL, review_score = NULL, error_message = NULL WHERE id = ?`,
            [id]
        );
    }

    async findById(id: number): Promise<ProcessedIssue | null> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT * FROM processed_issues WHERE id = ?',
            [id]
        );
        return rows.length > 0 ? (rows[0] as ProcessedIssue) : null;
    }

    async findLatestByIssueNumber(
        userId: number, repoOwner: string, repoName: string, issueNumber: number
    ): Promise<ProcessedIssue | null> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT * FROM processed_issues
             WHERE user_id = ? AND repo_owner = ? AND repo_name = ? AND issue_number = ?
             ORDER BY created_at DESC LIMIT 1`,
            [userId, repoOwner, repoName, issueNumber]
        );
        return rows.length > 0 ? (rows[0] as ProcessedIssue) : null;
    }

    async listByUser(
        userId: number,
        options: { status?: string; repo?: string; page?: number; limit?: number } = {}
    ): Promise<{ issues: ProcessedIssue[]; total: number }> {
        const pool = getPool();
        const page = options.page || 1;
        const limit = Math.min(Math.max(options.limit || 20, 1), 100);
        const offset = (page - 1) * limit;

        let where = 'WHERE user_id = ?';
        const params: (string | number)[] = [userId];

        if (options.status) {
            where += ' AND status = ?';
            params.push(options.status);
        }
        if (options.repo) {
            where += ' AND repo_name = ?';
            params.push(options.repo);
        }

        const [countRows] = await pool.execute<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM processed_issues ${where}`,
            params
        );
        const total = toNumber((countRows[0] as RowDataPacket).total);

        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT * FROM processed_issues ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, String(limit), String(offset)]
        );

        return { issues: rows as ProcessedIssue[], total };
    }

    async getByRepoAndNumbers(
        userId: number, repoOwner: string, repoName: string, issueNumbers: number[]
    ): Promise<ProcessedIssue[]> {
        if (issueNumbers.length === 0) return [];
        const pool = getPool();
        const placeholders = issueNumbers.map(() => '?').join(',');
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT * FROM processed_issues
             WHERE user_id = ? AND repo_owner = ? AND repo_name = ? AND issue_number IN (${placeholders})
             ORDER BY created_at DESC`,
            [userId, repoOwner, repoName, ...issueNumbers]
        );
        return rows as ProcessedIssue[];
    }

    async getStats(userId: number): Promise<{
        totalIssues: number;
        successCount: number;
        failedCount: number;
        prsCreated: number;
    }> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT
                COUNT(*) as total_issues,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                SUM(CASE WHEN pr_number IS NOT NULL THEN 1 ELSE 0 END) as prs_created
             FROM processed_issues WHERE user_id = ?`,
            [userId]
        );
        const row = rows[0] as RowDataPacket;
        return {
            totalIssues: toNumber(row.total_issues),
            successCount: toNumber(row.success_count),
            failedCount: toNumber(row.failed_count),
            prsCreated: toNumber(row.prs_created),
        };
    }

    async getRecent(userId: number, limit = 5): Promise<ProcessedIssue[]> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT * FROM processed_issues WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
            [userId, String(limit)]
        );
        return rows as ProcessedIssue[];
    }
}
