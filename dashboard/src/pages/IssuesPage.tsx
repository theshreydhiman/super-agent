import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';

interface ProcessedIssue {
    id: number;
    repo_owner: string;
    repo_name: string;
    issue_number: number;
    issue_title: string;
    issue_url: string | null;
    status: string;
    branch_name: string | null;
    pr_number: number | null;
    pr_url: string | null;
    review_approved: boolean | null;
    error_message: string | null;
    created_at: string;
}

export default function IssuesPage() {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const limit = 20;

    const query = `/api/issues?page=${page}&limit=${limit}${statusFilter ? `&status=${statusFilter}` : ''}`;
    const { data, loading } = useFetch<{ issues: ProcessedIssue[]; total: number }>(query, [page, statusFilter]);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Processed Issues</h2>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">All statuses</option>
                    <option value="processing">Processing</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                </select>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : !data || data.issues.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No issues found.</div>
                ) : (
                    <>
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 uppercase">
                                    <th className="px-4 py-3">Issue</th>
                                    <th className="px-4 py-3">Repository</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">PR</th>
                                    <th className="px-4 py-3">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {data.issues.map((issue) => (
                                    <tr key={issue.id} className="hover:bg-gray-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div>
                                                {issue.issue_url ? (
                                                    <a href={issue.issue_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                                                        #{issue.issue_number}
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-300">#{issue.issue_number}</span>
                                                )}
                                                <span className="text-gray-400 ml-2 text-sm">{issue.issue_title}</span>
                                            </div>
                                            {issue.error_message && (
                                                <p className="text-xs text-red-400 mt-1">{issue.error_message}</p>
                                            )}
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="px-4 pb-4">
                            <Pagination page={page} total={data.total} limit={limit} onPageChange={setPage} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
