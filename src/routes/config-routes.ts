import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth-middleware';
import { ConfigRepository } from '../repositories/config-repository';
import { Octokit } from '@octokit/rest';

const router = Router();
const configRepo = new ConfigRepository();

// ...

router.get('/config/branches/:repo', async (req: Request, res: Response) => {
    try {
        const octokit = new Octokit({ auth: req.user!.github_access_token });
        const { data: branches } = await octokit.repos.getBranches({
            owner: req.params.repo.split('/')[0],
            repo: req.params.repo.split('/')[1],
        });
        res.json(branches.map((branch) => branch.name));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ...