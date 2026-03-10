import { GitHubClient } from '../github/github-client';
import { AIEngine } from '../ai/ai-engine';
import { EmailService } from '../services/email-service';
import { WorkerResult } from './worker-agent';
import { UserRuntimeConfig } from '../services/user-config';
import { createLogger } from '../utils/logger';
import { config } from '../config';

const log = createLogger('ReviewerAgent');

const REVIEW_SCORE_THRESHOLD = 7;
const MAX_REWORK_ATTEMPTS = 3;

export interface ReviewedPR {
    issueNumber: number;
    issueTitle: string;
    prNumber: number;
    prUrl: string;
    reviewApproved: boolean;
    reviewScore: number;
    reviewFeedback: string;
    reworkAttempts: number;
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
     * 2. Reviews with AI and scores out of 10
     * 3. If score < 7, re-runs the worker with review feedback (up to MAX_REWORK_ATTEMPTS)
     * 4. Creates PRs only once score >= 7 or max attempts exhausted
     * 5. Sends email notifications
     */
    async reviewAndCreatePRs(workerResults: WorkerResult[]): Promise<ReviewedPR[]> {
        const successfulResults = workerResults.filter((r) => r.success);

        if (successfulResults.length === 0) {
            log.warn('No successful worker results to review');
            return [];
        }

        log.info(`Reviewing ${successfulResults.length} completed fixes...`);

        const reviewedPRs: ReviewedPR[] = [];
        const failedReviews: {
            issueNumber: number;
            issueTitle: string;
            lastScore: number;
            reworkAttempts: number;
            lastFeedback: string;
        }[] = [];

        for (const result of successfulResults) {
            try {
                const outcome = await this.reviewWithReworkLoop(result);
                if (outcome.pr) {
                    reviewedPRs.push(outcome.pr);
                } else if (outcome.failure) {
                    failedReviews.push(outcome.failure);
                }
            } catch (error: any) {
                log.error(`Failed to review/create PR for issue #${result.issueNumber}`, {
                    error: error.message,
                });
            }
        }

        // Send consolidated email notification for successful PRs
        if (reviewedPRs.length > 0) {
            try {
                const repoFullName = `${this.cfg.github.owner}/${this.cfg.github.repo}`;
                await this.emailService.sendPRNotification(reviewedPRs, repoFullName);
                log.info(`Email notification sent for ${reviewedPRs.length} PRs`);
            } catch (error: any) {
                log.error('Failed to send email notification', { error: error.message });
            }
        }

        // Send email notification for issues that need manual intervention
        if (failedReviews.length > 0) {
            try {
                const failRepoFullName = `${this.cfg.github.owner}/${this.cfg.github.repo}`;
                await this.emailService.sendManualInterventionNotification(failedReviews, failRepoFullName);
                log.info(`Manual intervention email sent for ${failedReviews.length} issue(s)`);
            } catch (error: any) {
                log.error('Failed to send manual intervention email', { error: error.message });
            }
        }

        return reviewedPRs;
    }

