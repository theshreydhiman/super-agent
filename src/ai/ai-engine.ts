import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { UserRuntimeConfig } from '../services/user-config';
import { createLogger } from '../utils/logger';
import { withRetry } from '../utils/retry';

const log = createLogger('AIEngine');

export interface CodeChange {
    filePath: string;
    originalContent: string | null;
    newContent: string;
    explanation: string;
}

export interface AnalysisResult {
    targetFiles: string[];
    approach: string;
    reasoning: string;
}

export interface ReviewResult {
    approved: boolean;
    feedback: string;
    suggestions: string[];
}

/**
 * Safely parse a JSON string from an LLM response.
 * Handles common issues like markdown code fences wrapping the JSON.
 */
function safeParseJSON<T>(raw: string, label: string): T {
    let text = raw.trim();

    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    const fenceMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
    if (fenceMatch) {
        text = fenceMatch[1].trim();
    }

    if (!text) {
        throw new Error(`${label}: AI returned empty response`);
    }

    try {
        return JSON.parse(text) as T;
    } catch (err: any) {
        log.error(`${label}: Failed to parse AI JSON response`, {
            error: err.message,
            responsePreview: text.substring(0, 300),
        });
        throw new Error(`${label}: AI returned invalid JSON — ${err.message}`);
    }
}

export class AIEngine {
    private provider: 'gemini' | 'openai' | 'claude' | 'groq';
    private cfg: UserRuntimeConfig | typeof config;
    private initialized = false;

    // Gemini
    private genAI?: GoogleGenerativeAI;
    private geminiModel?: GenerativeModel;

    // OpenAI-compatible (used for both OpenAI and Groq)
    private openai?: OpenAI;
    private openaiModel?: string;

    // Claude (Anthropic)
    private anthropic?: Anthropic;
    private claudeModel?: string;

    constructor(userConfig?: UserRuntimeConfig) {
        this.cfg = userConfig || config;
        this.provider = this.cfg.aiProvider;
        log.info(`AI Engine created (provider: ${this.provider}, lazy init)`);
    }

    /** Lazily initializes the AI client on first use. Throws if API key is missing. */
    private ensureInitialized(): void {
        if (this.initialized) return;

        if (this.provider === 'openai') {
            if (!this.cfg.openai.apiKey) throw new Error('OpenAI API key is required. Set it in Settings.');
            this.openai = new OpenAI({ apiKey: this.cfg.openai.apiKey });
            this.openaiModel = this.cfg.openai.model;
            log.info(`AI Engine initialized with OpenAI (${this.openaiModel})`);
        } else if (this.provider === 'groq') {
            if (!this.cfg.groq.apiKey) throw new Error('Groq API key is required. Set it in Settings.');
            this.openai = new OpenAI({
                apiKey: this.cfg.groq.apiKey,
                baseURL: 'https://api.groq.com/openai/v1',
            });
            this.openaiModel = this.cfg.groq.model;
            log.info(`AI Engine initialized with Groq (${this.openaiModel})`);
        } else if (this.provider === 'claude') {
            if (!this.cfg.claude.apiKey) throw new Error('Claude API key is required. Set it in Settings.');
            this.anthropic = new Anthropic({ apiKey: this.cfg.claude.apiKey });
            this.claudeModel = this.cfg.claude.model;
            log.info(`AI Engine initialized with Claude (${this.claudeModel})`);
        } else {
            if (!this.cfg.gemini.apiKey) throw new Error('Gemini API key is required. Set it in Settings.');
            this.genAI = new GoogleGenerativeAI(this.cfg.gemini.apiKey);
            this.geminiModel = this.genAI.getGenerativeModel({
                model: this.cfg.gemini.model,
                generationConfig: {
                    responseMimeType: 'application/json',
                },
            });
            log.info(`AI Engine initialized with Gemini (${this.cfg.gemini.model})`);
        }

        this.initialized = true;
    }

