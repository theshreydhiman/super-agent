import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import { PageHeader } from '../components/Layout';
import { Save, Zap, Github, Cpu, Settings2, CheckCircle, XCircle } from 'lucide-react';
import { useFetchBranches } from '../hooks/useFetch';

// ...

const [repo, setRepo] = useState('');
const { branches, loading: loadingBranches, error: errorBranches } = useFetchBranches(repo);

// ...

<Field label="Dev Branch" value={form.dev_branch || 'main'} onChange={(v) => updateField('dev_branch', v)} placeholder="main">
    {loadingBranches ? (
        <select disabled>
            <option>Loading...</option>
        </select>
    ) : errorBranches ? (
        <select>
            <option>Error: {errorBranches}</option>
        </select>
    ) : (
        <select value={form.dev_branch || ''} onChange={(e) => updateField('dev_branch', e.target.value)}>
            {branches.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
            ))}
        </select>
    )}
</Field>
// ...