import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { config } from '../config';
import { UserRepository } from '../repositories/user-repository';
import { createLogger } from '../utils/logger';

const log = createLogger('AuthRoutes');
const router = Router();
const userRepo = new UserRepository();

/** GitHub OAuth token exchange response */
interface GitHubTokenResponse {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
}

/** GitHub user profile from /user endpoint */
interface GitHubUser {
    id: number;
    login: string;
    avatar_url: string;
}

/** GitHub email entry from /user/emails endpoint */
interface GitHubEmail {
    email: string;
    primary: boolean;
    verified: boolean;
}

router.get('/github', (req: Request, res: Response) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;

    const baseUrl = config.dashboard.url || `${req.protocol}://${req.get('host')}`;
    const params = new URLSearchParams({
        client_id: config.github.clientId,
        redirect_uri: `${baseUrl}/auth/github/callback`,
        scope: 'read:user user:email repo',
        state,
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/github/callback', async (req: Request, res: Response) => {
    const { code, state } = req.query;

    if (!code) {
        res.status(400).json({ error: 'Missing authorization code' });
        return;
    }

    if (!state || state !== req.session.oauthState) {
        log.warn('OAuth state mismatch');
        res.status(403).json({ error: 'Invalid OAuth state' });
        return;
    }
    delete req.session.oauthState;

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

        const tokenData = await tokenResponse.json() as GitHubTokenResponse;

        if (tokenData.error || !tokenData.access_token) {
            log.error('OAuth token exchange failed', { error: tokenData.error_description });
            res.status(400).json({ error: tokenData.error_description || 'Token exchange failed' });
            return;
        }

        const accessToken = tokenData.access_token;

        // Get user info from GitHub
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });

        if (!userResponse.ok) {
            log.error('Failed to fetch GitHub user', { status: userResponse.status });
            res.status(502).json({ error: 'Failed to fetch GitHub user info' });
            return;
        }

        const githubUser = await userResponse.json() as GitHubUser;

        // Get primary email
        let email: string | undefined;
        try {
            const emailResponse = await fetch('https://api.github.com/user/emails', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            });
            const emails = await emailResponse.json() as GitHubEmail[];
            const primary = emails.find((e) => e.primary);
            email = primary?.email;
        } catch {
            // Email is optional
        }

        // Upsert user in database
        const user = await userRepo.upsert({
            github_id: githubUser.id,
            github_login: githubUser.login,
            github_avatar_url: githubUser.avatar_url,
            github_access_token: accessToken,
            email,
        });

        req.session.userId = user.id;
        log.info(`User ${user.github_login} logged in`);
        res.redirect('/');
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.error('OAuth callback failed', { error: message });
        res.status(500).json({ error: 'Authentication failed' });
    }
});

router.post('/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
        if (err) {
            log.error('Session destroy failed', { error: err.message });
        }
        res.json({ success: true });
    });
});

export default router;
