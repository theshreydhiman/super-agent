import { Link, useLocation } from 'react-router-dom';
import type { User } from '../hooks/useAuth';

interface LayoutProps {
    children: React.ReactNode;
    user: User;
    onLogout: () => void;
}

const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/runs', label: 'Runs', icon: '🔄' },
    { path: '/issues', label: 'Issues', icon: '🐛' },
    { path: '/config', label: 'Settings', icon: '⚙️' },
];

export default function Layout({ children, user, onLogout }: LayoutProps) {
    const location = useLocation();

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="p-6 border-b border-gray-800">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        🤖 Super Agent
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">AI Issue Automation</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                    isActive
                                        ? 'bg-blue-600/20 text-blue-400'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                }`}
                            >
                                <span>{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <div className="flex items-center gap-3">
                        {user.github_avatar_url && (
                            <img
                                src={user.github_avatar_url}
                                alt={user.github_login}
                                className="w-8 h-8 rounded-full"
                            />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.github_login}</p>
                        </div>
                        <button
                            onClick={onLogout}
                            className="text-gray-500 hover:text-gray-300 text-xs"
                            title="Logout"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
