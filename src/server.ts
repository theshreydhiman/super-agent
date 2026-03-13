
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import authRoutes from './routes/auth-routes';
import dashboardRoutes from './routes/dashboard-routes';
import issueRoutes from './routes/issue-routes';
import { configRoutes } from './routes/config-routes'; // Modified this line to use named import
import { errorHandler } from './middleware/error-handler';
import { createLogger } from './utils/logger';

const log = createLogger('Server');

export function createApp(): express.Application {
    const app = express();

    // CORS
    app.use(cors({
        origin: config.dashboard.url || 'http://localhost:5173',
        credentials: true,
    }));

    // Session setup
    const MySQLStore = require('express-mysql-session')(session);
    const sessionStoreOptions: any = {
        clearExpired: true,
        checkExpirationInterval: 900000,
        expiration: 86400000,
    };

    if (config.databaseUrl) {
        // Use DATABASE_URL for production
        const url = new URL(config.databaseUrl);
        sessionStoreOptions.host = url.hostname;
        sessionStoreOptions.port = parseInt(url.port || '3306', 10);
        sessionStoreOptions.user = url.username;
        sessionStoreOptions.password = url.password;
        sessionStoreOptions.database = url.pathname.slice(1);
        if (url.searchParams.has('ssl') || url.protocol === 'mysqls:') {
            sessionStoreOptions.ssl = { rejectUnauthorized: false };
        }
    } else {
        sessionStoreOptions.host = config.mysql.host;
        sessionStoreOptions.port = config.mysql.port;
        sessionStoreOptions.user = config.mysql.user;
        sessionStoreOptions.password = config.mysql.password;
        sessionStoreOptions.database = config.mysql.database;
    }

    const sessionStore = new MySQLStore(sessionStoreOptions);

    const isProduction = process.env.NODE_ENV === 'production';

    app.use(session({
        store: sessionStore,
        secret: config.sessionSecret,
        resave: false,
        saveUninitialized: false,
        proxy: isProduction, // Trust proxy (ngrok, load balancer) for secure cookies
        cookie: {
            secure: isProduction,
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: 'lax',
        },
    }));

    // JSON body parser for API routes — skip /webhook so raw body is preserved for signature verification
    app.use((req, res, next) => {
        if (req.path === '/webhook') return next();
        express.json()(req, res, next);
    });

    // Auth routes (no JSON body parser needed for OAuth redirects)
    app.use('/auth', authRoutes);

    // API auth check
    app.get('/api/auth/me', async (req, res) => {
        if (!req.session?.userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        try {
            const { UserRepository } = require('./repositories/user-repository');
            const userRepo = new UserRepository();
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
        } catch (err: any) {
            log.error('Failed to fetch user for /api/auth/me', { error: err.message });
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
