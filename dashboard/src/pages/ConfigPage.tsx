import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

interface Repo {
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    language: string | null;
}

interface TestResult {
    success: boolean;
    message: string;
}

export default function ConfigPage() {
    const [configs, setConfigs] = useState<Record<string, string>>({});
    const [repos, setRepos] = useState<Repo[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testResults, setTestResults] = useState<Record<string, TestResult> | null>(null);
    const [message, setMessage] = useState('');

    // Form state (separate from saved config to track edits)
    const [form, setForm] = useState<Record<string, string>>({});

    useEffect(() => {
        loadConfig();
        loadRepos();
    }, []);

    const loadConfig = async () => {
        try {
            const data = await apiFetch<Record<string, string>>('/api/config');
            setConfigs(data);
            setForm(data);
        } catch (err: any) {
            setMessage(`Error loading config: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const loadRepos = async () => {
        try {
            const data = await apiFetch<Repo[]>('/api/config/repos');
            setRepos(data);
        } catch {
            // May fail if token doesn't have repo access
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        try {
            // Only send fields that changed
            const changed: Record<string, string> = {};
            for (const [key, value] of Object.entries(form)) {
                if (value !== configs[key]) {
                    changed[key] = value;
                }
            }

            if (Object.keys(changed).length === 0) {
                setMessage('No changes to save.');
                setSaving(false);
                return;
            }

            const updated = await apiFetch<Record<string, string>>('/api/config', {
                method: 'PUT',
                body: JSON.stringify(changed),
            });
            setConfigs(updated);
            setForm(updated);
            setMessage('Settings saved successfully.');
        } catch (err: any) {
            setMessage(`Error saving: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTestResults(null);
        try {
            const results = await apiFetch<Record<string, TestResult>>('/api/config/test', {
                method: 'POST',
            });
            setTestResults(results);
        } catch (err: any) {
            setMessage(`Test failed: ${err.message}`);
        }
    };

    const updateField = (key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    if (loading) return <div className="text-gray-500">Loading...</div>;

    const provider = form.ai_provider || 'gemini';

    return (
        <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>

            {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('Error') || message.includes('failed') ? 'bg-red-900/20 text-red-400 border border-red-800' : 'bg-green-900/20 text-green-400 border border-green-800'}`}>
                    {message}
                </div>
            )}

            {/* GitHub Settings */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">GitHub Settings</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Target Repository</label>
                        {repos.length > 0 ? (
                            <select
                                value={form.github_repo || ''}
                                onChange={(e) => updateField('github_repo', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="">All repositories (multi-repo mode)</option>
                                {repos.map((r) => (
                                    <option key={r.name} value={r.name}>{r.full_name} {r.private ? '(private)' : ''}</option>
                                ))}
                            </select>
                        ) : (
                            <Field label="" value={form.github_repo || ''} onChange={(v) => updateField('github_repo', v)} placeholder="repo-name (empty for all repos)" noLabel />
                        )}
                    </div>
                    <Field label="Dev Branch" value={form.dev_branch || 'main'} onChange={(v) => updateField('dev_branch', v)} placeholder="main" />
                    <Field label="Issue Label" value={form.issue_label || 'ai-agent'} onChange={(v) => updateField('issue_label', v)} placeholder="ai-agent" />
                    <Field label="Webhook Secret" value={form.webhook_secret || ''} onChange={(v) => updateField('webhook_secret', v)} placeholder="your-webhook-secret" type="password" />
                </div>
            </section>

            {/* AI Provider */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">AI Provider</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Provider</label>
                        <select
                            value={provider}
                            onChange={(e) => updateField('ai_provider', e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="gemini">Google Gemini</option>
                            <option value="openai">OpenAI</option>
                            <option value="claude">Claude (Anthropic)</option>
                            <option value="groq">Groq</option>
                        </select>
                    </div>

                    {provider === 'gemini' ? (
                        <>
                            <Field label="Gemini API Key" value={form.gemini_api_key || ''} onChange={(v) => updateField('gemini_api_key', v)} placeholder="Enter API key" type="password" />
                            <Field label="Gemini Model" value={form.gemini_model || 'gemini-2.0-flash'} onChange={(v) => updateField('gemini_model', v)} placeholder="gemini-2.0-flash" />
                        </>
                    ) : null}
                    {provider === 'openai' ? (
                        <>
                            <Field label="OpenAI API Key" value={form.openai_api_key || ''} onChange={(v) => updateField('openai_api_key', v)} placeholder="sk-..." type="password" />
                            <Field label="OpenAI Model" value={form.openai_model || 'gpt-4o'} onChange={(v) => updateField('openai_model', v)} placeholder="gpt-4o" />
                        </>
                    ) : null}
                    {provider === 'claude' ? (
                        <>
                            <Field label="Claude API Key" value={form.claude_api_key || ''} onChange={(v) => updateField('claude_api_key', v)} placeholder="sk-ant-..." type="password" />
                            <Field label="Claude Model" value={form.claude_model || 'claude-sonnet-4-6'} onChange={(v) => updateField('claude_model', v)} placeholder="claude-sonnet-4-6" />
                        </>
                    ) : null}
                    {provider === 'groq' ? (
                        <>
                            <Field label="Groq API Key" value={form.groq_api_key || ''} onChange={(v) => updateField('groq_api_key', v)} placeholder="gsk_..." type="password" />
                            <Field label="Groq Model" value={form.groq_model || 'llama-3.3-70b-versatile'} onChange={(v) => updateField('groq_model', v)} placeholder="llama-3.3-70b-versatile" />
                        </>
                    ) : null}
                </div>
            </section>

            {/* Agent Settings */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Agent Settings</h3>
                <div className="space-y-4">
                    <Field label="Max Concurrent Agents" value={form.max_concurrent_agents || '3'} onChange={() => console.log("Max concurrent agents changed")} placeholder="3" disabled />
                </div>
            </section>

            {/* Test Results */}
            {testResults && (
                <div className="mb-6 space-y-2">
                    {Object.entries(testResults).map(([key, result]) => (
                        <div key={key} className={`p-3 rounded-lg text-sm border ${result.success ? 'bg-green-900/20 text-green-400 border-green-800' : 'bg-red-900/20 text-red-400 border-red-800'}`}>
                            <span className="font-medium capitalize">{key}:</span> {result.message}
                        </div>
                    ))}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                    onClick={handleTest}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2 rounded-lg font-medium transition-colors border border-gray-700"
                >
                    Test Connection
                </button>
            </div>
        </div>
    );
}

function Field({ label, value, onChange, placeholder, type = 'text', noLabel = false, disabled = false }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    noLabel?: boolean;
    disabled?: boolean;
}) {
    return (
        <div>
            {!noLabel && label && <label className="block text-sm text-gray-400 mb-1">{label}</label>}
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={`w-full bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
        </div>
    );
}
