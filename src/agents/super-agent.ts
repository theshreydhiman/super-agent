import { GitHubClient, GitHubIssue } from '../github/github-client';
import { AIEngine } from '../ai/ai-engine';
import { EmailService } from '../services/email-service';
import { WorkerAgent, WorkerResult } from './worker-agent';
import { ReviewerAgent, ReviewedPR } from './reviewer-agent';
import { AgentCallbacks } from '../services/run-tracker';
import { UserRuntimeConfig } from '../services/user-config';
import { createLogger } from '../utils/logger';
import { config } from '../config';

const log = createLogger('SuperAgent');

export class SuperAgent {
    private discoveryClient: GitHubClient;
    private ai: AIEngine;
    private emailService: EmailService;
    private processingRepos = new Set<string>();
    private callbacks?: AgentCallbacks;
    private cfg: UserRuntimeConfig | typeof config;

    constructor(callbacks?: AgentCallbacks, userConfig?: UserRuntimeConfig) {
        this.cfg = userConfig || config;
        this.discoveryClient = new GitHubClient(undefined, undefined, userConfig);
        this.ai = new AIEngine(userConfig);
        this.emailService = new EmailService(userConfig);
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
        if (this.cfg.github.repo) {
            return [this.cfg.github.repo];
        }
        return this.discoveryClient.listOwnerRepos();
    }

