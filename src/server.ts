import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import authRoutes from './routes/auth-routes';
import dashboardRoutes from './routes/dashboard-routes';
import runRoutes from './routes/run-routes';
import issueRoutes from './routes/issue-routes';
import configRoutes from './routes/config-routes';
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
    const sessionStore = new MySQLStore({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
        clearExpired: true,
        checkExpirationInterval: 900000,
        expiration: 86400000,
    });

    app.use(session({
        store: sessionStore,
        secret: config.sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // Set to true in production with HTTPS
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
    }));

    // JSON body parser for API routes
    app.use(express.json());

    // Auth routes (no JSON body parser needed for OAuth redirects)
    app.use('/auth', authRoutes);

    // API auth check
    app.get('/api/auth/me', (req, res) => {
        if (!req.session?.userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const { UserRepository } = require('./repositories/user-repository');
        const userRepo = new UserRepository();
        userRepo.findById(req.session.userId).then((user: any) => {
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
        }).catch((err: any) => {
            res.status(500).json({ error: err.message });
        });
    });

    // API routes
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/runs', runRoutes);
    app.use('/api/issues', issueRoutes);
    app.use('/api/config', configRoutes);

    // Serve static dashboard in production
    const dashboardPath = path.join(__dirname, '..', 'dashboard', 'dist');
    app.use(express.static(dashboardPath));

    // SPA fallback — serve index.html for any non-API route
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/webhook') || req.path.startsWith('/health')) {
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
