import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth-middleware';
import { ConfigRepository } from '../repositories/config-repository';
import { Octokit } from '@octokit/rest';

const router = Router();
const configRepo = new ConfigRepository();

const ALLOWED_KEYS = new Set([
    'github_token',
    'github_owner',
    'github_repo',
    'dev_branch',
    'issue_label',
    'webhook_secret',
    'ai_provider',
    'gemini_api_key',
    'gemini_model',
    'openai_api_key',
    'openai_model',
    'claude_api_key',
    'claude_model',
    'groq_api_key',
    'groq_model',
    'max_concurrent_agents',
    'emailjs_service_id',
    'emailjs_template_id',
    'emailjs_public_key',
    'emailjs_private_key',
]);

const VALID_PROVIDERS = new Set(['gemini', 'openai', 'claude', 'groq']);

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
    try {
        const configs = await configRepo.getAllMasked(req.user!.id);
        res.json(configs);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/', async (req: Request, res: Response) => {
    try {
        const configs = req.body;

        if (!configs || typeof configs !== 'object' || Array.isArray(configs)) {
            res.status(400).json({ error: 'Request body must be a JSON object' });
            return;
        }

        // Validate ai_provider value if present
        if (configs.ai_provider !== undefined && !VALID_PROVIDERS.has(configs.ai_provider)) {
            res.status(400).json({ error: `Invalid AI provider. Must be one of: ${[...VALID_PROVIDERS].join(', ')}` });
            return;
        }

        // Validate max_concurrent_agents if present
        if (configs.max_concurrent_agents !== undefined) {
            const val = parseInt(configs.max_concurrent_agents, 10);
            if (isNaN(val) || val < 1 || val > 10) {
                res.status(400).json({ error: 'max_concurrent_agents must be between 1 and 10' });
                return;
            }
        }

        const toSet: Record<string, string> = {};
        const toDelete: string[] = [];

        for (const [key, value] of Object.entries(configs)) {
            if (!ALLOWED_KEYS.has(key)) continue;

            if (value === undefined || value === null || value === '') {
                // Empty value = clear the config key
                toDelete.push(key);
            } else if (typeof value === 'string') {
                toSet[key] = value;
            }
        }

        // Set non-empty values
        if (Object.keys(toSet).length > 0) {
            await configRepo.setMultiple(req.user!.id, toSet);
        }

        // Delete cleared values
        for (const key of toDelete) {
            await configRepo.delete(req.user!.id, key);
        }

        const updated = await configRepo.getAllMasked(req.user!.id);
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/repos', async (req: Request, res: Response) => {
    try {
        const octokit = new Octokit({ auth: req.user!.github_access_token });
        const { data: repos } = await octokit.repos.listForAuthenticatedUser({
            sort: 'updated',
            per_page: 100,
            type: 'owner',
        });

        res.json(
            repos.map((r) => ({
                name: r.name,
                full_name: r.full_name,
                description: r.description,
                private: r.private,
                language: r.language,
                updated_at: r.updated_at,
            }))
        );
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/test', async (req: Request, res: Response) => {
    try {
        const results: Record<string, { success: boolean; message: string }> = {};

        // Test GitHub token
        try {
            const octokit = new Octokit({ auth: req.user!.github_access_token });
            const { data } = await octokit.users.getAuthenticated();
            results.github = { success: true, message: `Connected as ${data.login}` };
        } catch (error: any) {
            results.github = { success: false, message: error.message };
        }

        // Test AI provider key
        const configs = await configRepo.getAll(req.user!.id);
        const provider = configs.ai_provider || 'gemini';
        const keyMap: Record<string, string> = {
            gemini: 'gemini_api_key',
            openai: 'openai_api_key',
            claude: 'claude_api_key',
            groq: 'groq_api_key',
        };

        const apiKey = configs[keyMap[provider]];
        if (apiKey) {
            results.ai = { success: true, message: `${provider} API key configured` };
        } else {
            results.ai = { success: false, message: `No API key set for ${provider}` };
        }

        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
