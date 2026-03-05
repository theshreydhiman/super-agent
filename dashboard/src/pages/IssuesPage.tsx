import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { apiFetch } from '../api/client';
import StatusBadge from '../components/StatusBadge';

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
            await apiFetch('/api/runs/trigger', {
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
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Issues</h2>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm"
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

            {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('Failed') ? 'bg-red-900/20 text-red-400 border border-red-800' : 'bg-green-900/20 text-green-400 border border-green-800'}`}>
                    {message}
                </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                {error ? (
                    <div className="p-8 text-center text-red-400">Failed to load issues: {error}</div>
                ) : loading ? (
                    <div className="p-8 text-center text-gray-500">Loading issues from GitHub...</div>
                ) : filteredIssues.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No issues found with the <code className="text-gray-400">ai-agent</code> label.</div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 uppercase">
                                <th className="px-4 py-3">Issue</th>
                                <th className="px-4 py-3">Repository</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">PR</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {filteredIssues.map((issue) => {
                                const key = `${issue.repo_name}-${issue.issue_number}`;
                                const isFixing = fixingIssues.has(key);
                                return (
                                    <tr key={key} className="hover:bg-gray-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div>
                                                <a href={issue.issue_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                                                    #{issue.issue_number}
                                                </a>
                                                <span className="text-gray-400 ml-2 text-sm">{issue.issue_title}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-400">
                                            {issue.repo_owner}/{issue.repo_name}
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge status={issue.status} /></td>
                                        <td className="px-4 py-3 text-sm">
                                            {issue.pr_url ? (
                                                <a href={issue.pr_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                                                    #{issue.pr_number}
                                                </a>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {new Date(issue.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            {issue.status === 'pending' && (
                                                <button
                                                    onClick={() => handleFix(issue)}
                                                    disabled={isFixing}
                                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {isFixing ? 'Fixing...' : 'Fix'}
                                                </button>
                                            )}
                                            {issue.status === 'failed' && (
                                                <button
                                                    onClick={() => handleFix(issue, true)}
                                                    disabled={isFixing}
                                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 border border-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {isFixing ? 'Retrying...' : 'Retry'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
