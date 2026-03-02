import { GitHubClient, GitHubIssue } from '../github/github-client';
import { AIEngine } from '../ai/ai-engine';
import { EmailService } from '../services/email-service';
import { WorkerAgent, WorkerResult } from './worker-agent';
import { ReviewerAgent, ReviewedPR } from './reviewer-agent';
import { createLogger } from '../utils/logger';
import { config } from '../config';

const log = createLogger('SuperAgent');

export class SuperAgent {
    private github: GitHubClient;
    private ai: AIEngine;
    private emailService: EmailService;
    private isProcessing = false;

    constructor() {
        this.github = new GitHubClient();
        this.ai = new AIEngine();
        this.emailService = new EmailService();
    }

    /**
     * Main orchestration loop:
     * 1. Fetch actionable issues
     * 2. Label them "in-progress"
     * 3. Spawn Worker Agents (concurrently, with limit)
     * 4. Wait for all workers to complete
     * 5. Spawn Reviewer Agent to create PRs
     * 6. Report results
     */
    async run(): Promise<void> {
        if (this.isProcessing) {
            log.warn('Super Agent is already processing, skipping this run');
            return;
        }

        this.isProcessing = true;
        log.info('🚀 Super Agent starting a new run...');

        try {
            // Step 1: Fetch actionable issues
            const issues = await this.github.fetchOpenIssues();

            if (issues.length === 0) {
                log.info('No actionable issues found. Sleeping...');
                return;
            }

            log.info(`Found ${issues.length} issue(s) to process`);

            // Step 2: Label all issues as "in-progress"
            for (const issue of issues) {
                await this.github.addLabel(issue.number, 'in-progress');
                log.info(`Labeled issue #${issue.number} as "in-progress"`);
            }

            // Step 3: Spawn Worker Agents (concurrently with limit)
            const workerResults = await this.spawnWorkers(issues);

            const successCount = workerResults.filter((r) => r.success).length;
            const failCount = workerResults.filter((r) => !r.success).length;

            log.info(`Workers completed: ${successCount} success, ${failCount} failed`);

            // Step 4: Spawn Reviewer Agent
            if (successCount > 0) {
                log.info('🔍 Starting Reviewer Agent...');
                const reviewer = new ReviewerAgent(this.github, this.ai, this.emailService);
                const reviewedPRs = await reviewer.reviewAndCreatePRs(workerResults);

                log.info(`✅ Run complete! ${reviewedPRs.length} PR(s) created.`);
                this.logSummary(workerResults, reviewedPRs);
            } else {
                log.warn('No successful fixes — no PRs will be created');

                // Remove "in-progress" labels from failed issues
                for (const result of workerResults) {
                    if (!result.success) {
                        await this.github.removeLabel(result.issueNumber, 'in-progress');
                    }
                }
            }
        } catch (error: any) {
            log.error('Super Agent run failed', { error: error.message });
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Spawns Worker Agents concurrently, respecting the max concurrency limit.
     */
    private async spawnWorkers(issues: GitHubIssue[]): Promise<WorkerResult[]> {
        const maxConcurrent = config.agent.maxConcurrentAgents;
        const results: WorkerResult[] = [];

        // Process in batches
        for (let i = 0; i < issues.length; i += maxConcurrent) {
            const batch = issues.slice(i, i + maxConcurrent);

            log.info(
                `Processing batch ${Math.floor(i / maxConcurrent) + 1}: ` +
                `issues ${batch.map((b) => `#${b.number}`).join(', ')}`
            );

            const batchPromises = batch.map((issue) => {
                const worker = new WorkerAgent(this.github, this.ai);
                return worker.processIssue(issue);
            });

            const batchResults = await Promise.allSettled(batchPromises);

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    log.error('Worker promise rejected', { error: result.reason });
                }
            }
        }

        return results;
    }

    /**
     * Logs a summary of the run.
     */
    private logSummary(workerResults: WorkerResult[], reviewedPRs: ReviewedPR[]): void {
        console.log('\n' + '='.repeat(60));
        console.log('  🤖 SUPER AGENT RUN SUMMARY');
        console.log('='.repeat(60));

        console.log('\n📋 Issues Processed:');
        for (const result of workerResults) {
            const status = result.success ? '✅' : '❌';
            console.log(`  ${status} #${result.issueNumber}: ${result.issueTitle}`);
            if (result.error) {
                console.log(`     Error: ${result.error}`);
            }
        }

        if (reviewedPRs.length > 0) {
            console.log('\n🔗 Pull Requests Created:');
            for (const pr of reviewedPRs) {
                const reviewIcon = pr.reviewApproved ? '✅' : '⚠️';
                console.log(`  ${reviewIcon} PR #${pr.prNumber}: ${pr.prUrl}`);
                console.log(`     For issue #${pr.issueNumber}: ${pr.issueTitle}`);
            }
        }

        console.log('\n' + '='.repeat(60) + '\n');
    }
}
