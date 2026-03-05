import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { apiFetch } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';

interface Run {
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
}

export default function RunsPage() {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [rerunningId, setRerunningId] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    const limit = 20;

    const query = `/api/runs?page=${page}&limit=${limit}${statusFilter ? `&status=${statusFilter}` : ''}`;
    const { data, loading, error, refetch } = useFetch<{ runs: Run[]; total: number }>(query, [page, statusFilter]);

    const handleRerun = async (run: Run) => {
        setRerunningId(run.id);
        setMessage('');
        try {
            await apiFetch('/api/runs/trigger', {
                method: 'POST',
                body: JSON.stringify({ repo: run.repo_name, rerun: true, runId: run.id }),
            });
            setMessage(`Re-triggered run for ${run.repo_owner}/${run.repo_name}`);
            setTimeout(() => refetch(), 1500);
        } catch (err: any) {
            setMessage(`Failed to rerun: ${err.message}`);
        } finally {
            setRerunningId(null);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Agent Runs</h2>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">All statuses</option>
                    <option value="running">Running</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                </select>
            </div>

            {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('Failed') ? 'bg-red-900/20 text-red-400 border border-red-800' : 'bg-green-900/20 text-green-400 border border-green-800'}`}>
                    {message}
                </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                {error ? (
                    <div className="p-8 text-center text-red-400">Failed to load runs: {error}</div>
                ) : loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : !data || data.runs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No runs found.</div>
                ) : (
                    <>
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 uppercase">
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3">Repository</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Issues</th>
                                    <th className="px-4 py-3">PRs</th>
                                    <th className="px-4 py-3">Started</th>
                                    <th className="px-4 py-3">Duration</th>
                                    <th className="px-4 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {data.runs.map((run) => (
                                    <tr key={run.id} className="hover:bg-gray-800/50 transition-colors">
                                        <td className="px-4 py-3 text-sm text-gray-400">#{run.id}</td>
                                        <td className="px-4 py-3">
                                            <Link to={`/runs/${run.id}`} className="text-blue-400 hover:text-blue-300">
                                                {run.repo_owner}/{run.repo_name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                                        <td className="px-4 py-3 text-sm text-gray-300">{run.issues_processed}/{run.issues_found}</td>
                                        <td className="px-4 py-3 text-sm text-gray-300">{run.prs_created}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(run.started_at).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {run.completed_at
                                                ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {run.status === 'failed' && (
                                                <button
                                                    onClick={() => handleRerun(run)}
                                                    disabled={rerunningId === run.id}
                                                    className="text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 border border-red-800 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                                                >
                                                    {rerunningId === run.id ? 'Triggering...' : 'Rerun'}
                                                </button>
                                            )}
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
