import dotenv from 'dotenv';
dotenv.config();

export const config = {
    // GitHub OAuth (global — required for server startup)
    github: {
        clientId: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        // User-level defaults (empty — resolved per-user from DB)
        token: '',
        owner: '',
        repo: '',
        devBranch: 'main',
        issueLabel: 'ai-agent',
        webhookSecret: process.env.WEBHOOK_SECRET || '',
    },

    // User-level defaults (resolved per-user from DB)
    aiProvider: 'gemini' as 'gemini' | 'openai' | 'claude' | 'groq',

    gemini: {
        apiKey: '',
        model: 'gemini-2.0-flash',
    },

    openai: {
        apiKey: '',
        model: 'gpt-4o',
    },

    claude: {
        apiKey: '',
        model: 'claude-sonnet-4-6',
    },

    groq: {
        apiKey: '',
        model: 'llama-3.3-70b-versatile',
    },

    // EmailJS (global — from .env, not per-user)
    emailjs: {
        serviceId: process.env.EMAILJS_SERVICE_ID || '',
        templateId: process.env.EMAILJS_TEMPLATE_ID || '',
        publicKey: process.env.EMAILJS_PUBLIC_KEY || '',
        privateKey: process.env.EMAILJS_PRIVATE_KEY || '',
    },

    // Infrastructure (always from .env)
    triggers: {
        webhookMode: process.env.WEBHOOK_MODE === 'true',
        webhookPort: parseInt(process.env.WEBHOOK_PORT || '3001', 10),
    },

    agent: {
        maxConcurrentAgents: 3,
    },

    mysql: {
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || 'Pass@123',
        database: process.env.MYSQL_DATABASE || 'super_agent',
    },

    sessionSecret: process.env.SESSION_SECRET || 'super-agent-secret-change-me',
    encryptionKey: process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me',

    dashboard: {
        url: process.env.DASHBOARD_URL || 'http://localhost:3001',
    },
};
