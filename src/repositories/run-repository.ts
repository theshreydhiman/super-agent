import { getPool } from '../db/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface AgentRun {
    id: number;
    user_id: number;
    repo_owner: string;
    repo_name: string;
    status: 'running' | 'completed' | 'failed';
    issues_found: number;
    issues_processed: number;
    prs_created: number;
    error_message: string | null;
    started_at: Date;
    completed_at: Date | null;
}

export interface ProcessedIssue {
    id: number;
    run_id: number;
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
    error_message: string | null;
    created_at: Date;
    updated_at: Date;
}

/** Safely coerce a MySQL aggregate value (may be string, BigInt, or number) to a JS number. */
function toNumber(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'bigint') return Number(val);
    return parseInt(String(val), 10) || 0;
}

export class RunRepository {
    async createRun(data: {
        user_id: number;
        repo_owner: string;
        repo_name: string;
        issues_found?: number;
    }): Promise<number> {
        const pool = getPool();
        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO agent_runs (user_id, repo_owner, repo_name, issues_found)
             VALUES (?, ?, ?, ?)`,
            [data.user_id, data.repo_owner, data.repo_name, data.issues_found || 0]
        );
        return result.insertId;
    }

    async updateRun(
        id: number,
        data: Partial<Pick<AgentRun, 'status' | 'issues_found' | 'issues_processed' | 'prs_created' | 'error_message'>>
    ): Promise<void> {
        const pool = getPool();
        const fields: string[] = [];
        const values: any[] = [];

        for (const [key, value] of Object.entries(data)) {
            if (value === undefined) continue;
            fields.push(`${key} = ?`);
            values.push(value);
        }

        if (data.status === 'completed' || data.status === 'failed') {
            fields.push('completed_at = NOW()');
        }

        if (fields.length === 0) return;

        values.push(id);
        await pool.execute(
            `UPDATE agent_runs SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
    }

    async incrementIssuesProcessed(id: number): Promise<void> {
        const pool = getPool();
        await pool.execute(
            `UPDATE agent_runs SET issues_processed = issues_processed + 1 WHERE id = ?`,
            [id]
        );
    }

    async findById(id: number): Promise<AgentRun | null> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT * FROM agent_runs WHERE id = ?',
            [id]
        );
        return rows.length > 0 ? (rows[0] as AgentRun) : null;
    }

    async listByUser(
        userId: number,
        options: { status?: string; repo?: string; page?: number; limit?: number } = {}
    ): Promise<{ runs: AgentRun[]; total: number }> {
        const pool = getPool();
        const page = options.page || 1;
        const limit = Math.min(Math.max(options.limit || 20, 1), 100);
        const offset = (page - 1) * limit;

        let where = 'WHERE user_id = ?';
        const params: any[] = [userId];

        if (options.status) {
            where += ' AND status = ?';
            params.push(options.status);
        }
        if (options.repo) {
            where += ' AND repo_name = ?';
            params.push(options.repo);
        }

        const [countRows] = await pool.execute<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM agent_runs ${where}`,
            params
        );
        const total = toNumber((countRows[0] as any).total);

        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT * FROM agent_runs ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
            [...params, String(limit), String(offset)]
        );

        return { runs: rows as AgentRun[], total };
    }

    async getStats(userId: number): Promise<{
        totalRuns: number;
        issuesProcessed: number;
        prsCreated: number;
        successRate: number;
    }> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT
                COUNT(*) as totalRuns,
                COALESCE(SUM(issues_processed), 0) as issuesProcessed,
                COALESCE(SUM(prs_created), 0) as prsCreated
             FROM agent_runs WHERE user_id = ?`,
            [userId]
        );

        const stats = rows[0] as any;

        const [successRows] = await pool.execute<RowDataPacket[]>(
            `SELECT COUNT(*) as cnt FROM processed_issues WHERE user_id = ? AND status = 'success'`,
            [userId]
        );
        const [totalIssueRows] = await pool.execute<RowDataPacket[]>(
            `SELECT COUNT(*) as cnt FROM processed_issues WHERE user_id = ? AND status != 'processing'`,
            [userId]
        );

        const successCount = toNumber((successRows[0] as any).cnt);
        const totalIssueCount = toNumber((totalIssueRows[0] as any).cnt);
        const successRate = totalIssueCount > 0 ? Math.round((successCount / totalIssueCount) * 100) : 0;

        return {
            totalRuns: toNumber(stats.totalRuns),
            issuesProcessed: toNumber(stats.issuesProcessed),
            prsCreated: toNumber(stats.prsCreated),
            successRate,
        };
    }

    async getRecentRuns(userId: number, limit: number = 10): Promise<AgentRun[]> {
        const pool = getPool();
        const safeLim = Math.min(Math.max(limit, 1), 50);
        const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT * FROM agent_runs WHERE user_id = ? ORDER BY started_at DESC LIMIT ?',
            [userId, String(safeLim)]
        );
        return rows as AgentRun[];
    }

    // Processed Issues methods
    async createProcessedIssue(data: {
        run_id: number;
        user_id: number;
        repo_owner: string;
        repo_name: string;
        issue_number: number;
        issue_title: string;
        issue_url?: string;
    }): Promise<number> {
        const pool = getPool();
        const [result] = await pool.execute<ResultSetHeader>(
            `INSERT INTO processed_issues (run_id, user_id, repo_owner, repo_name, issue_number, issue_title, issue_url)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                data.run_id,
                data.user_id,
                data.repo_owner,
                data.repo_name,
                data.issue_number,
                data.issue_title,
                data.issue_url || null,
            ]
        );
        return result.insertId;
    }

    async updateProcessedIssue(
        id: number,
        data: Partial<Pick<ProcessedIssue, 'status' | 'branch_name' | 'pr_number' | 'pr_url' | 'review_approved' | 'error_message'>>
    ): Promise<void> {
        const pool = getPool();
        const fields: string[] = [];
        const values: any[] = [];

        for (const [key, value] of Object.entries(data)) {
            if (value === undefined) continue;
            fields.push(`${key} = ?`);
            values.push(value);
        }

        if (fields.length === 0) return;

        values.push(id);
        await pool.execute(
            `UPDATE processed_issues SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
    }

    async findProcessedIssueById(id: number): Promise<ProcessedIssue | null> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT * FROM processed_issues WHERE id = ?',
            [id]
        );
        return rows.length > 0 ? (rows[0] as ProcessedIssue) : null;
    }

    async getIssuesByRunId(runId: number): Promise<ProcessedIssue[]> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            'SELECT * FROM processed_issues WHERE run_id = ? ORDER BY created_at ASC',
            [runId]
        );
        return rows as ProcessedIssue[];
    }

    async listIssuesByUser(
        userId: number,
        options: { status?: string; repo?: string; page?: number; limit?: number } = {}
    ): Promise<{ issues: ProcessedIssue[]; total: number }> {
        const pool = getPool();
        const page = options.page || 1;
        const limit = Math.min(Math.max(options.limit || 20, 1), 100);
        const offset = (page - 1) * limit;

        let where = 'WHERE user_id = ?';
        const params: any[] = [userId];

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
        const total = toNumber((countRows[0] as any).total);

        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT * FROM processed_issues ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, String(limit), String(offset)]
        );

        return { issues: rows as ProcessedIssue[], total };
    }

    async getProcessedIssuesByRepoAndNumbers(
        userId: number,
        repoOwner: string,
        repoName: string,
        issueNumbers: number[]
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
}
