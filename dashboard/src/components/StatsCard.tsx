import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
    label: string;
    value: number | string;
    icon: LucideIcon;
    trend?: { value: string; up: boolean };
    color?: 'blue' | 'green' | 'purple' | 'amber' | 'cyan';
}

const colorMap = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    purple: 'bg-purple-500/10 text-purple-400',
    amber: 'bg-amber-500/10 text-amber-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
};

export default function StatsCard({ label, value, icon: Icon, trend, color = 'blue' }: StatsCardProps) {
    return (
        <div className="bg-surface border border-border rounded-xl p-5 hover:border-border-hover transition-all duration-200 group">
            <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
                    <Icon size={18} />
                </div>
                {trend && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${
                        trend.up
                            ? 'text-green-400 bg-green-500/10'
                            : 'text-red-400 bg-red-500/10'
                    }`}>
                        {trend.up ? '\u2191' : '\u2193'} {trend.value}
                    </span>
                )}
            </div>
            <div className="text-[32px] font-bold text-zinc-100 tracking-tight leading-none mb-1.5 font-mono group-hover:text-cyan-text transition-colors duration-200">
                {value}
            </div>
            <div className="text-[13px] text-text-muted font-medium">{label}</div>
        </div>
    );
}
