import { useFetch } from '../hooks/useFetch';
import StatsCard from '../components/StatsCard';
import StatusBadge from '../components/StatusBadge';
import { Link } from 'react-router-dom';

interface Stats {
    totalRuns: number;
    issuesProcessed: number;
    prsCreated: number;
    successRate: number;
}

interface Run {
    id: number;
    repo_owner: string;
    repo_name: string;
    status: string;
    issues_found: number;
    issues_processed: number;
    prs_created: number;
    started_at: string;
    completed_at: string | null;
}

export default function DashboardPage() {
    const { data: stats, loading: statsLoading, error: statsError } = useFetch<Stats>('/api/dashboard/stats');
    const { data: recentRuns, loading: runsLoading, error: runsError } = useFetch<Run[]>('/api/dashboard/recent');

    return (
        <div>
            <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>

            {(statsError || runsError) && (
                <div className="mb-4 p-3 rounded-lg text-sm bg-red-900/20 text-red-400 border border-red-800">
                    Failed to load dashboard data: {statsError || runsError}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatsCard
                    icon="🔄"
                    label="Total Runs"
                    value={statsLoading ? '...' : stats?.totalRuns ?? 0}
                />
                <StatsCard
                    icon="🐛"
                    label="Issues Processed"
                    value={statsLoading ? '...' : stats?.issuesProcessed ?? 0}
                />
                <StatsCard
                    icon="📦"
                    label="PRs Created"
                    value={statsLoading ? '...' : stats?.prsCreated ?? 0}
                />
                <StatsCard
                    icon="✅"
                    label="Success Rate"
                    value={statsLoading ? '...' : `${stats?.successRate ?? 0}%`}
                />
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="p-4 border-b border-gray-800">
                    <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                </div>

                {runsLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : !recentRuns || recentRuns.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No agent runs yet. Configure your settings and trigger a run to get started.
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 uppercase">
                                <th className="px-4 py-3">Repository</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Issues</th>
                                <th className="px-4 py-3">PRs</th>
                                <th className="px-4 py-3">Started</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {recentRuns.map((run) => (
                                <tr key={run.id} className="hover:bg-gray-800/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <Link to={`/runs/${run.id}`} className="text-blue-400 hover:text-blue-300">
                                            {run.repo_owner}/{run.repo_name}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={run.status} />
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-300">
                                        {run.issues_processed}/{run.issues_found}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-300">
                                        {run.prs_created}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {new Date(run.started_at).toLocaleString()}
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
