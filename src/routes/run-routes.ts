import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth-middleware';
import { RunRepository } from '../repositories/run-repository';
import { SuperAgent } from '../agents/super-agent';
import { RunTracker } from '../services/run-tracker';
import { getUserRuntimeConfig } from '../services/user-config';
import { createLogger } from '../utils/logger';

const log = createLogger('RunRoutes');
const router = Router();
const runRepo = new RunRepository();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
    try {
        const { status, repo, page, limit } = req.query;
        const result = await runRepo.listByUser(req.user!.id, {
            status: status as string,
            repo: repo as string,
            page: parseInt(page as string) || 1,
            limit: parseInt(limit as string) || 20,
        });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', async (req: Request, res: Response) => {
    try {
        const runId = parseInt(req.params.id as string);
        if (isNaN(runId)) {
            res.status(400).json({ error: 'Invalid run ID' });
            return;
        }

        const run = await runRepo.findById(runId);
        if (!run || run.user_id !== req.user!.id) {
            res.status(404).json({ error: 'Run not found' });
            return;
        }

        const issues = await runRepo.getIssuesByRunId(run.id);
        res.json({ ...run, issues });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/trigger', async (req: Request, res: Response) => {
    try {
        const { repo, rerun, issueNumber, runId } = req.body;
        if (!repo || typeof repo !== 'string') {
            res.status(400).json({ error: 'Repository name is required' });
            return;
        }

        // Load user-specific config from DB
        const userConfig = await getUserRuntimeConfig(req.user!.id);

        if (!userConfig.github.token) {
            res.status(400).json({ error: 'GitHub token not configured. Please set it in Settings.' });
            return;
        }

        if (!userConfig.github.owner) {
            res.status(400).json({ error: 'GitHub owner not configured. Please set it in Settings.' });
            return;
        }

        // Create a per-request SuperAgent with user's own credentials
        const tracker = new RunTracker(req.user!.id);
        const agent = new SuperAgent(tracker.createCallbacks(), userConfig);

        // Trigger asynchronously — skip label filter on manual reruns
        const skipLabelFilter = !!rerun;
        const targetIssue = issueNumber ? parseInt(String(issueNumber), 10) : undefined;
        const userId = req.user!.id;
        const userName = req.user!.github_login;

        // If rerunning a previous run, look up its issues to target only those
        let targetIssueNumbers: number[] | undefined;
        if (runId && rerun) {
            const prevRun = await runRepo.findById(parseInt(String(runId), 10));
            if (prevRun && prevRun.user_id === userId) {
                const prevIssues = await runRepo.getIssuesByRunId(prevRun.id);
                if (prevIssues.length > 0) {
                    targetIssueNumbers = prevIssues.map(i => i.issue_number);
                    log.info(`Rerun of run #${runId}: targeting issues [${targetIssueNumbers.join(', ')}]`);
                }
            }
        }

        setImmediate(() => {
            log.info(`Background run started for ${userConfig.github.owner}/${repo} by ${userName}${targetIssue ? ` (issue #${targetIssue})` : ''}${targetIssueNumbers ? ` (rerun issues: ${targetIssueNumbers.join(', ')})` : ''}`);
            agent.processRepo(repo, {
                skipLabelFilter,
                issueNumber: targetIssue,
                issueNumbers: targetIssueNumbers,
            }).catch((err) => {
                log.error(`Background run failed for ${userConfig.github.owner}/${repo} (user: ${userName})`, {
                    error: err.message,
                    userId,
                });
            });
        });

        res.json({ message: 'Run triggered successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
