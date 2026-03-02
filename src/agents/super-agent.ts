import { GitHubClient, GitHubIssue } from '../github/github-client';
import { AIEngine } from '../ai/ai-engine';
import { EmailService } from '../services/email-service';
import { WorkerAgent, WorkerResult } from './worker-agent';
import { ReviewerAgent, ReviewedPR } from './reviewer-agent';
import { AgentCallbacks } from '../services/run-tracker';
import { createLogger } from '../utils/logger';
import { config } from '../config';

const log = createLogger('SuperAgent');

export class SuperAgent {
    private discoveryClient: GitHubClient;
    private ai: AIEngine;
    private emailService: EmailService;
    private processingRepos = new Set<string>();
    private callbacks?: AgentCallbacks;

    constructor(callbacks?: AgentCallbacks) {
        this.discoveryClient = new GitHubClient();
        this.ai = new AIEngine();
        this.emailService = new EmailService();
        this.callbacks = callbacks;
    }

    setCallbacks(callbacks: AgentCallbacks): void {
        this.callbacks = callbacks;
    }

    async run(): Promise<void> {
        log.info('Super Agent starting a new run...');

        try {
            const repos = await this.getTargetRepos();
            log.info(`Targeting ${repos.length} repo(s): ${repos.join(', ')}`);

            for (const repoName of repos) {
                await this.processRepo(repoName);
            }
        } catch (error: any) {
            log.error('Super Agent run failed', { error: error.message });
        }
    }

    private async getTargetRepos(): Promise<string[]> {
        if (config.github.repo) {
            return [config.github.repo];
        }
        return this.discoveryClient.listOwnerRepos();
    }

    async processRepo(repoName: string): Promise<void> {
        if (this.processingRepos.has(repoName)) {
            log.warn(`Already processing ${repoName}, skipping`);
            return;
        }

        this.processingRepos.add(repoName);
        const github = new GitHubClient(config.github.owner, repoName);
        let runId: number | undefined;

        try {
            log.info(`--- Processing repo: ${config.github.owner}/${repoName} ---`);

            const issues = await github.fetchOpenIssues();

            if (issues.length === 0) {
                log.info(`No actionable issues in ${repoName}. Skipping.`);
                return;
            }

            log.info(`Found ${issues.length} issue(s) in ${repoName}`);

            // Track run start
            if (this.callbacks?.onRunStart) {
                runId = await this.callbacks.onRunStart(config.github.owner, repoName, issues.length);
            }

            // Label all issues as "in-progress"
            for (const issue of issues) {
                await github.addLabel(issue.number, 'in-progress');
                log.info(`Labeled issue #${issue.number} as "in-progress"`);
            }

            // Spawn Worker Agents (concurrently with limit)
            const workerResults = await this.spawnWorkers(issues, github, repoName, runId);

            const successCount = workerResults.filter((r) => r.success).length;
            const failCount = workerResults.filter((r) => !r.success).length;

            log.info(`Workers completed for ${repoName}: ${successCount} success, ${failCount} failed`);

            // Spawn Reviewer Agent
            if (successCount > 0) {
                log.info(`Starting Reviewer Agent for ${repoName}...`);
                const reviewer = new ReviewerAgent(github, this.ai, this.emailService);
                const reviewedPRs = await reviewer.reviewAndCreatePRs(workerResults);

                log.info(`Run complete for ${repoName}! ${reviewedPRs.length} PR(s) created.`);
                this.logSummary(repoName, workerResults, reviewedPRs);
            } else {
                log.warn(`No successful fixes in ${repoName} — no PRs will be created`);

                for (const result of workerResults) {
                    if (!result.success) {
                        await github.removeLabel(result.issueNumber, 'in-progress');
                    }
                }
            }

            // Track run completion
            if (this.callbacks?.onRunComplete && runId) {
                await this.callbacks.onRunComplete(runId, 'completed');
            }
        } catch (error: any) {
            log.error(`Failed processing repo ${repoName}`, { error: error.message });
            if (this.callbacks?.onRunComplete && runId) {
                await this.callbacks.onRunComplete(runId, 'failed', error.message);
            }
        } finally {
            this.processingRepos.delete(repoName);
        }
    }

    private async spawnWorkers(
        issues: GitHubIssue[],
        github: GitHubClient,
        repoName: string,
        runId?: number
    ): Promise<WorkerResult[]> {
        const maxConcurrent = config.agent.maxConcurrentAgents;
        const results: WorkerResult[] = [];

        for (let i = 0; i < issues.length; i += maxConcurrent) {
            const batch = issues.slice(i, i + maxConcurrent);

            log.info(
                `Processing batch ${Math.floor(i / maxConcurrent) + 1}: ` +
                `issues ${batch.map((b) => `#${b.number}`).join(', ')}`
            );

            const batchPromises = batch.map(async (issue) => {
                // Track issue start
                let issueDbId: number | undefined;
                if (this.callbacks?.onIssueStart && runId) {
                    issueDbId = await this.callbacks.onIssueStart(
                        runId, issue.number, issue.title,
                        config.github.owner, repoName
                    );
                }

                const worker = new WorkerAgent(github, this.ai);
                const result = await worker.processIssue(issue);

                // Track issue completion
                if (this.callbacks?.onIssueProcessed && issueDbId) {
                    await this.callbacks.onIssueProcessed(issueDbId, result);
                }

                return result;
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

    private logSummary(repoName: string, workerResults: WorkerResult[], reviewedPRs: ReviewedPR[]): void {
        console.log('\n' + '='.repeat(60));
        console.log(`  SUPER AGENT RUN SUMMARY — ${config.github.owner}/${repoName}`);
        console.log('='.repeat(60));

        console.log('\nIssues Processed:');
        for (const result of workerResults) {
            const status = result.success ? 'OK' : 'FAIL';
            console.log(`  [${status}] #${result.issueNumber}: ${result.issueTitle}`);
            if (result.error) {
                console.log(`     Error: ${result.error}`);
            }
        }

        if (reviewedPRs.length > 0) {
            console.log('\nPull Requests Created:');
            for (const pr of reviewedPRs) {
                const reviewStatus = pr.reviewApproved ? 'Approved' : 'Needs Review';
                console.log(`  [${reviewStatus}] PR #${pr.prNumber}: ${pr.prUrl}`);
                console.log(`     For issue #${pr.issueNumber}: ${pr.issueTitle}`);
            }
        }

        console.log('\n' + '='.repeat(60) + '\n');
    }
}
