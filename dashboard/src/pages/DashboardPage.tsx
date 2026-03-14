import { useFetch } from '../hooks/useFetch';
import { useSocketRefetch } from '../hooks/useSocket';
import { PageHeader, IconButton } from '../components/Layout';
import StatsCard from '../components/StatsCard';
import StatusBadge from '../components/StatusBadge';
import { Link } from 'react-router-dom';
import { ClipboardList, CheckCircle, GitPullRequest, TrendingUp, Bell, Plus, ArrowRight } from 'lucide-react';

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

// Activity log symbols
const statusSymbol: Record<string, { icon: string; color: string }> = {
    success: { icon: '\u2713', color: 'text-green-400' },
    completed: { icon: '\u2713', color: 'text-green-400' },
    pr_created: { icon: '\u25C6', color: 'text-purple-400' },
    working: { icon: '\u25B8', color: 'text-amber-400' },
    running: { icon: '\u25B8', color: 'text-amber-400' },
    processing: { icon: '\u25B8', color: 'text-cyan-400' },
    failed: { icon: '\u2715', color: 'text-red-400' },
    pending: { icon: '+', color: 'text-text-muted' },
};

function formatTimeShort(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusText(issue: RecentIssue) {
    if (issue.status === 'pr_created') return `PR #${issue.pr_number} opened`;
    if (issue.status === 'success' || issue.status === 'completed') return `#${issue.issue_number} resolved`;
    if (issue.status === 'working' || issue.status === 'running') return `working on #${issue.issue_number}`;
    if (issue.status === 'failed') return `#${issue.issue_number} fix failed`;
    if (issue.status === 'pending') return `#${issue.issue_number} queued`;
    return `#${issue.issue_number} ${issue.status}`;
}

export default function DashboardPage() {
    const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useFetch<Stats>('/api/dashboard/stats');
    const { data: recentIssues, loading: issuesLoading, error: issuesError, refetch: refetchRecent } = useFetch<RecentIssue[]>('/api/dashboard/recent');

    // Real-time updates via Socket.IO
    useSocketRefetch('stats:update', refetchStats);
    useSocketRefetch('issue:update', refetchRecent);

    const successRate = stats && stats.totalIssues > 0
        ? Math.round((stats.successCount / stats.totalIssues) * 100)
        : 0;

    return (
        <div className="flex flex-col min-h-screen">
            <PageHeader
                title="Dashboard"
                subtitle="System overview"
                actions={
                    <>
                        <IconButton badge>
                            <Bell size={16} />
                        </IconButton>
                        <Link
                            to="/issues"
                            className="px-4 py-2.5 rounded-[10px] text-[13px] font-semibold bg-accent hover:bg-accent-hover text-white transition-all hover:glow-accent flex items-center gap-2"
                        >
                            <Plus size={15} />
                            <span className="hidden sm:inline">New Issue</span>
                        </Link>
                    </>
                }
            />

            <div className="flex-1 dot-grid p-4 sm:p-7">
                {(statsError || issuesError) && (
                    <div className="mb-5 p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
                        Failed to load dashboard data: {statsError || issuesError}
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    <StatsCard
                        icon={ClipboardList}
                        label="Total Issues"
                        value={statsLoading ? '...' : stats?.totalIssues ?? 0}
                        color="blue"
                    />
                    <StatsCard
                        icon={CheckCircle}
                        label="Fixed"
                        value={statsLoading ? '...' : stats?.successCount ?? 0}
                        color="green"
                    />
                    <StatsCard
                        icon={GitPullRequest}
                        label="PRs Created"
                        value={statsLoading ? '...' : stats?.prsCreated ?? 0}
                        color="purple"
                    />
                    <StatsCard
                        icon={TrendingUp}
                        label="Success Rate"
                        value={statsLoading ? '...' : `${successRate}%`}
                        color="cyan"
                    />
                </div>

                {/* Two Column: Table + Sidebar */}
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
                    {/* Recent Issues */}
                    <div className="bg-surface border border-border rounded-xl overflow-hidden">
                        <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between">
                            <span className="text-[15px] font-semibold text-zinc-100">Recent Issues</span>
                            <Link to="/issues" className="text-[13px] text-accent-text hover:text-accent-light font-medium flex items-center gap-1 transition-colors">
                                View all <ArrowRight size={14} />
                            </Link>
                        </div>

                        {issuesLoading ? (
                            <div className="p-8 text-center text-text-muted font-mono text-sm">Loading...</div>
                        ) : !recentIssues || recentIssues.length === 0 ? (
                            <div className="p-8 text-center text-text-muted text-sm">
                                No issues processed yet. Add the <code className="text-cyan-text bg-cyan-muted px-1.5 py-0.5 rounded font-mono text-xs">ai-agent</code> label to a GitHub issue to get started.
                            </div>
                        ) : (
                            <>
                                {/* Desktop table */}
                                <div className="hidden lg:block overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr>
                                                <th className="text-left px-6 py-3 text-[11px] uppercase tracking-[0.8px] text-text-dim font-semibold bg-white/[0.02]">Issue</th>
                                                <th className="text-left px-6 py-3 text-[11px] uppercase tracking-[0.8px] text-text-dim font-semibold bg-white/[0.02]">Repository</th>
                                                <th className="text-left px-6 py-3 text-[11px] uppercase tracking-[0.8px] text-text-dim font-semibold bg-white/[0.02]">Status</th>
                                                <th className="text-left px-6 py-3 text-[11px] uppercase tracking-[0.8px] text-text-dim font-semibold bg-white/[0.02]">PR</th>
                                                <th className="text-left px-6 py-3 text-[11px] uppercase tracking-[0.8px] text-text-dim font-semibold bg-white/[0.02]">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentIssues.map((issue) => (
                                                <tr key={issue.id} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-3.5 text-[13px]">
                                                        {issue.issue_url ? (
                                                            <a href={issue.issue_url} target="_blank" rel="noopener noreferrer" className="text-text-primary hover:text-accent-text transition-colors font-medium">
                                                                <span className="text-text-dim font-mono text-xs mr-2">#{issue.issue_number}</span>
                                                                {issue.issue_title}
                                                            </a>
                                                        ) : (
                                                            <span>
                                                                <span className="text-text-dim font-mono text-xs mr-2">#{issue.issue_number}</span>
                                                                {issue.issue_title}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3.5">
                                                        <span className="text-xs text-text-muted font-mono">{issue.repo_owner}/{issue.repo_name}</span>
                                                    </td>
                                                    <td className="px-6 py-3.5">
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
                                                        {formatDate(issue.created_at)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile card list */}
                                <div className="lg:hidden divide-y divide-white/[0.04]">
                                    {recentIssues.map((issue) => (
                                        <div key={issue.id} className="px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                <div className="min-w-0 flex-1">
                                                    {issue.issue_url ? (
                                                        <a href={issue.issue_url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-text-primary hover:text-accent-text transition-colors font-medium block truncate">
                                                            <span className="text-text-dim font-mono text-xs mr-1.5">#{issue.issue_number}</span>
                                                            {issue.issue_title}
                                                        </a>
                                                    ) : (
                                                        <span className="text-[13px] text-text-primary block truncate">
                                                            <span className="text-text-dim font-mono text-xs mr-1.5">#{issue.issue_number}</span>
                                                            {issue.issue_title}
                                                        </span>
                                                    )}
                                                </div>
                                                <StatusBadge status={issue.status} />
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-text-dim font-mono">
                                                <span>{issue.repo_owner}/{issue.repo_name}</span>
                                                <span>&middot;</span>
                                                <span>{formatDate(issue.created_at)}</span>
                                                {issue.pr_url && (
                                                    <>
                                                        <span>&middot;</span>
                                                        <a href={issue.pr_url} target="_blank" rel="noopener noreferrer" className="text-accent-text hover:text-accent-light transition-colors">
                                                            PR #{issue.pr_number}
                                                        </a>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right Sidebar */}
                    <div className="flex flex-col gap-5">
                        {/* System Log */}
                        <div className="bg-surface border border-border rounded-xl overflow-hidden">
                            <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between">
                                <span className="text-[15px] font-semibold text-zinc-100">System Log</span>
                                <span className="text-[11px] text-text-dim font-mono">Live</span>
                            </div>
                            <div className="py-1">
                                {issuesLoading ? (
                                    <div className="p-6 text-center text-text-muted font-mono text-sm">Loading...</div>
                                ) : !recentIssues || recentIssues.length === 0 ? (
                                    <div className="p-6 text-center text-text-muted text-sm">No activity yet</div>
                                ) : (
                                    recentIssues.slice(0, 6).map((issue) => {
                                        const sym = statusSymbol[issue.status] || statusSymbol.pending;
                                        return (
                                            <div key={issue.id} className="flex items-start gap-3 px-4 sm:px-6 py-2.5 hover:bg-white/[0.02] transition-colors">
                                                <span className="text-[11px] text-text-dim font-mono min-w-[42px] pt-0.5">
                                                    {formatTimeShort(issue.created_at)}
                                                </span>
                                                <span className={`font-mono text-sm font-bold w-4 text-center ${sym.color}`}>
                                                    {sym.icon}
                                                </span>
                                                <span className="text-[13px] text-zinc-300 flex-1">
                                                    {getStatusText(issue)}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            {recentIssues && recentIssues.length > 0 && (
                                <div className="px-4 sm:px-6 py-3 border-t border-border">
                                    <span className="text-[11px] text-text-dim font-mono">{recentIssues.length} events</span>
                                </div>
                            )}
                        </div>

                        {/* Metrics */}
                        <div className="bg-surface border border-border rounded-xl overflow-hidden">
                            <div className="px-4 sm:px-6 py-4 border-b border-border">
                                <span className="text-[15px] font-semibold text-zinc-100">Metrics</span>
                            </div>
                            <div className="p-4 sm:p-6 space-y-5">
                                <MetricBar
                                    label="resolve"
                                    value={`${successRate}%`}
                                    percent={successRate}
                                    color="from-accent to-accent-text"
                                />
                                <MetricBar
                                    label="pr_merge"
                                    value={stats && stats.prsCreated > 0 ? `${Math.round((stats.prsCreated / Math.max(stats.successCount, 1)) * 100)}%` : '0%'}
                                    percent={stats && stats.prsCreated > 0 ? Math.round((stats.prsCreated / Math.max(stats.successCount, 1)) * 100) : 0}
                                    color="from-green-500 to-green-400"
                                />
                                <MetricBar
                                    label="uptime"
                                    value="99.2%"
                                    percent={99}
                                    color="from-cyan to-cyan-text"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricBar({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] text-text-muted font-mono">{label}</span>
                <span className="text-[14px] text-text-primary font-semibold font-mono">{value}</span>
            </div>
            <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full bg-gradient-to-r ${color}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                />
            </div>
        </div>
    );
}
