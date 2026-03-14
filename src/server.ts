import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import authRoutes from './routes/auth-routes';
import dashboardRoutes from './routes/dashboard-routes';
import issueRoutes from './routes/issue-routes';
import configRoutes from './routes/config-routes';
import { errorHandler } from './middleware/error-handler';
import { UserRepository } from './repositories/user-repository';
import { createLogger } from './utils/logger';

const log = createLogger('Server');
const userRepo = new UserRepository();

interface SessionStoreOptions {
    clearExpired: boolean;
    checkExpirationInterval: number;
    expiration: number;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssl?: { rejectUnauthorized: boolean };
}

function buildSessionStoreOptions(): SessionStoreOptions {
    const base: SessionStoreOptions = {
        clearExpired: true,
        checkExpirationInterval: 900000,
        expiration: 86400000,
    };

    if (config.databaseUrl) {
        const url = new URL(config.databaseUrl);
        base.host = url.hostname;
        base.port = parseInt(url.port || '3306', 10);
        base.user = url.username;
        base.password = url.password;
        base.database = url.pathname.slice(1);
        if (url.searchParams.has('ssl') || url.protocol === 'mysqls:') {
            base.ssl = { rejectUnauthorized: false };
        }
    } else {
        base.host = config.mysql.host;
        base.port = config.mysql.port;
        base.user = config.mysql.user;
        base.password = config.mysql.password;
        base.database = config.mysql.database;
    }

    return base;
}

export function createApp(): express.Application {
    const app = express();

    // CORS
    app.use(cors({
        origin: config.dashboard.url || 'http://localhost:5173',
        credentials: true,
    }));

    // Session setup
    const MySQLStore = require('express-mysql-session')(session);
    const sessionStore = new MySQLStore(buildSessionStoreOptions());

    app.use(session({
        store: sessionStore,
        secret: config.sessionSecret,
        resave: false,
        saveUninitialized: false,
        proxy: config.isProduction,
        cookie: {
            secure: config.isProduction,
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'lax',
        },
    }));

    // JSON body parser for API routes — skip /webhook so raw body is preserved for signature verification
    app.use((req, res, next) => {
        if (req.path === '/webhook') return next();
        express.json()(req, res, next);
    });

    // Auth routes
    app.use('/auth', authRoutes);

    // Session check — returns safe user info (no tokens)
    app.get('/api/auth/me', async (req, res) => {
        if (!req.session?.userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        try {
            const user = await userRepo.findById(req.session.userId);
            if (!user) {
                res.status(401).json({ error: 'User not found' });
                return;
            }
            res.json({
                id: user.id,
                github_login: user.github_login,
                github_avatar_url: user.github_avatar_url,
                email: user.email,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            log.error('Failed to fetch user for /api/auth/me', { error: message });
            res.status(500).json({ error: 'Failed to fetch user info' });
        }
    });

    // API routes
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/issues', issueRoutes);
    app.use('/api/config', configRoutes);

    // NOTE: /health and /webhook routes are registered by WebhookServer AFTER createApp().
    // The SPA fallback below explicitly skips those paths so they remain reachable.

    // Serve static dashboard in production
    const dashboardPath = path.join(__dirname, '..', 'dashboard', 'dist');
    app.use(express.static(dashboardPath));

    // SPA fallback — serve index.html for any non-API, non-health, non-webhook route
    app.get('*', (req, res, next) => {
        if (
            req.path.startsWith('/api') ||
            req.path.startsWith('/auth') ||
            req.path.startsWith('/webhook') ||
            req.path === '/health'
        ) {
            next();
            return;
        }
        res.sendFile(path.join(dashboardPath, 'index.html'), (err) => {
            if (err) {
                next();
            }
        });
    });

    // Error handler
    app.use(errorHandler);

    return app;
}
