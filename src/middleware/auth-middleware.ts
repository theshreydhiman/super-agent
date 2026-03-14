import { Request, Response, NextFunction } from 'express';
import { UserRepository, User } from '../repositories/user-repository';
import { createLogger } from '../utils/logger';

const log = createLogger('AuthMiddleware');

/** User data safe to attach to requests — excludes sensitive fields like access tokens */
export interface SafeUser {
    id: number;
    github_id: number;
    github_login: string;
    github_avatar_url: string | null;
    email: string | null;
}

declare module 'express-session' {
    interface SessionData {
        userId?: number;
        oauthState?: string;
    }
}

declare global {
    namespace Express {
        interface Request {
            user?: SafeUser;
        }
    }
}

const userRepo = new UserRepository();

// Cache full user objects for getAccessToken lookups within the same request cycle
const userCache = new WeakMap<Request, User>();

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.session?.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }

    try {
        const user = await userRepo.findById(req.session.userId);
        if (!user) {
            req.session.destroy(() => {});
            res.status(401).json({ error: 'User not found' });
            return;
        }

        // Attach only safe fields to req.user
        req.user = {
            id: user.id,
            github_id: user.github_id,
            github_login: user.github_login,
            github_avatar_url: user.github_avatar_url,
            email: user.email,
        };

        // Cache full user for getAccessToken
        userCache.set(req, user);
        next();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.error('Auth middleware failed', { error: message, userId: req.session.userId });
        res.status(500).json({ error: 'Authentication check failed' });
    }
}

/** Retrieve the GitHub access token for an authenticated request */
export function getAccessToken(req: Request): string {
    const user = userCache.get(req);
    if (!user?.github_access_token) {
        throw new Error('No GitHub access token available. User must re-login.');
    }
    return user.github_access_token;
}
