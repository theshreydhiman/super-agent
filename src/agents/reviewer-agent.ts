import { GitHubClient } from '../github/github-client';
import { AIEngine } from '../ai/ai-engine';
import { EmailService } from '../services/email-service';
import { WorkerResult } from './worker-agent';
import { UserRuntimeConfig } from '../services/user-config';
import { createLogger } from '../utils/logger';
import { config } from '../config';

const log = createLogger('ReviewerAgent');

export interface ReviewedPR {
    issueNumber: number;
    issueTitle: string;
    prNumber: number;
    prUrl: string;
    reviewApproved: boolean;
    reviewFeedback: string;
}

export class ReviewerAgent {
    private github: GitHubClient;
    private ai: AIEngine;
    private emailService: EmailService;
    private cfg: UserRuntimeConfig | typeof config;

    constructor(github: GitHubClient, ai: AIEngine, emailService: EmailService, userConfig?: UserRuntimeConfig) {
        this.github = github;
        this.ai = ai;
        this.emailService = emailService;
        this.cfg = userConfig || config;
    }

    /**
     * Reviews all completed worker results and creates PRs.
     * 1. Fetches the diff for each branch
     * 2. Reviews with AI
     * 3. Creates PRs for approved changes
     * 4. Sends email notifications
     */
    async reviewAndCreatePRs(workerResults: WorkerResult[]): Promise<ReviewedPR[]> {
        const successfulResults = workerResults.filter((r) => r.success);

        if (successfulResults.length === 0) {
            log.warn('No successful worker results to review');
            return [];
        }

        log.info(`Reviewing ${successfulResults.length} completed fixes...`);

        const reviewedPRs: ReviewedPR[] = [];

        for (const result of successfulResults) {
            try {
                const pr = await this.reviewAndCreateSinglePR(result);
                if (pr) {
                    reviewedPRs.push(pr);
                }
            } catch (error: any) {
                log.error(`Failed to review/create PR for issue #${result.issueNumber}`, {
                    error: error.message,
                });
            }
        }

        // Send consolidated email notification
        if (reviewedPRs.length > 0) {
            try {
                await this.emailService.sendPRNotification(reviewedPRs);
                log.info(`Email notification sent for ${reviewedPRs.length} PRs`);
            } catch (error: any) {
                log.error('Failed to send email notification', { error: error.message });
            }
        }

        return reviewedPRs;
    }

    private async reviewAndCreateSinglePR(result: WorkerResult): Promise<ReviewedPR | null> {
        log.info(`Reviewing changes for issue #${result.issueNumber}...`);

        // Step 1: Get the diff between dev and the fix branch
        const diffs = await this.github.compareBranches(
            this.cfg.github.devBranch,
            result.branchName
        );

        if (diffs.length === 0) {
            log.warn(`No diffs found for branch "${result.branchName}", skipping`);
            return null;
        }

        // Step 2: Review the changes with AI (pass actual issue body for context)
        const review = await this.ai.reviewChanges(
            result.issueTitle,
            result.issueBody,
            diffs
        );

        log.info(`Review for issue #${result.issueNumber}:`, {
            approved: review.approved,
            feedback: review.feedback.substring(0, 200),
        });

        // Step 3: Comment review feedback on the issue
        const reviewComment =
            `**AI Code Review for branch \`${result.branchName}\`**\n\n` +
            `**Status:** ${review.approved ? 'Approved' : 'Needs attention'}\n\n` +
            `**Feedback:** ${review.feedback}\n\n` +
            (review.suggestions.length > 0
                ? `**Suggestions:**\n${review.suggestions.map((s) => `- ${s}`).join('\n')}\n\n`
                : '') +
            (review.approved
                ? 'A pull request will be created for this fix.'
                : 'A PR will still be created, but please review the suggestions above.');

        await this.github.addIssueComment(result.issueNumber, reviewComment);

        // Step 4: Generate PR description
        const prBody = await this.ai.generatePRDescription(
            result.issueTitle,
            result.issueNumber,
            diffs.map((d) => ({ filename: d.filename, patch: d.patch }))
        );

        // Step 5: Create the PR (even if review has suggestions — let the human decide)
        const pr = await this.github.createPullRequest(
            result.branchName,
            this.cfg.github.devBranch,
            `fix(#${result.issueNumber}): ${result.issueTitle}`,
            prBody
        );

        // Step 6: Update labels
        try {
            await this.github.removeLabel(result.issueNumber, 'in-progress');
            await this.github.addLabel(result.issueNumber, 'ai-pr-created');
        } catch (labelErr: any) {
            log.warn(`Failed to update labels for issue #${result.issueNumber}`, { error: labelErr.message });
        }

        log.info(`PR #${pr.number} created for issue #${result.issueNumber}: ${pr.url}`);

        return {
            issueNumber: result.issueNumber,
            issueTitle: result.issueTitle,
            prNumber: pr.number,
            prUrl: pr.url,
            reviewApproved: review.approved,
            reviewFeedback: review.feedback,
        };
    }
}
