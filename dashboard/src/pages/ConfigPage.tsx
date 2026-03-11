import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import { PageHeader } from '../components/Layout';
import { Save, Zap, Github, Cpu, Settings2, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { useFetchBranches } from '../hooks/useFetch';

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
    const [form, setForm] = useState<Record<string, string>>({});

    const selectedRepo = repos.find((r) => r.name === form.github_repo);
    const { branches, loading: loadingBranches } = useFetchBranches(selectedRepo?.full_name || '');

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

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen">
                <PageHeader title="Settings" subtitle="Configure your agent" />
                <div className="flex-1 flex items-center justify-center text-text-muted font-mono text-sm">Loading...</div>
            </div>
        );
    }

    const provider = form.ai_provider || 'gemini';

    return (
        <div className="flex flex-col min-h-screen">
            <PageHeader
                title="Settings"
                subtitle="Configure your agent"
                actions={
                    <div className="flex gap-3">
                        <button
                            onClick={handleTest}
                            className="px-4 py-2.5 rounded-[10px] text-[13px] font-semibold bg-white/[0.06] text-text-secondary border border-border hover:bg-white/[0.1] hover:text-text-primary transition-all flex items-center gap-2"
                        >
                            <Zap size={14} />
                            Test Connection
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-[10px] text-[13px] font-semibold bg-accent hover:bg-accent-hover text-white disabled:opacity-50 transition-all hover:glow-accent flex items-center gap-2"
                        >
                            <Save size={14} />
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                }
            />

            <div className="flex-1 dot-grid p-7">
                <div className="max-w-3xl">
                    {message && (
                        <div className={`mb-5 p-3 rounded-lg text-sm font-mono border ${
                            message.includes('Error') || message.includes('failed')
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-green-500/10 text-green-400 border-green-500/20'
                        }`}>
                            {message}
                        </div>
                    )}

                    {/* Test Results */}
                    {testResults && (
                        <div className="mb-5 space-y-2">
                            {Object.entries(testResults).map(([key, result]) => (
                                <div key={key} className={`p-3 rounded-lg text-sm border font-mono flex items-center gap-2 ${
                                    result.success
                                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                    {result.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                    <span className="font-semibold capitalize">{key}:</span> {result.message}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* GitHub Settings */}
                    <Section icon={Github} title="GitHub Settings">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[12px] text-text-muted mb-1.5 font-mono uppercase tracking-wide">Target Repository</label>
                                {repos.length > 0 ? (
                                    <select
                                        value={form.github_repo || ''}
                                        onChange={(e) => updateField('github_repo', e.target.value)}
                                        className="w-full bg-white/[0.04] border border-border text-text-secondary rounded-lg px-3 py-2.5 text-sm font-mono focus:border-accent focus:outline-none transition-colors"
                                    >
                                        <option value="">All repositories (multi-repo mode)</option>
                                        {repos.map((r) => (
                                            <option key={r.name} value={r.name}>{r.full_name} {r.private ? '(private)' : ''}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <Field value={form.github_repo || ''} onChange={(v) => updateField('github_repo', v)} placeholder="repo-name (empty for all repos)" />
                                )}
                            </div>
                            <div>
                                <label className="block text-[12px] text-text-muted mb-1.5 font-mono uppercase tracking-wide">Dev Branch</label>
                                {branches.length > 0 ? (
                                    <select
                                        value={form.dev_branch || 'main'}
                                        onChange={(e) => updateField('dev_branch', e.target.value)}
                                        className="w-full bg-white/[0.04] border border-border text-text-secondary rounded-lg px-3 py-2.5 text-sm font-mono focus:border-accent focus:outline-none transition-colors"
                                    >
                                        {branches.map((branch) => (
                                            <option key={branch} value={branch}>{branch}</option>
                                        ))}
                                    </select>
                                ) : loadingBranches && selectedRepo ? (
                                    <select disabled className="w-full bg-white/[0.04] border border-border text-text-muted rounded-lg px-3 py-2.5 text-sm font-mono opacity-40">
                                        <option>Loading branches...</option>
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={form.dev_branch || 'main'}
                                        onChange={(e) => updateField('dev_branch', e.target.value)}
                                        placeholder="main"
                                        className="w-full bg-white/[0.04] border border-border text-text-secondary rounded-lg px-3 py-2.5 text-sm font-mono focus:border-accent focus:outline-none transition-colors placeholder:text-text-dim"
                                    />
                                )}
                            </div>
                            <Field label="Issue Label" value={form.issue_label || 'ai-agent'} onChange={(v) => updateField('issue_label', v)} placeholder="ai-agent" />
                            <Field label="Webhook Secret" value={form.webhook_secret || ''} onChange={(v) => updateField('webhook_secret', v)} placeholder="your-webhook-secret" type="password" />
                        </div>
                    </Section>

                    {/* AI Provider */}
                    <Section icon={Cpu} title="AI Provider">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[12px] text-text-muted mb-1.5 font-mono uppercase tracking-wide">Provider</label>
                                <select
                                    value={provider}
                                    onChange={(e) => updateField('ai_provider', e.target.value)}
                                    className="w-full bg-white/[0.04] border border-border text-text-secondary rounded-lg px-3 py-2.5 text-sm font-mono focus:border-accent focus:outline-none transition-colors"
                                >
                                    <option value="gemini">Google Gemini</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="claude">Claude (Anthropic)</option>
                                    <option value="groq">Groq</option>
                                </select>
                            </div>

                            {provider === 'gemini' && (
                                <>
                                    <Field label="Gemini API Key" value={form.gemini_api_key || ''} onChange={(v) => updateField('gemini_api_key', v)} placeholder="Enter API key" type="password" />
                                    <Field label="Gemini Model" value={form.gemini_model || 'gemini-2.0-flash'} onChange={(v) => updateField('gemini_model', v)} placeholder="gemini-2.0-flash" />
                                </>
                            )}
                            {provider === 'openai' && (
                                <>
                                    <Field label="OpenAI API Key" value={form.openai_api_key || ''} onChange={(v) => updateField('openai_api_key', v)} placeholder="sk-..." type="password" />
                                    <Field label="OpenAI Model" value={form.openai_model || 'gpt-4o'} onChange={(v) => updateField('openai_model', v)} placeholder="gpt-4o" />
                                </>
                            )}
                            {provider === 'claude' && (
                                <>
                                    <Field label="Claude API Key" value={form.claude_api_key || ''} onChange={(v) => updateField('claude_api_key', v)} placeholder="sk-ant-..." type="password" />
                                    <Field label="Claude Model" value={form.claude_model || 'claude-sonnet-4-6'} onChange={(v) => updateField('claude_model', v)} placeholder="claude-sonnet-4-6" />
                                </>
                            )}
                            {provider === 'groq' && (
                                <>
                                    <Field label="Groq API Key" value={form.groq_api_key || ''} onChange={(v) => updateField('groq_api_key', v)} placeholder="gsk_..." type="password" />
                                    <Field label="Groq Model" value={form.groq_model || 'llama-3.3-70b-versatile'} onChange={(v) => updateField('groq_model', v)} placeholder="llama-3.3-70b-versatile" />
                                </>
                            )}
                        </div>
                    </Section>

                    {/* Agent Settings */}
                    <Section icon={Settings2} title="Agent Settings">
                        <div className="space-y-4">
                            <Field label="Max Concurrent Agents" value={form.max_concurrent_agents || '3'} onChange={() => {}} placeholder="3" disabled />
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
    return (
        <section className="bg-surface border border-border rounded-xl p-6 mb-5">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
                    <Icon size={16} className="text-accent-text" />
                </div>
                <h3 className="text-[15px] font-semibold text-zinc-100">{title}</h3>
            </div>
            {children}
        </section>
    );
}

function Field({ label, value, onChange, placeholder, type = 'text', disabled = false }: {
    label?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    disabled?: boolean;
}) {
    const [visible, setVisible] = useState(false);
    const isPassword = type === 'password';

    return (
        <div>
            {label && (
                <label className="block text-[12px] text-text-muted mb-1.5 font-mono uppercase tracking-wide">{label}</label>
            )}
            <div className="relative">
                <input
                    type={isPassword && visible ? 'text' : type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`w-full bg-white/[0.04] border border-border text-text-secondary rounded-lg px-3 py-2.5 text-sm font-mono focus:border-accent focus:outline-none transition-colors placeholder:text-text-dim ${
                        disabled ? 'opacity-40 cursor-not-allowed' : ''
                    } ${isPassword ? 'pr-10' : ''}`}
                />
                {isPassword && value && (
                    <button
                        type="button"
                        onClick={() => setVisible((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                    >
                        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                )}
            </div>
        </div>
    );
}
