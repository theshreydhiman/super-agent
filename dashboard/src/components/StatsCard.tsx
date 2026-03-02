interface StatsCardProps {
    label: string;
    value: number | string;
    icon: string;
    subtitle?: string;
}

export default function StatsCard({ label, value, icon, subtitle }: StatsCardProps) {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{icon}</span>
                <span className="text-sm text-gray-400">{label}</span>
            </div>
            <p className="text-3xl font-bold text-white">{value}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
    );
}
