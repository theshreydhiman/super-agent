import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import IssuesPage from './pages/IssuesPage';
import ConfigPage from './pages/ConfigPage';

function App() {
    const { user, loading, logout } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-gray-500 text-lg">Loading...</div>
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
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/issues" element={<IssuesPage />} />
                    <Route path="/config" element={<ConfigPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}

export default App;
