import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

export function useFetch<T>(url: string, deps: any[] = []) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await apiFetch<T>(url);
            setData(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [url, ...deps]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { data, loading, error, refetch };
}

export function useFetchBranches(repo: string) {
    const [branches, setBranches] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        if (!repo) {
            setBranches([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const [owner, name] = repo.split('/');
            const result = await apiFetch<string[]>(`/api/config/repos/${owner}/${name}/branches`);
            setBranches(result);
        } catch (err: any) {
            setError(err.message);
            setBranches([]);
        } finally {
            setLoading(false);
        }
    }, [repo]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { branches, loading, error, refetch };
}