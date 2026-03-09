import { Router, Request, Response } from 'express';
import { Octokit } from '@octokit/rest';
import { requireAuth } from '../middleware/auth-middleware';
import { IssueRepository } from '../repositories/issue-repository';
import { SuperAgent } from '../agents/super-agent';
import { IssueTracker } from '../services/run-tracker';
import { getUserRuntimeConfig } from '../services/user-config';
import { createLogger } from '../utils/logger';

const log = createLogger('IssueRoutes');
const router = Router();
const issueRepo = new IssueRepository();

router.use(requireAuth);

// Fetch all open issues with ai-agent label from GitHub, merged with DB processing status
router.get('/', async (req: Request, res: Response) => {
    try {
        const { repo: repoFilter } = req.query;
        const owner = req.user!.github_login;
        const token = req.user!.github_access_token;

        if (!token) {
            res.status(400).json({ error: 'GitHub access token not available. Please re-login.' });
            return;
        }

        const octokit = new Octokit({ auth: token });

        // Get repos to scan
        let repoNames: string[];
        if (repoFilter && typeof repoFilter === 'string') {
            repoNames = [repoFilter];
        } else {
            const { data: repos } = await octokit.repos.listForAuthenticatedUser({
                sort: 'updated',
                per_page: 100,
                type: 'owner',
            });
            repoNames = repos.filter((r) => !r.archived).map((r) => r.name);
        }

        // Fetch ai-agent issues from each repo in parallel
        const allIssues: {
            issue_number: number;
            issue_title: string;
            issue_url: string;
            repo_owner: string;
            repo_name: string;
            labels: string[];
            status: string;
            branch_name: string | null;
            pr_number: number | null;
            pr_url: string | null;
            error_message: string | null;
            created_at: string;
        }[] = [];

        const results = await Promise.allSettled(
            repoNames.map(async (repoName) => {
                const { data: ghIssues } = await octokit.issues.listForRepo({
                    owner,
                    repo: repoName,
                    state: 'open',
                    labels: 'ai-agent',
                    per_page: 100,
                });

                const issues = ghIssues.filter((i) => !i.pull_request);
                if (issues.length === 0) return;

                // Bulk lookup processing status from DB
                const issueNumbers = issues.map((i) => i.number);
                const processed = await issueRepo.getByRepoAndNumbers(
                    req.user!.id, owner, repoName, issueNumbers
                );

                const processedMap = new Map<number, typeof processed[0]>();
                for (const p of processed) {
                    const existing = processedMap.get(p.issue_number);
                    if (!existing || new Date(p.created_at) > new Date(existing.created_at)) {
                        processedMap.set(p.issue_number, p);
                    }
                }

                // Fetch open PRs for this repo to match with issues
                let prMap = new Map<number, { pr_number: number; pr_url: string }>();
                try {
                    const { data: prs } = await octokit.pulls.list({
                        owner,
                        repo: repoName,
                        state: 'open',
                        per_page: 100,
                    });
                    for (const pr of prs) {
                        const match = pr.head.ref.match(/^fix\/issue-(\d+)$/);
                        if (match) {
                            prMap.set(parseInt(match[1]), {
                                pr_number: pr.number,
                                pr_url: pr.html_url,
                            });
                        }
                    }
                } catch {
                    // Ignore PR fetch errors
                }

                for (const issue of issues) {
                    const p = processedMap.get(issue.number);
                    const labels = issue.labels.map((l) =>
                        typeof l === 'string' ? l : l.name || ''
                    );

                    let status = 'pending';
                    if (p) {
                        status = p.status;
                    } else if (labels.includes('ai-pr-created')) {
                        status = 'pr_created';
                    } else if (labels.includes('in-progress')) {
                        status = 'working';
                    }

                    const ghPr = prMap.get(issue.number);
                    const pr_number = p?.pr_number || ghPr?.pr_number || null;
                    const pr_url = p?.pr_url || ghPr?.pr_url || null;

                    if (pr_url && status === 'pending') {
                        status = 'pr_created';
                    }

                    allIssues.push({
                        issue_number: issue.number,
                        issue_title: issue.title,
                        issue_url: issue.html_url,
                        repo_owner: owner,
                        repo_name: repoName,
                        labels,
                        status,
                        branch_name: p?.branch_name || null,
                        pr_number,
                        pr_url,
                        error_message: p?.error_message || null,
                        created_at: issue.created_at,
                    });
                }
            })
        );

        for (const result of results) {
            if (result.status === 'rejected') {
                log.warn('Failed to fetch issues for a repository', { error: result.reason?.message });
            }
        }

        allIssues.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        res.json({ issues: allIssues, total: allIssues.length });
    } catch (error: any) {
        log.error('Failed to fetch issues', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Trigger fix for an issue
router.post('/trigger', async (req: Request, res: Response) => {
    try {
        const { repo, issueNumber, rerun } = req.body;
        if (!repo || typeof repo !== 'string') {
            res.status(400).json({ error: 'Repository name is required' });
            return;
        }
        if (!issueNumber) {
            res.status(400).json({ error: 'Issue number is required' });
            return;
        }

        const userConfig = await getUserRuntimeConfig(req.user!.id, req.user!.github_access_token, req.user!.github_login);

        if (!userConfig.github.owner) {
            res.status(400).json({ error: 'GitHub owner not configured. Please set it in Settings.' });
            return;
        }

        const userId = req.user!.id;
        const userName = req.user!.github_login;
        const targetIssue = parseInt(String(issueNumber), 10);

        // For retries, find existing DB record to update in-place
        let existingIssueMap: Map<number, number> | undefined;
        if (rerun) {
            const existing = await issueRepo.findLatestByIssueNumber(
                userId, userConfig.github.owner, repo, targetIssue
            );
            if (existing) {
                existingIssueMap = new Map([[existing.issue_number, existing.id]]);
                log.info(`Retry of issue #${targetIssue}: updating existing DB record #${existing.id}`);
            }
        }

        const tracker = new IssueTracker(userId, existingIssueMap);
        const agent = new SuperAgent(tracker.createCallbacks(), userConfig, req.user!.email);

        setImmediate(() => {
            log.info(`Fix triggered for ${userConfig.github.owner}/${repo} issue #${targetIssue} by ${userName}`);
            agent.processRepo(repo, {
                skipLabelFilter: !!rerun,
                issueNumber: targetIssue,
            }).catch((err) => {
                log.error(`Fix failed for ${userConfig.github.owner}/${repo} issue #${targetIssue}`, {
                    error: err.message, userId,
                });
            });
        });

        res.json({ message: `Fix triggered for issue #${targetIssue}` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
