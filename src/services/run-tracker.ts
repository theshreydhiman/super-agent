import { IssueRepository } from '../repositories/issue-repository';
import { WorkerResult } from '../agents/worker-agent';
import { ReviewedPR } from '../agents/reviewer-agent';
import { createLogger } from '../utils/logger';
import { emitIssueUpdate, emitStatsUpdate } from '../socket';

const log = createLogger('IssueTracker');

export interface AgentCallbacks {
    onIssueStart?: (issueNumber: number, issueTitle: string, repoOwner: string, repoName: string) => Promise<number>;
    onIssueProcessed?: (issueId: number, result: WorkerResult) => Promise<void>;
    onPRCreated?: (issueId: number, pr: ReviewedPR) => Promise<void>;
}

export class IssueTracker {
    private issueRepo: IssueRepository;
    private userId: number;
    private existingIssueMap?: Map<number, number>; // issueNumber → processed_issues.id

    constructor(userId: number, existingIssueMap?: Map<number, number>) {
        this.issueRepo = new IssueRepository();
        this.userId = userId;
        this.existingIssueMap = existingIssueMap;
    }

    private async broadcastStats(): Promise<void> {
        try {
            const stats = await this.issueRepo.getStats(this.userId);
            emitStatsUpdate(stats);
        } catch {
            // Non-critical — don't break the pipeline if stats emit fails
        }
    }

    createCallbacks(): AgentCallbacks {
        return {
            onIssueStart: async (issueNumber: number, issueTitle: string, repoOwner: string, repoName: string): Promise<number> => {
                const existingId = this.existingIssueMap?.get(issueNumber);
                if (existingId) {
                    await this.issueRepo.resetIssue(existingId);
                    log.info(`Reset issue #${issueNumber} (DB id: ${existingId}) for retry`);
                    emitIssueUpdate({ issueNumber, repo: `${repoOwner}/${repoName}`, status: 'processing', title: issueTitle });
                    await this.broadcastStats();
                    return existingId;
                }

                const issueId = await this.issueRepo.create({
                    user_id: this.userId,
                    repo_owner: repoOwner,
                    repo_name: repoName,
                    issue_number: issueNumber,
                    issue_title: issueTitle,
                    issue_url: `https://github.com/${repoOwner}/${repoName}/issues/${issueNumber}`,
                });
                log.info(`Tracking issue #${issueNumber} (DB id: ${issueId})`);
                emitIssueUpdate({ issueNumber, repo: `${repoOwner}/${repoName}`, status: 'processing', title: issueTitle });
                await this.broadcastStats();
                return issueId;
            },

            onIssueProcessed: async (issueDbId: number, result: WorkerResult): Promise<void> => {
                await this.issueRepo.update(issueDbId, {
                    status: result.success ? 'success' : 'failed',
                    branch_name: result.branchName || null,
                    error_message: result.error || null,
                });
                log.info(`Issue DB id ${issueDbId} ${result.success ? 'succeeded' : 'failed'}`);

                const issue = await this.issueRepo.findById(issueDbId);
                if (issue) {
                    emitIssueUpdate({
                        issueNumber: issue.issue_number,
                        repo: `${issue.repo_owner}/${issue.repo_name}`,
                        status: result.success ? 'success' : 'failed',
                        branchName: result.branchName || null,
                        error: result.error || null,
                    });
                }
                await this.broadcastStats();
            },

            onPRCreated: async (issueDbId: number, pr: ReviewedPR): Promise<void> => {
                await this.issueRepo.update(issueDbId, {
                    status: 'success',
                    pr_number: pr.prNumber,
                    pr_url: pr.prUrl,
                    review_approved: pr.reviewApproved,
                    review_score: pr.reviewScore,
                });
                log.info(`PR #${pr.prNumber} recorded for issue DB id ${issueDbId}`);

                const issue = await this.issueRepo.findById(issueDbId);
                if (issue) {
                    emitIssueUpdate({
                        issueNumber: issue.issue_number,
                        repo: `${issue.repo_owner}/${issue.repo_name}`,
                        status: 'success',
                        prNumber: pr.prNumber,
                        prUrl: pr.prUrl,
                    });
                }
                await this.broadcastStats();
            },
        };
    }
}
