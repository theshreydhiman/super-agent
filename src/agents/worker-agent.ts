import { GitHubClient, GitHubIssue } from '../github/github-client';
import { AIEngine, CodeChange } from '../ai/ai-engine';
import { createLogger } from '../utils/logger';
import { config } from '../config';

const log = createLogger('WorkerAgent');

export interface WorkerResult {
    issueNumber: number;
    issueTitle: string;
    branchName: string;
    success: boolean;
    changes: CodeChange[];
    error?: string;
}

export class WorkerAgent {
    private github: GitHubClient;
    private ai: AIEngine;

    constructor(github: GitHubClient, ai: AIEngine) {
        this.github = github;
        this.ai = ai;
    }

    /**
     * Processes a single issue:
     * 1. Creates a branch from dev
     * 2. Analyzes the issue to identify target files
     * 3. Reads relevant files
     * 4. Generates code fixes using AI
     * 5. Commits the changes to the branch
     */
    async processIssue(issue: GitHubIssue): Promise<WorkerResult> {
        const branchName = `fix/issue-${issue.number}`;

        log.info(`🔧 Worker started for issue #${issue.number}: "${issue.title}"`);

        try {
            // Step 1: Create a branch from dev
            log.info(`Creating branch "${branchName}" from "${config.github.devBranch}"`);
            await this.github.createBranch(branchName, config.github.devBranch);

            // Step 2: Get the repository file tree for context
            log.info('Fetching repository file tree...');
            const repoTree = await this.github.getRepoTree(config.github.devBranch);

            // Step 3: Analyze the issue with AI
            log.info('Analyzing issue with AI...');
            const analysis = await this.ai.analyzeIssue(
                issue.title,
                issue.body,
                repoTree
            );

            log.info('AI analysis result', {
                targetFiles: analysis.targetFiles,
                approach: analysis.approach,
            });

            if (analysis.targetFiles.length === 0) {
                throw new Error('AI could not identify any files to modify for this issue');
            }

            // Step 4: Fetch the content of target files
            log.info(`Fetching ${analysis.targetFiles.length} target files...`);
            const fileContents: Record<string, string> = {};
            for (const filePath of analysis.targetFiles) {
                try {
                    fileContents[filePath] = await this.github.getFileContent(
                        filePath,
                        config.github.devBranch
                    );
                } catch {
                    log.warn(`Could not read file "${filePath}", it may be new`);
                    fileContents[filePath] = '';
                }
            }

            // Step 5: Generate code fixes
            log.info('Generating code fix with AI...');
            const changes = await this.ai.generateFix(
                issue.title,
                issue.body,
                fileContents,
                analysis.approach
            );

            if (changes.length === 0) {
                throw new Error('AI did not generate any code changes');
            }

            // Step 6: Commit all changes to the branch
            log.info(`Committing ${changes.length} file(s) to "${branchName}"...`);
            const fileChanges = changes.map((change) => ({
                path: change.filePath,
                content: change.newContent,
                message: `fix(#${issue.number}): ${change.explanation}`,
            }));

            await this.github.commitMultipleFiles(
                fileChanges,
                branchName,
                `fix(#${issue.number}): ${issue.title}\n\n${analysis.approach}`
            );

            // Step 7: Comment on the issue
            const changesSummary = changes
                .map((c) => `- **${c.filePath}**: ${c.explanation}`)
                .join('\n');

            await this.github.addIssueComment(
                issue.number,
                `🤖 **AI Agent has committed a fix to branch \`${branchName}\`**\n\n` +
                `**Approach:** ${analysis.approach}\n\n` +
                `**Changes:**\n${changesSummary}\n\n` +
                `A reviewer agent will now verify these changes and create a PR.`
            );

            log.info(`✅ Worker completed for issue #${issue.number}`);

            return {
                issueNumber: issue.number,
                issueTitle: issue.title,
                branchName,
                success: true,
                changes,
            };
        } catch (error: any) {
            log.error(`Worker failed for issue #${issue.number}`, {
                error: error.message,
            });

            // Comment on the issue about the failure
            try {
                await this.github.addIssueComment(
                    issue.number,
                    `🤖 **AI Agent encountered an error while processing this issue:**\n\n` +
                    `\`\`\`\n${error.message}\n\`\`\`\n\n` +
                    `The issue has been returned to the queue for manual review.`
                );
            } catch {
                // If we can't comment, that's okay
            }

            return {
                issueNumber: issue.number,
                issueTitle: issue.title,
                branchName,
                success: false,
                changes: [],
                error: error.message,
            };
        }
    }
}
