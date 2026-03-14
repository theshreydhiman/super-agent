import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    page: number;
    total: number;
    limit: number;
    onPageChange: (page: number) => void;
}

export default function Pagination({ page, total, limit, onPageChange }: PaginationProps) {
    const totalPages = Math.ceil(total / limit);

    if (totalPages <= 1) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 px-4 sm:px-6 py-3 border-t border-border">
            <p className="text-[12px] text-text-muted font-mono">
                {(page - 1) * limit + 1}&ndash;{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm rounded-lg bg-white/[0.04] text-text-secondary border border-border hover:bg-white/[0.08] hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                >
                    <ChevronLeft size={14} />
                    Prev
                </button>
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm rounded-lg bg-white/[0.04] text-text-secondary border border-border hover:bg-white/[0.08] hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                >
                    Next
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
