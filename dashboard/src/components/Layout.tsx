import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Bug, Settings, LogOut, BookOpen, Info } from 'lucide-react';
import type { User } from '../hooks/useAuth';

interface LayoutProps {
    children: React.ReactNode;
    user: User;
    onLogout: () => void;
}

const navSections = [
    {
        label: 'Navigate',
        items: [
            { path: '/', label: '/dashboard', icon: LayoutDashboard },
            { path: '/issues', label: '/issues', icon: Bug },
        ],
    },
    {
        label: 'System',
        items: [
            { path: '/config', label: '/settings', icon: Settings },
            { path: '/guide', label: '/guide', icon: BookOpen },
            { path: '/about', label: '/about', icon: Info },
        ],
    },
];

export default function Layout({ children, user, onLogout }: LayoutProps) {
    const location = useLocation();

    return (
        <div className="min-h-screen bg-base text-text-primary flex">
            {/* Sidebar */}
            <aside className="w-[260px] bg-[#0e0e16] border-r border-border flex flex-col fixed top-0 left-0 h-screen z-10">
                {/* Brand */}
                <div className="px-6 py-7 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-white font-bold text-base">
                            S
                        </div>
                        <span className="text-lg font-bold text-zinc-100 tracking-tight">Super Agent</span>
                        <span className="ml-auto text-[10px] font-semibold text-accent-text bg-accent-muted px-2 py-0.5 rounded-full">
                            v1.0
                        </span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4">
                    {navSections.map((section) => (
                        <div key={section.label} className="mb-4">
                            <div className="text-[11px] uppercase tracking-[1.2px] text-text-dim font-semibold px-3 py-2">
                                {section.label}
                            </div>
                            {section.items.map((item) => {
                                const isActive = item.path === '/'
                                    ? location.pathname === '/'
                                    : location.pathname.startsWith(item.path);
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium font-mono transition-all duration-150 mb-0.5 ${
                                            isActive
                                                ? 'bg-accent-muted text-accent-light'
                                                : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
                                        }`}
                                    >
                                        <Icon size={18} className={isActive ? 'text-accent-text' : 'opacity-70'} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* User */}
                <div className="px-4 py-4 border-t border-border">
                    <div className="flex items-center gap-3 px-2 py-2 rounded-[10px] hover:bg-white/[0.04] transition-colors">
                        {user.github_avatar_url ? (
                            <img
                                src={user.github_avatar_url}
                                alt={user.github_login}
                                className="w-[34px] h-[34px] rounded-full"
                            />
                        ) : (
                            <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-br from-accent to-pink-500 flex items-center justify-center text-sm font-semibold text-white">
                                {user.github_login?.substring(0, 2).toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-text-primary truncate">
                                {user.github_login}
                            </div>
                            <div className="text-[11px] text-text-dim">Admin</div>
                        </div>
                        <button
                            onClick={onLogout}
                            className="text-text-dim hover:text-red-400 transition-colors"
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="ml-[260px] flex-1 min-h-screen flex flex-col">
                {children}
            </main>
        </div>
    );
}

/* Shared topbar component for pages */
export function PageHeader({ title, subtitle, actions }: {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
}) {
    return (
        <header className="glass scanline relative px-8 py-5 border-b border-border sticky top-0 z-5 flex items-center justify-between">
            <div>
                <h1 className="text-[22px] font-bold text-zinc-100 tracking-tight">{title}</h1>
                {subtitle && <p className="text-[13px] text-text-muted mt-1">{subtitle}</p>}
            </div>
            {actions && (
                <div className="flex items-center gap-3">
                    {actions}
                </div>
            )}
        </header>
    );
}

export function IconButton({ children, badge }: { children: React.ReactNode; badge?: boolean }) {
    return (
        <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center bg-white/[0.04] border border-border text-text-muted hover:bg-white/[0.08] hover:text-text-primary cursor-pointer transition-all relative">
            {children}
            {badge && (
                <span className="absolute top-2 right-2 w-[7px] h-[7px] bg-red-500 rounded-full border-2 border-base" />
            )}
        </div>
    );
}