    private async reviewWithReworkLoop(result: WorkerResult): Promise<{
        pr: ReviewedPR | null;
        failure: { issueNumber: number; issueTitle: string; lastScore: number; reworkAttempts: number; lastFeedback: string } | null;
    }> {
        let attempt = 0;
        let currentResult = result;

        while (true) {
            log.info(`Reviewing changes for issue #${currentResult.issueNumber} (attempt ${attempt + 1})...`);

            // Step 1: Get the diff
            const diffs = await this.github.compareBranches(
                this.cfg.github.devBranch,
                currentResult.branchName
            );

            if (diffs.length === 0) {
                log.warn(`No diffs found for branch "${currentResult.branchName}", skipping`);
                return { pr: null, failure: null };
            }

            // Step 2: Analyze diffs for suspicious patterns before AI review
            const diffWarnings = this.analyzeDiffs(diffs);
            if (diffWarnings.length > 0) {
                log.warn(`Diff analysis warnings for issue #${currentResult.issueNumber}:`, { warnings: diffWarnings });
            }

            // Append diff warnings to issue context so the reviewer is aware
            const issueBodyWithWarnings = diffWarnings.length > 0
                ? `${currentResult.issueBody || 'No description provided.'}\n\n---\n⚠️ DIFF ANALYSIS WARNINGS (review carefully):\n${diffWarnings.join('\n')}`
                : currentResult.issueBody;

            // Step 3: Review with AI (includes score)
            const review = await this.ai.reviewChanges(
                currentResult.issueTitle,
                issueBodyWithWarnings,
                diffs
            );

            log.info(`Review for issue #${currentResult.issueNumber}:`, {
                score: review.score,
                approved: review.approved,
                feedback: review.feedback.substring(0, 200),
            });

            // Step 3: Check if score meets threshold
            if (review.score >= REVIEW_SCORE_THRESHOLD) {
                log.info(`Score ${review.score}/10 meets threshold for issue #${currentResult.issueNumber}. Creating PR.`);

                // Comment the review on the issue
                await this.postReviewComment(currentResult, review, attempt, true);

                // Create the PR
                const pr = await this.createPR(currentResult, review, attempt);
                return { pr, failure: null };
            }

            // Score below threshold
            attempt++;

            if (attempt >= MAX_REWORK_ATTEMPTS) {
                log.warn(
                    `Issue #${currentResult.issueNumber} scored ${review.score}/10 after ${attempt} rework attempt(s). ` +
                    `Max attempts reached — skipping PR creation.`
                );

                await this.postReviewComment(currentResult, review, attempt, false);

                // Comment that the fix could not meet quality standards
                await this.github.addIssueComment(
                    currentResult.issueNumber,
                    `**🚨 Manual Intervention Required**\n\n` +
                    `The AI agent was unable to produce a fix that meets the quality threshold ` +
                    `(final score: ${review.score}/10, required: ${REVIEW_SCORE_THRESHOLD}/10) after ${attempt} rework attempt(s).\n\n` +
                    `**Last review feedback:** ${review.feedback}\n\n` +
                    `This issue needs to be resolved manually by a developer.`
                );

                // Add label to flag for manual attention
                try {
                    await this.github.removeLabel(currentResult.issueNumber, 'in-progress');
                    await this.github.addLabel(currentResult.issueNumber, 'needs-manual-fix');
                } catch {
                    // Best effort
                }

                return {
                    pr: null,
                    failure: {
                        issueNumber: currentResult.issueNumber,
                        issueTitle: currentResult.issueTitle,
                        lastScore: review.score,
                        reworkAttempts: attempt,
                        lastFeedback: review.feedback,
                    },
                };
            }

            // Score too low — rework
            log.info(
                `Score ${review.score}/10 below threshold for issue #${currentResult.issueNumber}. ` +
                `Requesting rework (attempt ${attempt}/${MAX_REWORK_ATTEMPTS})...`
            );

            await this.postReviewComment(currentResult, review, attempt, false);

            // Re-run the fix with review feedback
            await this.reworkFix(currentResult, review);
        }
    }

    private async postReviewComment(
        result: WorkerResult,
        review: { approved: boolean; score: number; feedback: string; suggestions: string[] },
        attempt: number,
        willCreatePR: boolean
    ): Promise<void> {
        const attemptInfo = attempt > 0 ? ` (after ${attempt} rework attempt(s))` : '';
        const reviewComment =
            `**AI Code Review for branch \`${result.branchName}\`${attemptInfo}**\n\n` +
            `**Score:** ${review.score}/10\n` +
            `**Status:** ${review.approved ? 'Approved' : 'Needs attention'}\n\n` +
            `**Feedback:** ${review.feedback}\n\n` +
            (review.suggestions.length > 0
                ? `**Suggestions:**\n${review.suggestions.map((s) => `- ${s}`).join('\n')}\n\n`
                : '') +
            (willCreatePR
                ? 'A pull request will be created for this fix.'
                : `Score is below the required threshold of ${REVIEW_SCORE_THRESHOLD}/10. The worker agent will rework the fix based on the feedback above.`);

        await this.github.addIssueComment(result.issueNumber, reviewComment);
    }

