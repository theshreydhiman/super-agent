import { useParams, Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import StatusBadge from '../components/StatusBadge';

interface ProcessedIssue {
    id: number;
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

interface RunDetail {
    id: number;
    repo_owner: string;
    repo_name: string;
    status: string;
    issues_found: number;
    issues_processed: number;
    prs_created: number;
    error_message: string | null;
    started_at: string;
    completed_at: string | null;
    issues: ProcessedIssue[];
}

export default function RunDetailPage() {
    const { id } = useParams();
    const { data: run, loading, error } = useFetch<RunDetail>(`/api/runs/${id}`);

    if (loading) return <div className="text-gray-500">Loading...</div>;
    if (error) return <div className="text-red-400">Failed to load run: {error}</div>;
    if (!run) return <div className="text-gray-500">Run not found.</div>;

    return (
        <div>
            <Link to="/runs" className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">
                &larr; Back to Runs
            </Link>

            <div className="flex items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-white">
                    Run #{run.id}
                </h2>
                <StatusBadge status={run.status} />
            </div>

            {/* Run metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Repository</p>
                    <p className="text-sm text-white">{run.repo_owner}/{run.repo_name}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Started</p>
                    <p className="text-sm text-white">{new Date(run.started_at).toLocaleString()}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Issues</p>
                    <p className="text-sm text-white">{run.issues_processed} / {run.issues_found}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">PRs Created</p>
                    <p className="text-sm text-white">{run.prs_created}</p>
                </div>
            </div>

            {run.error_message && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
                    <p className="text-sm text-red-400">{run.error_message}</p>
                </div>
            )}

            {/* Processed Issues */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="p-4 border-b border-gray-800">
                    <h3 className="text-lg font-semibold text-white">Processed Issues</h3>
                </div>

                {run.issues.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No issues processed in this run.</div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 uppercase">
                                <th className="px-4 py-3">Issue</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Branch</th>
                                <th className="px-4 py-3">PR</th>
                                <th className="px-4 py-3">Review</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {run.issues.map((issue) => (
                                <tr key={issue.id} className="hover:bg-gray-800/50">
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
                                    <td className="px-4 py-3"><StatusBadge status={issue.status} /></td>
                                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                                        {issue.branch_name || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {issue.pr_url ? (
                                            <a href={issue.pr_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                                                #{issue.pr_number}
                                            </a>
                                        ) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {issue.review_approved === true && <span className="text-green-400">Approved</span>}
                                        {issue.review_approved === false && <span className="text-yellow-400">Needs Review</span>}
                                        {issue.review_approved === null && <span className="text-gray-500">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
