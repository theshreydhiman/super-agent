import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth-middleware';
import { RunRepository } from '../repositories/run-repository';
import { SuperAgent } from '../agents/super-agent';

const router = Router();
const runRepo = new RunRepository();

let superAgentRef: SuperAgent | null = null;

export function setRunRoutesSuperAgent(agent: SuperAgent): void {
    superAgentRef = agent;
}

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
        const run = await runRepo.findById(parseInt(req.params.id as string));
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
        const { repo } = req.body;
        if (!repo) {
            res.status(400).json({ error: 'Repository name is required' });
            return;
        }

        if (!superAgentRef) {
            res.status(503).json({ error: 'Super Agent not initialized' });
            return;
        }

        // Create run record
        const runId = await runRepo.createRun({
            user_id: req.user!.id,
            repo_owner: req.user!.github_login,
            repo_name: repo,
        });

        // Trigger asynchronously
        setImmediate(() => {
            superAgentRef!.processRepo(repo).then(async () => {
                await runRepo.updateRun(runId, { status: 'completed' });
            }).catch(async (err) => {
                await runRepo.updateRun(runId, { status: 'failed', error_message: err.message });
            });
        });

        res.json({ runId, message: 'Run triggered successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