    private async reworkFix(
        result: WorkerResult,
        review: { feedback: string; suggestions: string[]; score: number }
    ): Promise<void> {
        log.info(`Reworking fix for issue #${result.issueNumber} based on review feedback...`);

        // Fetch current file contents from the fix branch
        const fileContents: Record<string, string> = {};
        for (const change of result.changes) {
            try {
                fileContents[change.filePath] = await this.github.getFileContent(
                    change.filePath,
                    result.branchName
                );
            } catch {
                log.warn(`Could not read file "${change.filePath}" from branch "${result.branchName}"`);
                fileContents[change.filePath] = change.newContent;
            }
        }

        // Build a rework approach that includes the review feedback
        const reviewContext =
            `Previous attempt scored ${review.score}/10. The reviewer provided the following feedback:\n\n` +
            `Feedback: ${review.feedback}\n\n` +
            (review.suggestions.length > 0
                ? `Suggestions to address:\n${review.suggestions.map((s) => `- ${s}`).join('\n')}\n\n`
                : '') +
            `Please fix the issues identified in the review while still addressing the original issue.`;

        // Generate improved fix
        const changes = await this.ai.generateFix(
            result.issueTitle,
            result.issueBody,
            fileContents,
            reviewContext
        );

        if (changes.length === 0) {
            log.warn(`Rework produced no changes for issue #${result.issueNumber}`);
            return;
        }

        // Commit the reworked changes to the same branch
        const fileChanges = changes.map((change) => ({
            path: change.filePath,
            content: change.newContent,
            message: `fix(#${result.issueNumber}): rework based on review feedback`,
        }));

        await this.github.commitMultipleFiles(
            fileChanges,
            result.branchName,
            `fix(#${result.issueNumber}): rework — address review feedback (score: ${review.score}/10)`
        );

        // Update the result's changes in-place so the next review sees current state
        result.changes = changes;

        log.info(`Rework committed to branch "${result.branchName}" for issue #${result.issueNumber}`);
    }

    private analyzeDiffs(diffs: { filename: string; patch: string; status: string }[]): string[] {
        const warnings: string[] = [];

        for (const diff of diffs) {
            const lines = diff.patch?.split('\n') || [];
            let additions = 0;
            let deletions = 0;

            for (const line of lines) {
                if (line.startsWith('+') && !line.startsWith('+++')) additions++;
                if (line.startsWith('-') && !line.startsWith('---')) deletions++;
            }

            if (deletions > 0 && deletions > additions * 2) {
                warnings.push(
                    `- File "${diff.filename}": ${deletions} lines deleted vs ${additions} lines added. This file lost significantly more code than it gained — verify no existing functionality was removed.`
                );
            }

            // Check for placeholder comments in additions
            for (const line of lines) {
                if (line.startsWith('+') && /\/\/\s*\.\.\./.test(line)) {
                    warnings.push(
                        `- File "${diff.filename}": Contains placeholder comment "// ..." — this likely means code was truncated instead of preserved.`
                    );
                    break;
                }
            }
        }

        return warnings;
    }

    private async createPR(
        result: WorkerResult,
        review: { approved: boolean; score: number; feedback: string },
        reworkAttempts: number
    ): Promise<ReviewedPR> {
        // Generate PR description
        const diffs = await this.github.compareBranches(
            this.cfg.github.devBranch,
            result.branchName
        );

        const prBody = await this.ai.generatePRDescription(
            result.issueTitle,
            result.issueNumber,
            diffs.map((d) => ({ filename: d.filename, patch: d.patch }))
        );

        // Create the PR
        const pr = await this.github.createPullRequest(
            result.branchName,
            this.cfg.github.devBranch,
            `fix(#${result.issueNumber}): ${result.issueTitle}`,
            prBody
        );

        // Update labels
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
            reviewScore: review.score,
            reviewFeedback: review.feedback,
            reworkAttempts,
        };
    }
}
