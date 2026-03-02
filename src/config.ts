import dotenv from 'dotenv';
dotenv.config();

export const config = {
    // GitHub
    github: {
        token: process.env.GITHUB_TOKEN || '',
        owner: process.env.GITHUB_OWNER || '',
        repo: process.env.GITHUB_REPO || '',
        devBranch: process.env.DEV_BRANCH || 'dev',
        issueLabel: process.env.ISSUE_LABEL || 'ai-agent',
        webhookSecret: process.env.WEBHOOK_SECRET || '',
        clientId: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    },

    // AI Provider: 'gemini', 'openai', 'claude', or 'groq'
    aiProvider: (process.env.AI_PROVIDER || 'gemini') as 'gemini' | 'openai' | 'claude' | 'groq',

    // Gemini
    gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    },

    // OpenAI
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4o',
    },

    // Claude (Anthropic)
    claude: {
        apiKey: process.env.CLAUDE_API_KEY || '',
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    },

    // Groq (free, OpenAI-compatible)
    groq: {
        apiKey: process.env.GROQ_API_KEY || '',
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    },

    // EmailJS
    emailjs: {
        serviceId: process.env.EMAILJS_SERVICE_ID || '',
        templateId: process.env.EMAILJS_TEMPLATE_ID || '',
        publicKey: process.env.EMAILJS_PUBLIC_KEY || '',
        privateKey: process.env.EMAILJS_PRIVATE_KEY || '',
    },

    // Triggers
    triggers: {
        webhookMode: process.env.WEBHOOK_MODE === 'true',
        webhookPort: parseInt(process.env.WEBHOOK_PORT || '3001', 10),
    },

    // Agent
    agent: {
        maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '3', 10),
    },

    // MySQL
    mysql: {
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || 'Pass@123',
        database: process.env.MYSQL_DATABASE || 'super_agent',
    },

    // Session
    sessionSecret: process.env.SESSION_SECRET || 'super-agent-secret-change-me',

    // Encryption key for stored secrets
    encryptionKey: process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me',

    // Dashboard
    dashboard: {
        url: process.env.DASHBOARD_URL || 'http://localhost:3001',
    },
};

/** Validates that all critical config values are set */
export function validateConfig(): void {
    const required: [string, string][] = [
        ['GITHUB_TOKEN', config.github.token],
        ['GITHUB_OWNER', config.github.owner],
    ];

    if (config.github.repo) {
        console.log(`  Mode: single-repo (${config.github.owner}/${config.github.repo})`);
    } else {
        console.log(`  Mode: multi-repo (scanning all repos for ${config.github.owner})`);
    }

    if (config.aiProvider === 'openai') {
        required.push(['OPENAI_API_KEY', config.openai.apiKey]);
    } else if (config.aiProvider === 'claude') {
        required.push(['CLAUDE_API_KEY', config.claude.apiKey]);
    } else if (config.aiProvider === 'groq') {
        required.push(['GROQ_API_KEY', config.groq.apiKey]);
    } else {
        required.push(['GEMINI_API_KEY', config.gemini.apiKey]);
    }

    const missing = required.filter(([, val]) => !val).map(([key]) => key);

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            `Copy .env.example to .env and fill in the values.`
        );
    }
}
