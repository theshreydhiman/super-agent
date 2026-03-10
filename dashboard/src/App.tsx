import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import IssuesPage from './pages/IssuesPage';
import ConfigPage from './pages/ConfigPage';
import GuidePage from './pages/GuidePage';
import AboutPage from './pages/AboutPage';

function HomePage() {
    const [redirect, setRedirect] = useState<boolean | null>(null);

    useEffect(() => {
        fetch('/api/config', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : {}))
            .then((configs: Record<string, string>) => {
                const hasSetup = !!(configs.ai_provider || configs.github_repo);
                setRedirect(!hasSetup);
            })
            .catch(() => setRedirect(false));
    }, []);

    if (redirect === null) {
        return (
            <div className="flex-1 flex items-center justify-center text-text-muted font-mono text-sm">
                Loading...
            </div>
        );
    }

    if (redirect) {
        return <Navigate to="/guide" replace />;
    }

    return <DashboardPage />;
}

function App() {
    const { user, loading, logout } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-base dot-grid flex items-center justify-center">
                <div className="text-text-muted font-mono text-sm">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </BrowserRouter>
        );
    }

    return (
        <BrowserRouter>
            <Layout user={user} onLogout={logout}>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/issues" element={<IssuesPage />} />
                    <Route path="/config" element={<ConfigPage />} />
                    <Route path="/guide" element={<GuidePage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}

export default App;
