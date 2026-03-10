
import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import { PageHeader } from '../components/Layout';
import { Save, Zap, Github, Cpu, Settings2, CheckCircle, XCircle } from 'lucide-react';
import { useFetchBranches } from '../hooks/useFetch';
import { getUserRuntimeConfig } from '../services/user-config';

const ConfigPage = () => {
    const [repo, setRepo] = useState('');
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [loadingBranches, setLoadingBranches] = useState(false);
    const [errorBranches, setErrorBranches] = useState(null);
    const [loadingRepo, setLoadingRepo] = useState(false);

    const fetchBranches = async () => {
        setLoadingBranches(true);
        setErrorBranches(null);
        try {
            // Using apiFetch for consistency with the rest of the codebase
            const response = await apiFetch(`/config/branches/${repo}`);
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            const data = await response.json();
            setBranches(data);
        } catch (error) {
            // More robust error handling
            if (error instanceof Error) {
                setErrorBranches(error.message);
            } else {
                setErrorBranches('An unknown error occurred');
            }
        } finally {
            setLoadingBranches(false);
        }
    };

    useEffect(() => {
        if (repo) {
            fetchBranches();
        }
    }, [repo]);

    const handleRepoChange = (event) => {
        setRepo(event.target.value);
        setLoadingRepo(true);
    };

    const handleBranchChange = (event) => {
        setSelectedBranch(event.target.value);
    };

    return (
        <div>
            <Field label="Repository" value={repo} onChange={handleRepoChange} placeholder="owner/repo">
                <input type="text" value={repo} onChange={handleRepoChange} placeholder="owner/repo" />
                {loadingRepo ? (
                    <span>Loading...</span>
                ) : null}
            </Field>
            <Field label="Dev Branch" value={selectedBranch} onChange={handleBranchChange} placeholder="main">
                {loadingBranches ? (
                    <select disabled>
                        <option>Loading...</option>
                    </select>
                ) : errorBranches ? (
                    <select>
                        <option>Error: {errorBranches}</option>
                    </select>
                ) : (
                    <select value={selectedBranch} onChange={handleBranchChange}>
                        {branches.map((branch) => (
                            <option key={branch} value={branch}>{branch}</option>
                        ))}
                    </select>
                )}
            </Field>
        </div>
    );
};

export default ConfigPage;
