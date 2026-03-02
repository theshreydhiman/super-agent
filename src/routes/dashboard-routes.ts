import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth-middleware';
import { RunRepository } from '../repositories/run-repository';

const router = Router();
const runRepo = new RunRepository();

router.use(requireAuth);

router.get('/stats', async (req: Request, res: Response) => {
    try {
        const stats = await runRepo.getStats(req.user!.id);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/recent', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const runs = await runRepo.getRecentRuns(req.user!.id, limit);
        res.json(runs);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
