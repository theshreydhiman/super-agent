interface StatusBadgeProps {
    status: string;
}

const statusConfig: Record<string, { label: string; style: string; pulse?: boolean }> = {
    running: { label: 'RUNNING', style: 'bg-amber-500/10 text-amber-400 border-amber-500/20', pulse: true },
    working: { label: 'WORKING', style: 'bg-amber-500/10 text-amber-400 border-amber-500/20', pulse: true },
    completed: { label: 'SUCCESS', style: 'bg-green-500/10 text-green-400 border-green-500/20' },
    success: { label: 'SUCCESS', style: 'bg-green-500/10 text-green-400 border-green-500/20' },
    failed: { label: 'FAILED', style: 'bg-red-500/10 text-red-400 border-red-500/20' },
    pending: { label: 'PENDING', style: 'bg-white/5 text-text-secondary border-white/10' },
    processing: { label: 'PROCESSING', style: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', pulse: true },
    pr_created: { label: 'PR CREATED', style: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
    const config = statusConfig[status] || { label: status.toUpperCase(), style: 'bg-white/5 text-text-secondary border-white/10' };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold font-mono border tracking-wide ${config.style}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${config.pulse ? 'animate-pulse-dot' : ''}`} />
            {config.label}
        </span>
    );
}
