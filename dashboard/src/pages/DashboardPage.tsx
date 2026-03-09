import { useFetch } from '../hooks/useFetch';
import StatsCard from '../components/StatsCard';
import StatusBadge from '../components/StatusBadge';
import { Link } from 'react-router-dom';

interface Stats {
    totalIssues: number;
    successCount: number;
    failedCount: number;
    prsCreated: number;
}

interface RecentIssue {
    id: number;
    repo_owner: string;
    repo_name: string;
    issue_number: number;
    issue_title: string;
    issue_url: string | null;
    status: string;
    pr_number: number | null;
    pr_url: string | null;
    created_at: string;
}

export default function DashboardPage() {
    const { data: stats, loading: statsLoading, error: statsError } = useFetch<Stats>('/api/dashboard/stats');
    const { data: recentIssues, loading: issuesLoading, error: issuesError } = useFetch<RecentIssue[]>('/api/dashboard/recent');

    const successRate = stats && stats.totalIssues > 0
        ? Math.round((stats.successCount / stats.totalIssues) * 100)
        : 0;

    return (
        <div>
            <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>

            {(statsError || issuesError) && (
                <div className="mb-4 p-3 rounded-lg text-sm bg-red-900/20 text-red-400 border border-red-800">
                    Failed to load dashboard data: {statsError || issuesError}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatsCard
                    icon="🐛"
                    label="Total Issues"
                    value={statsLoading ? '...' : stats?.totalIssues ?? 0}
                />
                <StatsCard
                    icon="✅"
                    label="Fixed"
                    value={statsLoading ? '...' : stats?.successCount ?? 0}
                />
                <StatsCard
                    icon="📦"
                    label="PRs Created"
                    value={statsLoading ? '...' : stats?.prsCreated ?? 0}
                />
                <StatsCard
                    icon="📈"
                    label="Success Rate"
                    value={statsLoading ? '...' : `${successRate}%`}
                />
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                    <Link to="/issues" className="text-sm text-blue-400 hover:text-blue-300">View all</Link>
                </div>

                {issuesLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : !recentIssues || recentIssues.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No issues processed yet. Add the <code className="text-gray-400">ai-agent</code> label to a GitHub issue to get started.
                    </div>
                ) : (
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
                            {recentIssues.map((issue) => (
                                <tr key={issue.id} className="hover:bg-gray-800/50 transition-colors">
                                    <td className="px-4 py-3">
                                        {issue.issue_url ? (
                                            <a href={issue.issue_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                                                #{issue.issue_number}
                                            </a>
                                        ) : (
                                            <span className="text-gray-300">#{issue.issue_number}</span>
                                        )}
                                        <span className="text-gray-500 ml-2 text-sm">{issue.issue_title}</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-400">
                                        {issue.repo_owner}/{issue.repo_name}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={issue.status} />
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {issue.pr_url ? (
                                            <a href={issue.pr_url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">
                                                #{issue.pr_number}
                                            </a>
                                        ) : (
                                            <span className="text-gray-600">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {new Date(issue.created_at).toLocaleString()}
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
