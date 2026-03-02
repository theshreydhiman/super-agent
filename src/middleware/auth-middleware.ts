import { Request, Response, NextFunction } from 'express';
import { UserRepository, User } from '../repositories/user-repository';

declare module 'express-session' {
    interface SessionData {
        userId?: number;
    }
}

declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

const userRepo = new UserRepository();

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.session?.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }

    const user = await userRepo.findById(req.session.userId);
    if (!user) {
        req.session.destroy(() => {});
        res.status(401).json({ error: 'User not found' });
        return;
    }

    req.user = user;
    next();
}
