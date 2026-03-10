import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { apiFetch } from '../api/client';
import { PageHeader } from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import { Filter, Play, RotateCcw } from 'lucide-react';

interface GitHubIssue {
    issue_number: number;
    issue_title: string;
    issue_url: string;
    repo_owner: string;
    repo_name: string;
    labels: string[];
    status: string;
    branch_name: string | null;
    pr_number: number | null;
    pr_url: string | null;
    error_message: string | null;
    created_at: string;
}

export default function IssuesPage() {
    const [statusFilter, setStatusFilter] = useState('');
    const [fixingIssues, setFixingIssues] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState('');

    const { data, loading, error, refetch } = useFetch<{ issues: GitHubIssue[]; total: number }>('/api/issues');

    const filteredIssues = data?.issues.filter(
        (issue) => !statusFilter || issue.status === statusFilter
    ) ?? [];

    const handleFix = async (issue: GitHubIssue, rerun = false) => {
        const key = `${issue.repo_name}-${issue.issue_number}`;
        setFixingIssues((prev) => new Set(prev).add(key));
        try {
            await apiFetch('/api/issues/trigger', {
                method: 'POST',
                body: JSON.stringify({ repo: issue.repo_name, rerun, issueNumber: issue.issue_number }),
            });
            setMessage(`Triggered ${rerun ? 'retry' : 'fix'} for #${issue.issue_number}`);
            setTimeout(() => refetch(), 2000);
        } catch (err: any) {
            setMessage(`Failed to trigger fix: ${err.message}`);
        } finally {
            setFixingIssues((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            <PageHeader
                title="Issues"
                subtitle="GitHub issues labeled for AI processing"
                actions={
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-text-muted" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-white/[0.04] border border-border text-text-secondary rounded-lg px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none transition-colors appearance-none cursor-pointer"
                        >
                            <option value="">All statuses</option>
                            <option value="pending">Pending</option>
                            <option value="working">Working</option>
                            <option value="processing">Processing</option>
                            <option value="success">Success</option>
                            <option value="failed">Failed</option>
                            <option value="pr_created">PR Created</option>
                        </select>
                    </div>
                }
            />

            <div className="flex-1 dot-grid p-7">
                {message && (
                    <div className={`mb-5 p-3 rounded-lg text-sm font-mono border ${
                        message.includes('Failed')
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                    }`}>
                        {message}
                    </div>
                )}

                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    {error ? (
                        <div className="p-8 text-center text-red-400 font-mono text-sm">Failed to load issues: {error}</div>
                    ) : loading ? (
                        <div className="p-8 text-center text-text-muted font-mono text-sm">Loading issues from GitHub...</div>
                    ) : filteredIssues.length === 0 ? (
                        <div className="p-8 text-center text-text-muted text-sm">
                            No issues found with the <code className="text-cyan-text bg-cyan-muted px-1.5 py-0.5 rounded font-mono text-xs">ai-agent</code> label.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left px-6 py-3 text-[11px] uppercase tracking-[0.8px] text-text-dim font-semibold bg-white/[0.02]">Issue</th>
                                        <th className="text-left px-6 py-3 text-[11px] uppercase tracking-[0.8px] text-text-dim font-semibold bg-white/[0.02]">Repository</th>
                                        <th className="text-left px-6 py-3 text-[11px] uppercase tracking-[0.8px] text-text-dim font-semibold bg-white/[0.02]">Status</th>
                                        <th className="text-left px-6 py-3 text-[11px] uppercase tracking-[0.8px] text-text-dim font-semibold bg-white/[0.02]">PR</th>
                                        <th className="text-left px-6 py-3 text-[11px] uppercase tracking-[0.8px] text-text-dim font-semibold bg-white/[0.02]">Date</th>
                                        <th className="text-left px-6 py-3 text-[11px] uppercase tracking-[0.8px] text-text-dim font-semibold bg-white/[0.02]">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredIssues.map((issue) => {
                                        const key = `${issue.repo_name}-${issue.issue_number}`;
                                        const isFixing = fixingIssues.has(key);
                                        return (
                                            <tr key={key} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-3.5 text-[13px]">
                                                    <a href={issue.issue_url} target="_blank" rel="noopener noreferrer" className="text-text-primary hover:text-accent-text transition-colors font-medium">
                                                        <span className="text-text-dim font-mono text-xs mr-2">#{issue.issue_number}</span>
                                                        {issue.issue_title}
                                                    </a>
                                                </td>
                                                <td className="px-6 py-3.5">
                                                    <span className="text-xs text-text-muted font-mono">{issue.repo_owner}/{issue.repo_name}</span>
                                                </td>
                                                <td className="px-6 py-3.5" title={issue.status === 'failed' && issue.error_message ? issue.error_message : undefined}>
                                                    <StatusBadge status={issue.status} />
                                                </td>
                                                <td className="px-6 py-3.5 text-sm">
                                                    {issue.pr_url ? (
                                                        <a href={issue.pr_url} target="_blank" rel="noopener noreferrer" className="text-accent-text hover:text-accent-light font-mono text-xs transition-colors">
                                                            #{issue.pr_number}
                                                        </a>
                                                    ) : (
                                                        <span className="text-text-dim">&mdash;</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3.5 text-xs text-text-dim font-mono">
                                                    {new Date(issue.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </td>
                                                <td className="px-6 py-3.5">
                                                    {issue.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleFix(issue)}
                                                            disabled={isFixing}
                                                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent hover:bg-accent-hover text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:glow-accent flex items-center gap-1.5 font-mono"
                                                        >
                                                            <Play size={12} />
                                                            {isFixing ? 'FIXING...' : 'FIX'}
                                                        </button>
                                                    )}
                                                    {issue.status === 'failed' && (
                                                        <button
                                                            onClick={() => handleFix(issue, true)}
                                                            disabled={isFixing}
                                                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 font-mono"
                                                        >
                                                            <RotateCcw size={12} />
                                                            {isFixing ? 'RETRYING...' : 'RETRY'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
