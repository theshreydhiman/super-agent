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

export function useFetchBranches<T>(repo: string, deps: any[] = []) {
    const [branches, setBranches] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await apiFetch<T>(`/api/config/branches/${repo}`);
            setBranches(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [repo, ...deps]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { branches, loading, error, refetch };
}