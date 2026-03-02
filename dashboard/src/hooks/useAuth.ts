import { useState, useEffect, useCallback } from 'react';

export interface User {
    id: number;
    github_login: string;
    github_avatar_url: string | null;
    email: string | null;
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        try {
            // Use plain fetch here — apiFetch redirects on 401 which causes an infinite loop
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else {
                setUser(null);
            }
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const logout = async () => {
        await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
        setUser(null);
    };

    return { user, loading, logout, checkAuth };
}
