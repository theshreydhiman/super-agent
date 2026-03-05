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
                log.info(`Run ${runId} started for ${repoOwner}/${repoName} (${issuesFound} issues)`);
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
                log.info(`Tracking issue #${issueNumber} (DB id: ${issueId}) in run ${runId}`);
                return issueId;
            },

            onIssueProcessed: async (issueDbId: number, result: WorkerResult): Promise<void> => {
                // Update issue status and branch
                await this.runRepo.updateProcessedIssue(issueDbId, {
                    status: result.success ? 'success' : 'failed',
                    branch_name: result.branchName || null,
                    error_message: result.error || null,
                });

                // Atomically increment issues_processed — uses SQL increment, safe for concurrency
                const issue = await this.runRepo.findProcessedIssueById(issueDbId);
                if (issue) {
                    await this.runRepo.incrementIssuesProcessed(issue.run_id);
                } else {
                    log.warn(`Processed issue DB record ${issueDbId} not found during increment`);
                }
            },

            onPRCreated: async (issueDbId: number, pr: ReviewedPR): Promise<void> => {
                await this.runRepo.updateProcessedIssue(issueDbId, {
                    status: 'success',
                    pr_number: pr.prNumber,
                    pr_url: pr.prUrl,
                    review_approved: pr.reviewApproved,
                });
                log.info(`PR #${pr.prNumber} recorded for issue DB id ${issueDbId}`);
            },

            onRunComplete: async (runId: number, status: 'completed' | 'failed', error?: string): Promise<void> => {
                const issues = await this.runRepo.getIssuesByRunId(runId);
                const prsCreated = issues.filter(i => i.pr_number != null).length;

                await this.runRepo.updateRun(runId, {
                    status,
                    prs_created: prsCreated,
                    error_message: error || null,
                });
                log.info(`Run ${runId} ${status} — ${prsCreated} PR(s) created, ${issues.length} issue(s) processed`);
            },
        };
    }
}
