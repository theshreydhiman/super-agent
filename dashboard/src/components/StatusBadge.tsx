interface StatusBadgeProps {
    status: string;
}

const statusStyles: Record<string, string> = {
    running: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    working: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    pr_created: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const statusLabels: Record<string, string> = {
    pr_created: 'PR Created',
    working: 'Working',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
    const style = statusStyles[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style}`}>
            {statusLabels[status] || status}
        </span>
    );
}
