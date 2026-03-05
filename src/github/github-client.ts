import { Octokit } from '@octokit/rest';
import { config } from '../config';
import { UserRuntimeConfig } from '../services/user-config';
import { createLogger } from '../utils/logger';
import { withRetry } from '../utils/retry';

const log = createLogger('GitHubClient');

export interface GitHubIssue {
    number: number;
    title: string;
    body: string | null;
    labels: string[];
    url: string;
}

export interface FileChange {
    path: string;
    content: string;
    message: string;
}

export class GitHubClient {
    private octokit: Octokit;
    private owner: string;
    private repo: string;
    private cfg: UserRuntimeConfig | typeof config;

    constructor(owner?: string, repo?: string, userConfig?: UserRuntimeConfig) {
        this.cfg = userConfig || config;
        this.octokit = new Octokit({ auth: this.cfg.github.token });
        this.owner = owner || this.cfg.github.owner;
        this.repo = repo || this.cfg.github.repo;
    }

    getRepoName(): string {
        return this.repo;
    }

    getOwner(): string {
        return this.owner;
    }

    /**
     * Lists all non-archived repositories for the authenticated user.
     */
    async listOwnerRepos(): Promise<string[]> {
        return withRetry(async () => {
            log.info(`Fetching repos for owner "${this.owner}"`);

            const repos: string[] = [];
            let page = 1;

            while (true) {
                const { data } = await this.octokit.repos.listForAuthenticatedUser({
                    per_page: 100,
                    page,
                    sort: 'updated',
                    direction: 'desc',
                    affiliation: 'owner',
                });

                if (data.length === 0) break;

                for (const repo of data) {
                    if (!repo.archived) {
                        repos.push(repo.name);
                    }
                }

                if (data.length < 100) break;
                page++;
            }

            log.info(`Found ${repos.length} active repos for "${this.owner}"`);
            return repos;
        }, 'listOwnerRepos');
    }

    /**
     * Fetches open issues that have the configured label (e.g., "ai-agent")
     * and do NOT already have the "in-progress" or "ai-pr-created" label.
     * When skipLabelFilter is true (manual rerun), skips the in-progress/ai-pr-created filter.
     */
    async fetchOpenIssues(options?: { skipLabelFilter?: boolean }): Promise<GitHubIssue[]> {
        return withRetry(async () => {
            const skipFilter = options?.skipLabelFilter ?? false;
            log.info('Fetching open issues', { label: this.cfg.github.issueLabel, skipFilter });

            const { data: issues } = await this.octokit.issues.listForRepo({
                owner: this.owner,
                repo: this.repo,
                state: 'open',
                labels: this.cfg.github.issueLabel,
                per_page: 50,
            });

            // Filter out PRs (GitHub API returns PRs in issue listings)
            // and filter out issues already being processed or completed
            const filtered = issues.filter((issue) => {
                if (issue.pull_request) return false;

                if (skipFilter) return true;

                const labelNames = issue.labels.map((l) =>
                    typeof l === 'string' ? l : l.name || ''
                );
                return (
                    !labelNames.includes('in-progress') &&
                    !labelNames.includes('ai-pr-created')
                );
            });

            log.info(`Found ${filtered.length} actionable issues (of ${issues.length} total)`);

            return filtered.map((issue) => ({
                number: issue.number,
                title: issue.title,
                body: issue.body ?? null,
                labels: issue.labels.map((l) =>
                    typeof l === 'string' ? l : l.name || ''
                ),
                url: issue.html_url,
            }));
        }, 'fetchOpenIssues');
    }

    /**
     * Creates a new branch from the specified base branch.
     */
    async createBranch(branchName: string, baseBranch: string = this.cfg.github.devBranch): Promise<void> {
        return withRetry(async () => {
            log.info(`Creating branch "${branchName}" from "${baseBranch}"`);

            // Get the SHA of the base branch
            const { data: ref } = await this.octokit.git.getRef({
                owner: this.owner,
                repo: this.repo,
                ref: `heads/${baseBranch}`,
            });

            try {
                // Create the new branch
                await this.octokit.git.createRef({
                    owner: this.owner,
                    repo: this.repo,
                    ref: `refs/heads/${branchName}`,
                    sha: ref.object.sha,
                });
                log.info(`Branch "${branchName}" created successfully`);
            } catch (error: any) {
                // If branch already exists, update it to the latest base SHA
                if (error.status === 422 && error.message?.includes('Reference already exists')) {
                    log.info(`Branch "${branchName}" already exists, resetting to latest "${baseBranch}"`);
                    await this.octokit.git.updateRef({
                        owner: this.owner,
                        repo: this.repo,
                        ref: `heads/${branchName}`,
                        sha: ref.object.sha,
                        force: true,
                    });
                    log.info(`Branch "${branchName}" updated to latest "${baseBranch}"`);
                } else {
                    throw error;
                }
            }
        }, 'createBranch');
    }

