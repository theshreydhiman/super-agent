import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth-middleware';
import { IssueRepository } from '../repositories/issue-repository';

const router = Router();
const issueRepo = new IssueRepository();

router.use(requireAuth);

router.get('/stats', async (req: Request, res: Response) => {
    try {
        const stats = await issueRepo.getStats(req.user!.id);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/recent', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const issues = await issueRepo.getRecent(req.user!.id, limit);
        res.json(issues);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
