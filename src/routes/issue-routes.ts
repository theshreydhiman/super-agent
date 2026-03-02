import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth-middleware';
import { RunRepository } from '../repositories/run-repository';

const router = Router();
const runRepo = new RunRepository();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
    try {
        const { status, repo, page, limit } = req.query;
        const result = await runRepo.listIssuesByUser(req.user!.id, {
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

export default router;