    async processRepo(repoName: string, options?: { skipLabelFilter?: boolean; issueNumber?: number; issueNumbers?: number[] }): Promise<void> {
        if (this.processingRepos.has(repoName)) {
            log.warn(`Already processing ${repoName}, skipping`);
            return;
        }

        this.processingRepos.add(repoName);
        const github = new GitHubClient(this.cfg.github.owner, repoName, this.cfg !== config ? this.cfg as UserRuntimeConfig : undefined);
        let runId: number | undefined;

        try {
            log.info(`--- Processing repo: ${this.cfg.github.owner}/${repoName} ---`);

            let issues = await github.fetchOpenIssues({ skipLabelFilter: options?.skipLabelFilter });

            // If specific issue(s) were requested, filter to only those
            if (options?.issueNumbers && options.issueNumbers.length > 0) {
                const targetSet = new Set(options.issueNumbers);
                issues = issues.filter(i => targetSet.has(i.number));
                if (issues.length === 0) {
                    log.warn(`None of the target issues [${options.issueNumbers.join(', ')}] found or actionable in ${repoName}`);
                    return;
                }
                log.info(`Targeting ${issues.length} issue(s): ${issues.map(i => `#${i.number}`).join(', ')}`);
            } else if (options?.issueNumber) {
                issues = issues.filter(i => i.number === options.issueNumber);
                if (issues.length === 0) {
                    log.warn(`Issue #${options.issueNumber} not found or not actionable in ${repoName}`);
                    return;
                }
                log.info(`Targeting single issue #${options.issueNumber}`);
            }

            if (issues.length === 0) {
                log.info(`No actionable issues in ${repoName}. Skipping.`);
                return;
            }

            log.info(`Found ${issues.length} issue(s) in ${repoName}`);

            // Track run start
            if (this.callbacks?.onRunStart) {
                runId = await this.callbacks.onRunStart(this.cfg.github.owner, repoName, issues.length);
            }

            // Label all issues as "in-progress"
            for (const issue of issues) {
                try {
                    await github.addLabel(issue.number, 'in-progress');
                    log.info(`Labeled issue #${issue.number} as "in-progress"`);
                } catch (labelErr: any) {
                    log.warn(`Failed to label issue #${issue.number}`, { error: labelErr.message });
                }
            }

            // Spawn Worker Agents (concurrently with limit)
            const { results: workerResults, issueDbIdMap } = await this.spawnWorkers(issues, github, repoName, runId);

            const successCount = workerResults.filter((r) => r.success).length;
            const failCount = workerResults.filter((r) => !r.success).length;

            log.info(`Workers completed for ${repoName}: ${successCount} success, ${failCount} failed`);

            // Spawn Reviewer Agent
            if (successCount > 0) {
                log.info(`Starting Reviewer Agent for ${repoName}...`);
                const reviewer = new ReviewerAgent(github, this.ai, this.emailService, this.cfg !== config ? this.cfg as UserRuntimeConfig : undefined);
                const reviewedPRs = await reviewer.reviewAndCreatePRs(workerResults);

                // Persist PR data via onPRCreated callback
                if (this.callbacks?.onPRCreated) {
                    for (const pr of reviewedPRs) {
                        const issueDbId = issueDbIdMap.get(pr.issueNumber);
                        if (issueDbId) {
                            try {
                                await this.callbacks.onPRCreated(issueDbId, pr);
                            } catch (cbErr: any) {
                                log.error(`Failed to persist PR data for issue #${pr.issueNumber}`, { error: cbErr.message });
                            }
                        }
                    }
                }

                log.info(`Run complete for ${repoName}! ${reviewedPRs.length} PR(s) created.`);
                this.logSummary(repoName, workerResults, reviewedPRs);
            } else {
                log.warn(`No successful fixes in ${repoName} — no PRs will be created`);
            }

            // Clean up "in-progress" label from all failed issues regardless of whether other issues succeeded
            for (const result of workerResults) {
                if (!result.success) {
                    try {
                        await github.removeLabel(result.issueNumber, 'in-progress');
                    } catch {
                        // Best effort label removal
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
                try {
                    await this.callbacks.onRunComplete(runId, 'failed', error.message);
                } catch (cbErr: any) {
                    log.error(`Failed to update run status to failed`, { error: cbErr.message });
                }
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
    ): Promise<{ results: WorkerResult[]; issueDbIdMap: Map<number, number> }> {
        const maxConcurrent = this.cfg.agent.maxConcurrentAgents;
        const results: WorkerResult[] = [];
        const issueDbIdMap = new Map<number, number>();

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
                    try {
                        issueDbId = await this.callbacks.onIssueStart(
                            runId, issue.number, issue.title,
                            this.cfg.github.owner, repoName
                        );
                    } catch (cbErr: any) {
                        log.error(`Failed to track issue start for #${issue.number}`, { error: cbErr.message });
                    }
                }

                if (issueDbId) {
                    issueDbIdMap.set(issue.number, issueDbId);
                }

                const worker = new WorkerAgent(github, this.ai, this.cfg !== config ? this.cfg as UserRuntimeConfig : undefined);
                const result = await worker.processIssue(issue);

                // Track issue completion
                if (this.callbacks?.onIssueProcessed && issueDbId) {
                    try {
                        await this.callbacks.onIssueProcessed(issueDbId, result);
                    } catch (cbErr: any) {
                        log.error(`Failed to track issue completion for #${issue.number}`, { error: cbErr.message });
                    }
                }

                return result;
            });

            const batchResults = await Promise.allSettled(batchPromises);

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    log.error('Worker promise rejected unexpectedly', { error: result.reason?.message || result.reason });
                }
            }
        }

        return { results, issueDbIdMap };
    }

    private logSummary(repoName: string, workerResults: WorkerResult[], reviewedPRs: ReviewedPR[]): void {
        log.info('='.repeat(60));
        log.info(`  SUPER AGENT RUN SUMMARY — ${this.cfg.github.owner}/${repoName}`);
        log.info('='.repeat(60));

        for (const result of workerResults) {
            const status = result.success ? 'OK' : 'FAIL';
            log.info(`  [${status}] #${result.issueNumber}: ${result.issueTitle}${result.error ? ` — ${result.error}` : ''}`);
        }

        for (const pr of reviewedPRs) {
            const reviewStatus = pr.reviewApproved ? 'Approved' : 'Needs Review';
            log.info(`  [${reviewStatus}] PR #${pr.prNumber}: ${pr.prUrl} (issue #${pr.issueNumber})`);
        }
    }
}
