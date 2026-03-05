import { ConfigRepository } from '../repositories/config-repository';
import { config } from '../config';

/**
 * Runtime configuration resolved from the database for a specific user.
 * Falls back to .env defaults when a key isn't set in the DB.
 */
export interface UserRuntimeConfig {
    github: {
        token: string;
        owner: string;
        repo: string;
        devBranch: string;
        issueLabel: string;
        webhookSecret: string;
    };
    aiProvider: 'gemini' | 'openai' | 'claude' | 'groq';
    gemini: { apiKey: string; model: string };
    openai: { apiKey: string; model: string };
    claude: { apiKey: string; model: string };
    groq: { apiKey: string; model: string };
    emailjs: {
        serviceId: string;
        templateId: string;
        publicKey: string;
        privateKey: string;
    };
    agent: { maxConcurrentAgents: number };
}

const configRepo = new ConfigRepository();

/**
 * Loads all user_configs from the DB and merges them with .env defaults.
 * DB values take precedence over .env.
 */
export async function getUserRuntimeConfig(userId: number): Promise<UserRuntimeConfig> {
    const db = await configRepo.getAll(userId);

    const get = (key: string, fallback: string): string =>
        db[key] ?? fallback;

    return {
        github: {
            token: get('github_token', config.github.token),
            owner: get('github_owner', config.github.owner),
            repo: get('github_repo', config.github.repo),
            devBranch: get('dev_branch', config.github.devBranch),
            issueLabel: get('issue_label', config.github.issueLabel),
            webhookSecret: get('webhook_secret', config.github.webhookSecret),
        },
        aiProvider: (get('ai_provider', config.aiProvider) as UserRuntimeConfig['aiProvider']),
        gemini: {
            apiKey: get('gemini_api_key', config.gemini.apiKey),
            model: get('gemini_model', config.gemini.model),
        },
        openai: {
            apiKey: get('openai_api_key', config.openai.apiKey),
            model: get('openai_model', config.openai.model),
        },
        claude: {
            apiKey: get('claude_api_key', config.claude.apiKey),
            model: get('claude_model', config.claude.model),
        },
        groq: {
            apiKey: get('groq_api_key', config.groq.apiKey),
            model: get('groq_model', config.groq.model),
        },
        emailjs: {
            serviceId: get('emailjs_service_id', config.emailjs.serviceId),
            templateId: get('emailjs_template_id', config.emailjs.templateId),
            publicKey: get('emailjs_public_key', config.emailjs.publicKey),
            privateKey: get('emailjs_private_key', config.emailjs.privateKey),
        },
        agent: {
            maxConcurrentAgents: parseInt(get('max_concurrent_agents', String(config.agent.maxConcurrentAgents)), 10) || 3,
        },
    };
}
