import { RunRepository } from '../repositories/run-repository';
import { WorkerResult } from '../agents/worker-agent';
import { ReviewedPR } from '../agents/reviewer-agent';
import { createLogger } from '../utils/logger';

const log = createLogger('RunTracker');

export interface AgentCallbacks {
    onRunStart?: (repoOwner: string, repoName: string, issuesFound: number) => Promise<number>;
    onIssueStart?: (runId: number, issueNumber: number, issueTitle: string, repoOwner: string, repoName: string) => Promise<number>;
    onIssueProcessed?: (issueId: number, result: WorkerResult) => Promise<void>;
    onPRCreated?: (issueId: number, pr: ReviewedPR) => Promise<void>;
    onRunComplete?: (runId: number, status: 'completed' | 'failed', error?: string) => Promise<void>;
}

export class RunTracker {
    private runRepo: RunRepository;
    private userId: number;

    constructor(userId: number) {
        this.runRepo = new RunRepository();
        this.userId = userId;
    }

    createCallbacks(): AgentCallbacks {
        return {
            onRunStart: async (repoOwner: string, repoName: string, issuesFound: number): Promise<number> => {
                const runId = await this.runRepo.createRun({
                    user_id: this.userId,
                    repo_owner: repoOwner,
                    repo_name: repoName,
                    issues_found: issuesFound,
                });
                log.info(`Run ${runId} started for ${repoOwner}/${repoName}`);
                return runId;
            },

            onIssueStart: async (runId: number, issueNumber: number, issueTitle: string, repoOwner: string, repoName: string): Promise<number> => {
                const issueId = await this.runRepo.createProcessedIssue({
                    run_id: runId,
                    user_id: this.userId,
                    repo_owner: repoOwner,
                    repo_name: repoName,
                    issue_number: issueNumber,
                    issue_title: issueTitle,
                    issue_url: `https://github.com/${repoOwner}/${repoName}/issues/${issueNumber}`,
                });
                return issueId;
            },

            onIssueProcessed: async (issueId: number, result: WorkerResult): Promise<void> => {
                await this.runRepo.updateProcessedIssue(issueId, {
                    status: result.success ? 'success' : 'failed',
                    branch_name: result.branchName,
                    error_message: result.error,
                });

                // Update run counts
                const issue = (await this.runRepo.getIssuesByRunId(0)).find(i => i.id === issueId);
                if (issue) {
                    const run = await this.runRepo.findById(issue.run_id);
                    if (run) {
                        await this.runRepo.updateRun(run.id, {
                            issues_processed: run.issues_processed + 1,
                        });
                    }
                }
            },

            onPRCreated: async (issueId: number, pr: ReviewedPR): Promise<void> => {
                await this.runRepo.updateProcessedIssue(issueId, {
                    pr_number: pr.prNumber,
                    pr_url: pr.prUrl,
                    review_approved: pr.reviewApproved,
                });
            },

            onRunComplete: async (runId: number, status: 'completed' | 'failed', error?: string): Promise<void> => {
                const issues = await this.runRepo.getIssuesByRunId(runId);
                const prsCreated = issues.filter(i => i.pr_number != null).length;

                await this.runRepo.updateRun(runId, {
                    status,
                    prs_created: prsCreated,
                    error_message: error,
                });
                log.info(`Run ${runId} ${status}`);
            },
        };
    }
}