    private async callLLM(opts: {
        systemPrompt: string;
        userPrompt: string;
        temperature: number;
        jsonMode: boolean;
        maxTokens?: number;
    }): Promise<string> {
        this.ensureInitialized();

        if (this.provider === 'openai' || this.provider === 'groq') {
            const response = await this.openai!.chat.completions.create({
                model: this.openaiModel!,
                messages: [
                    { role: 'system', content: opts.systemPrompt },
                    { role: 'user', content: opts.userPrompt },
                ],
                temperature: opts.temperature,
                max_tokens: opts.maxTokens,
                ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('AI returned empty response (no content in choices)');
            }
            return content;
        } else if (this.provider === 'claude') {
            const prompt = opts.jsonMode
                ? `${opts.userPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON, no other text.`
                : opts.userPrompt;

            const response = await this.anthropic!.messages.create({
                model: this.claudeModel!,
                max_tokens: opts.maxTokens || 4096,
                temperature: opts.temperature,
                system: opts.systemPrompt,
                messages: [
                    { role: 'user', content: prompt },
                ],
            });

            const block = response.content[0];
            if (!block || block.type !== 'text' || !block.text) {
                throw new Error('AI returned empty response (no text block)');
            }
            return block.text;
        } else {
            const model = opts.jsonMode
                ? this.geminiModel!
                : this.genAI!.getGenerativeModel({ model: this.cfg.gemini.model });

            const result = await model.generateContent({
                contents: [
                    { role: 'user', parts: [{ text: `${opts.systemPrompt}\n\n${opts.userPrompt}` }] },
                ],
                generationConfig: {
                    temperature: opts.temperature,
                    ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
                    ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
                },
            });

            const text = result.response.text();
            if (!text) {
                throw new Error('AI returned empty response (no text in Gemini response)');
            }
            return text;
        }
    }

    /**
     * Analyzes a GitHub issue and determines which files need to be modified.
     */
    async analyzeIssue(
        issueTitle: string,
        issueBody: string | null,
        repoTree: string[]
    ): Promise<AnalysisResult> {
        return withRetry(async () => {
            log.info('Analyzing issue with AI', { issueTitle });

            const systemPrompt = `You are an expert software engineer analyzing a GitHub issue to determine which files need changes.
You are given the issue details and the full repository file tree.

Respond with a JSON object:
{
  "targetFiles": ["path/to/file1.ts", "path/to/file2.ts"],
  "approach": "Brief description of the fix approach",
  "reasoning": "Why these files need to be changed"
}

Rules:
- Only select files that actually exist in the repo tree
- Be precise — don't include files that don't need changes
- Focus on the most likely files to fix the issue
- Limit to at most 5 target files`;

            const userPrompt = `## Issue: ${issueTitle}

${issueBody || 'No description provided.'}

## Repository File Tree:
\`\`\`
${repoTree.join('\n')}
\`\`\``;

            const content = await this.callLLM({
                systemPrompt,
                userPrompt,
                temperature: 0.2,
                jsonMode: true,
            });

            const parsed = safeParseJSON<AnalysisResult>(content, 'analyzeIssue');

            // Validate response shape
            if (!Array.isArray(parsed.targetFiles)) {
                throw new Error('analyzeIssue: AI response missing targetFiles array');
            }

            // Filter target files to only those in the repo tree
            const treeSet = new Set(repoTree);
            const validFiles = parsed.targetFiles.filter(f => treeSet.has(f));
            if (validFiles.length === 0 && parsed.targetFiles.length > 0) {
                log.warn('AI suggested files not found in repo tree', { suggested: parsed.targetFiles });
            }

            parsed.targetFiles = validFiles;

            log.info('Analysis complete', {
                targetFiles: parsed.targetFiles,
                approach: parsed.approach,
            });

            return parsed;
        }, 'analyzeIssue');
    }

    /**
     * Generates code fixes for an issue given the relevant file contents.
     */
    async generateFix(
        issueTitle: string,
        issueBody: string | null,
        fileContents: Record<string, string>,
        approach: string
    ): Promise<CodeChange[]> {
        return withRetry(async () => {
            log.info('Generating code fix with AI', { issueTitle });

            const filesContext = Object.entries(fileContents)
                .map(
                    ([path, content]) =>
                        `### File: ${path}\n\`\`\`\n${content}\n\`\`\``
                )
                .join('\n\n');

            const systemPrompt = `You are an expert software engineer. Fix the GitHub issue by modifying the provided files.

Respond with a JSON object:
{
  "changes": [
    {
      "filePath": "path/to/file.ts",
      "newContent": "...complete new file content...",
      "explanation": "What was changed and why"
    }
  ]
}

Rules:
- Provide the COMPLETE new file content (not a diff/patch)
- Make minimal changes needed to fix the issue
- Maintain existing code style and conventions
- Add comments where appropriate to explain non-obvious changes
- Make sure the code compiles and is correct
- If you need to create a new file, use originalContent: null`;

            const userPrompt = `## Issue: ${issueTitle}

${issueBody || 'No description provided.'}

## Planned Approach:
${approach}

## Files to Modify:
${filesContext}`;

            const content = await this.callLLM({
                systemPrompt,
                userPrompt,
                temperature: 0.2,
                jsonMode: true,
                maxTokens: 16000,
            });

            const parsed = safeParseJSON<{ changes?: any[] }>(content, 'generateFix');

            if (!Array.isArray(parsed.changes)) {
                throw new Error('generateFix: AI response missing changes array');
            }

            const changes: CodeChange[] = parsed.changes
                .filter((c: any) => c.filePath && typeof c.newContent === 'string')
                .map((c: any) => ({
                    filePath: c.filePath,
                    originalContent: fileContents[c.filePath] || null,
                    newContent: c.newContent,
                    explanation: c.explanation || 'No explanation provided',
                }));

            if (changes.length === 0) {
                throw new Error('AI generated no valid file changes (missing filePath or newContent)');
            }

            log.info(`Generated ${changes.length} file changes`);
            return changes;
        }, 'generateFix');
    }

    /**
     * Reviews code changes made by a Worker Agent for correctness and quality.
     */
    async reviewChanges(
        issueTitle: string,
        issueBody: string | null,
        diffs: { filename: string; patch: string; status: string }[]
    ): Promise<ReviewResult> {
        return withRetry(async () => {
            log.info('Reviewing changes with AI', { issueTitle });

            const diffsContext = diffs
                .map(
                    (d) =>
                        `### ${d.status.toUpperCase()}: ${d.filename}\n\`\`\`diff\n${d.patch}\n\`\`\``
                )
                .join('\n\n');

            const systemPrompt = `You are a senior code reviewer. Review the following code changes made to fix a GitHub issue.

Respond with a JSON object:
{
  "approved": true/false,
  "feedback": "Overall assessment of the changes",
  "suggestions": ["suggestion 1", "suggestion 2"]
}

Review criteria:
- Does the change actually fix the described issue?
- Is the code correct and free of bugs?
- Does it maintain existing conventions?
- Are there any edge cases not handled?
- Is the change minimal and focused?

Be pragmatic — approve if the fix is reasonable even if not perfect.`;

            const userPrompt = `## Issue: ${issueTitle}

${issueBody || 'No description provided.'}

## Changes Made:
${diffsContext}`;

            const content = await this.callLLM({
                systemPrompt,
                userPrompt,
                temperature: 0.3,
                jsonMode: true,
            });

            const parsed = safeParseJSON<ReviewResult>(content, 'reviewChanges');

            // Validate and set defaults
            if (typeof parsed.approved !== 'boolean') {
                log.warn('AI review response missing approved field, defaulting to false');
                parsed.approved = false;
            }
            if (!parsed.feedback) {
                parsed.feedback = 'No feedback provided';
            }
            if (!Array.isArray(parsed.suggestions)) {
                parsed.suggestions = [];
            }

            log.info('Review complete', {
                approved: parsed.approved,
                feedbackPreview: parsed.feedback.substring(0, 100),
            });

            return parsed;
        }, 'reviewChanges');
    }

    /**
     * Generates a descriptive PR body summarizing the changes.
     */
    async generatePRDescription(
        issueTitle: string,
        issueNumber: number,
        changes: { filename: string; patch: string }[]
    ): Promise<string> {
        return withRetry(async () => {
            const changesContext = changes
                .map((c) => `- **${c.filename}**: ${c.patch.split('\n').length} lines changed`)
                .join('\n');

            const systemPrompt = `Generate a clear, professional pull request description in Markdown.
Include:
- A summary of what was fixed
- A "Closes #<issue_number>" reference
- A list of changes made
- Any notes for the reviewer

Keep it concise but informative.`;

            const userPrompt = `Issue #${issueNumber}: ${issueTitle}

Files changed:
${changesContext}`;

            const content = await this.callLLM({
                systemPrompt,
                userPrompt,
                temperature: 0.4,
                jsonMode: false,
            });

            return content || `Fixes #${issueNumber}: ${issueTitle}`;
        }, 'generatePRDescription');
    }
}
