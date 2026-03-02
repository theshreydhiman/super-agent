import { Router, Request, Response } from 'express';
import { config } from '../config';
import { UserRepository } from '../repositories/user-repository';
import { createLogger } from '../utils/logger';

const log = createLogger('AuthRoutes');
const router = Router();
const userRepo = new UserRepository();

router.get('/github', (_req: Request, res: Response) => {
    const params = new URLSearchParams({
        client_id: config.github.clientId,
        redirect_uri: `https://nolan-verminous-nidia.ngrok-free.dev/auth/github/callback`,
        scope: 'read:user user:email repo',
        state: Math.random().toString(36).substring(2),
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/github/callback', async (req: Request, res: Response) => {
    const { code } = req.query;

    if (!code) {
        res.status(400).json({ error: 'Missing authorization code' });
        return;
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                client_id: config.github.clientId,
                client_secret: config.github.clientSecret,
                code,
            }),
        });

        const tokenData = await tokenResponse.json() as any;

        if (tokenData.error) {
            log.error('OAuth token exchange failed', { error: tokenData.error_description });
            res.status(400).json({ error: tokenData.error_description });
            return;
        }

        // Get user info from GitHub
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });

        const githubUser = await userResponse.json() as any;

        // Get primary email
        let email: string | undefined;
        try {
            const emailResponse = await fetch('https://api.github.com/user/emails', {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            });
            const emails = await emailResponse.json() as any[];
            const primary = emails.find((e: any) => e.primary);
            email = primary?.email;
        } catch {
            // Email is optional
        }

        // Upsert user in database
        const user = await userRepo.upsert({
            github_id: githubUser.id,
            github_login: githubUser.login,
            github_avatar_url: githubUser.avatar_url,
            github_access_token: tokenData.access_token,
            email,
        });

        // Set session
        req.session.userId = user.id;

        log.info(`User ${user.github_login} logged in`);

        // Redirect to dashboard
        res.redirect('/');
    } catch (error: any) {
        log.error('OAuth callback failed', { error: error.message });
        res.status(500).json({ error: 'Authentication failed' });
    }
});

router.post('/logout', (req: Request, res: Response) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

export default router;