    /**
     * Gets the content of a file from a specific branch.
     */
    async getFileContent(filePath: string, branch: string = this.cfg.github.devBranch): Promise<string> {
        return withRetry(async () => {
            const { data } = await this.octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: filePath,
                ref: branch,
            });

            if ('content' in data && data.content) {
                return Buffer.from(data.content, 'base64').toString('utf-8');
            }

            throw new Error(`File "${filePath}" is not a regular file or has no content`);
        }, `getFileContent(${filePath})`);
    }

    /**
     * Commits a file change to a specific branch.
     * Creates or updates the file.
     */
    async commitFile(change: FileChange, branch: string): Promise<void> {
        return withRetry(async () => {
            log.info(`Committing to "${branch}": ${change.path}`);

            // Try to get existing file SHA (needed for updates)
            let sha: string | undefined;
            try {
                const { data } = await this.octokit.repos.getContent({
                    owner: this.owner,
                    repo: this.repo,
                    path: change.path,
                    ref: branch,
                });
                if ('sha' in data) {
                    sha = data.sha;
                }
            } catch {
                // File doesn't exist yet — this is fine, we'll create it
            }

            await this.octokit.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: this.repo,
                path: change.path,
                message: change.message,
                content: Buffer.from(change.content).toString('base64'),
                branch,
                ...(sha ? { sha } : {}),
            });

            log.info(`Committed "${change.path}" to "${branch}"`);
        }, `commitFile(${change.path})`);
    }

    /**
     * Commits multiple file changes to a branch in a single commit using the Git tree API.
     */
    async commitMultipleFiles(
        changes: FileChange[],
        branch: string,
        commitMessage: string
    ): Promise<void> {
        return withRetry(async () => {
            log.info(`Committing ${changes.length} files to "${branch}"`);

            // Get the latest commit SHA on the branch
            const { data: refData } = await this.octokit.git.getRef({
                owner: this.owner,
                repo: this.repo,
                ref: `heads/${branch}`,
            });
            const latestCommitSha = refData.object.sha;

            // Get the tree SHA of the latest commit
            const { data: commitData } = await this.octokit.git.getCommit({
                owner: this.owner,
                repo: this.repo,
                commit_sha: latestCommitSha,
            });
            const baseTreeSha = commitData.tree.sha;

            // Create blobs for each file
            const treeItems = await Promise.all(
                changes.map(async (change) => {
                    const { data: blob } = await this.octokit.git.createBlob({
                        owner: this.owner,
                        repo: this.repo,
                        content: Buffer.from(change.content).toString('base64'),
                        encoding: 'base64',
                    });

                    return {
                        path: change.path,
                        mode: '100644' as const,
                        type: 'blob' as const,
                        sha: blob.sha,
                    };
                })
            );

            // Create a new tree
            const { data: newTree } = await this.octokit.git.createTree({
                owner: this.owner,
                repo: this.repo,
                base_tree: baseTreeSha,
                tree: treeItems,
            });

            // Create a new commit
            const { data: newCommit } = await this.octokit.git.createCommit({
                owner: this.owner,
                repo: this.repo,
                message: commitMessage,
                tree: newTree.sha,
                parents: [latestCommitSha],
            });

            // Update the branch reference
            await this.octokit.git.updateRef({
                owner: this.owner,
                repo: this.repo,
                ref: `heads/${branch}`,
                sha: newCommit.sha,
            });

            log.info(`Committed ${changes.length} files to "${branch}" in a single commit`);
        }, 'commitMultipleFiles');
    }

    /**
     * Creates a pull request.
     */
    async createPullRequest(
        head: string,
        base: string,
        title: string,
        body: string
    ): Promise<{ number: number; url: string }> {
        return withRetry(async () => {
            log.info(`Creating PR: "${head}" -> "${base}"`);

            const { data: pr } = await this.octokit.pulls.create({
                owner: this.owner,
                repo: this.repo,
                head,
                base,
                title,
                body,
            });

            log.info(`PR #${pr.number} created: ${pr.html_url}`);
            return { number: pr.number, url: pr.html_url };
        }, 'createPullRequest');
    }

    /**
     * Adds a comment to an issue.
     */
    async addIssueComment(issueNumber: number, comment: string): Promise<void> {
        return withRetry(async () => {
            await this.octokit.issues.createComment({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                body: comment,
            });
            log.info(`Commented on issue #${issueNumber}`);
        }, 'addIssueComment');
    }

    /**
     * Adds a label to an issue.
     */
    async addLabel(issueNumber: number, label: string): Promise<void> {
        return withRetry(async () => {
            await this.octokit.issues.addLabels({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                labels: [label],
            });
            log.info(`Added label "${label}" to issue #${issueNumber}`);
        }, 'addLabel');
    }

    /**
     * Removes a label from an issue. Logs a warning on failure instead of throwing.
     */
    async removeLabel(issueNumber: number, label: string): Promise<void> {
        try {
            await this.octokit.issues.removeLabel({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                name: label,
            });
            log.info(`Removed label "${label}" from issue #${issueNumber}`);
        } catch (error: any) {
            // 404 means label wasn't present — that's fine
            if (error.status === 404) {
                log.info(`Label "${label}" was not present on issue #${issueNumber}`);
            } else {
                log.warn(`Failed to remove label "${label}" from issue #${issueNumber}`, { error: error.message });
            }
        }
    }

    /**
     * Gets the repository file tree (for providing context to AI).
     */
    async getRepoTree(branch: string = this.cfg.github.devBranch): Promise<string[]> {
        return withRetry(async () => {
            const { data } = await this.octokit.git.getTree({
                owner: this.owner,
                repo: this.repo,
                tree_sha: branch,
                recursive: 'true',
            });

            if (data.truncated) {
                log.warn('Repository tree was truncated (very large repo) — some files may be missing from AI context');
            }

            return data.tree
                .filter((item) => item.type === 'blob' && item.path)
                .map((item) => item.path!);
        }, 'getRepoTree');
    }

    /**
     * Gets the diff between two branches for review.
     */
    async compareBranches(
        base: string,
        head: string
    ): Promise<{ filename: string; patch: string; status: string }[]> {
        return withRetry(async () => {
            const { data } = await this.octokit.repos.compareCommits({
                owner: this.owner,
                repo: this.repo,
                base,
                head,
            });

            return (data.files || []).map((file) => ({
                filename: file.filename,
                patch: file.patch || '',
                status: file.status || 'unknown',
            }));
        }, 'compareBranches');
    }
}
