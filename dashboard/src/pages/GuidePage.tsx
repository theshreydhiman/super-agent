import { useState } from 'react';
import { PageHeader } from '../components/Layout';
import { Link } from 'react-router-dom';
import {
    ChevronRight,
    ChevronDown,
    Github,
    Tag,
    CheckCircle2,
    ExternalLink,
    BookOpen,
    ArrowRight,
    Zap,
    Settings,
    Bug,
    GitPullRequest,
    LayoutDashboard,
} from 'lucide-react';

interface StepProps {
    number: number;
    title: string;
    description: string;
    children: React.ReactNode;
}

function Step({ number, title, description, children }: StepProps) {
    const [open, setOpen] = useState(number === 1);

    return (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full px-6 py-5 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors"
            >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-accent-muted text-accent-text border border-accent/30">
                    {number}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-zinc-100">{title}</h3>
                    <p className="text-[13px] text-text-muted mt-0.5">{description}</p>
                </div>
                {open ? (
                    <ChevronDown size={18} className="text-text-dim shrink-0" />
                ) : (
                    <ChevronRight size={18} className="text-text-dim shrink-0" />
                )}
            </button>
            {open && (
                <div className="px-6 pb-6 pt-2 border-t border-border">
                    {children}
                </div>
            )}
        </div>
    );
}

function Tip({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-3 p-3 rounded-lg bg-accent-muted/50 border border-accent/20 text-[13px] text-accent-light mt-4">
            <Zap size={15} className="shrink-0 mt-0.5 text-accent-text" />
            <div>{children}</div>
        </div>
    );
}

function InlineCode({ children }: { children: string }) {
    return (
        <code className="text-cyan-text bg-cyan-muted px-1.5 py-0.5 rounded font-mono text-xs">{children}</code>
    );
}

function NumberedItem({ n, children }: { n: number; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <span className="text-accent-text font-mono font-bold text-sm mt-0.5">{n}.</span>
            <div>{children}</div>
        </div>
    );
}

export default function GuidePage() {
    return (
        <div className="flex flex-col min-h-screen">
            <PageHeader
                title="Getting Started"
                subtitle="Set up your agent in a few minutes"
                actions={
                    <Link
                        to="/config"
                        className="px-4 py-2.5 rounded-[10px] text-[13px] font-semibold bg-accent hover:bg-accent-hover text-white transition-all hover:glow-accent flex items-center gap-2"
                    >
                        <Settings size={15} />
                        Open Settings
                    </Link>
                }
            />

            <div className="flex-1 dot-grid p-7">
                <div className="max-w-3xl">
                    {/* Intro */}
                    <div className="bg-surface border border-border rounded-xl p-6 mb-6">
                        <div className="flex items-center gap-3 mb-3">
                            <BookOpen size={20} className="text-accent-text" />
                            <h2 className="text-[17px] font-bold text-zinc-100">How It Works</h2>
                        </div>
                        <p className="text-[14px] text-text-secondary leading-relaxed mb-4">
                            Super Agent watches your GitHub issues. When you label one for AI,
                            it reads the issue, analyzes your code, writes a fix, reviews its own work,
                            and opens a pull request for you to merge.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {['Label an Issue', 'AI Analyzes Code', 'Fix Generated', 'PR Created'].map((step, i) => (
                                <div key={step} className="flex items-center gap-2">
                                    <span className="px-3 py-1.5 bg-white/[0.04] border border-border rounded-lg text-[12px] font-mono text-text-secondary">
                                        {step}
                                    </span>
                                    {i < 3 && <ArrowRight size={14} className="text-text-dim" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Steps */}
                    <div className="space-y-4">
                        {/* Step 1: Sign Up */}
                        <Step
                            number={1}
                            title="Sign Up with GitHub"
                            description="One-click authentication using your GitHub account"
                        >
                            <div className="space-y-4 text-[13px] text-text-secondary leading-relaxed">
                                <p>
                                    Click <strong className="text-text-primary">Sign in with GitHub</strong> on the login screen.
                                    This uses secure OAuth — Super Agent never sees your GitHub password.
                                </p>

                                <div className="bg-[#0a0a12] border border-border rounded-lg p-5 flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
                                        <Github size={22} className="text-white" />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-text-primary font-semibold mb-1">Sign in with GitHub</div>
                                        <div className="text-text-dim text-[12px]">You'll be redirected to GitHub to authorize access</div>
                                    </div>
                                </div>

                                <p>
                                    Once authorized, you're taken straight to the dashboard. Your account is created automatically on first login.
                                </p>

                                <Tip>
                                    Already signed in? You're all set — move on to Step 2.
                                </Tip>
                            </div>
                        </Step>

                        {/* Step 2: Configure Settings */}
                        <Step
                            number={2}
                            title="Configure Your Settings"
                            description="Select a repository, set your branch, and choose a trigger label"
                        >
                            <div className="space-y-4 text-[13px] text-text-secondary leading-relaxed">
                                <p>
                                    Head to{' '}
                                    <Link to="/config" className="text-accent-text hover:text-accent-light underline underline-offset-2">
                                        Settings
                                    </Link>{' '}
                                    to tell Super Agent where to work and how to behave.
                                </p>

                                <div className="bg-[#0a0a12] border border-border rounded-lg p-4 space-y-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Github size={14} className="text-accent-text" />
                                            <span className="text-text-primary font-medium">Target Repository</span>
                                        </div>
                                        <p className="text-text-dim text-[12px] ml-[22px]">
                                            Pick a specific repo from the dropdown, or leave it empty to monitor all your repos.
                                        </p>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <GitPullRequest size={14} className="text-accent-text" />
                                            <span className="text-text-primary font-medium">Dev Branch</span>
                                        </div>
                                        <p className="text-text-dim text-[12px] ml-[22px]">
                                            The branch Super Agent creates fix branches from. Usually <InlineCode>main</InlineCode> or <InlineCode>develop</InlineCode>.
                                        </p>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Tag size={14} className="text-accent-text" />
                                            <span className="text-text-primary font-medium">Issue Label</span>
                                        </div>
                                        <p className="text-text-dim text-[12px] ml-[22px]">
                                            The label that triggers Super Agent. Defaults to <InlineCode>ai-agent</InlineCode> — change it to anything you prefer.
                                        </p>
                                    </div>
                                </div>

                                <Tip>
                                    Don't forget to click <strong className="text-text-primary">Save Settings</strong> when you're done.
                                </Tip>
                            </div>
                        </Step>

                        {/* Step 3: Pick AI Provider */}
                        <Step
                            number={3}
                            title="Pick an AI Provider"
                            description="Choose which AI model writes your code fixes"
                        >
                            <div className="space-y-4 text-[13px] text-text-secondary leading-relaxed">
                                <p>
                                    In{' '}
                                    <Link to="/config" className="text-accent-text hover:text-accent-light underline underline-offset-2">
                                        Settings &gt; AI Provider
                                    </Link>, select a provider and paste your API key.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                        { name: 'Google Gemini', model: 'gemini-2.0-flash', url: 'https://aistudio.google.com/apikey', tag: 'Free tier' },
                                        { name: 'OpenAI', model: 'gpt-4o', url: 'https://platform.openai.com/api-keys', tag: 'Popular' },
                                        { name: 'Anthropic Claude', model: 'claude-sonnet-4-6', url: 'https://console.anthropic.com/settings/keys', tag: 'Best quality' },
                                        { name: 'Groq', model: 'llama-3.3-70b', url: 'https://console.groq.com/keys', tag: 'Fast & free' },
                                    ].map((p) => (
                                        <div key={p.name} className="bg-[#0a0a12] border border-border rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-text-primary font-semibold text-[14px]">{p.name}</span>
                                                <span className="text-[10px] font-semibold text-accent-text bg-accent-muted px-2 py-0.5 rounded-full">
                                                    {p.tag}
                                                </span>
                                            </div>
                                            <div className="text-[12px] text-text-dim font-mono mb-3">model: {p.model}</div>
                                            <a
                                                href={p.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-accent-text hover:text-accent-light text-[12px] font-medium inline-flex items-center gap-1"
                                            >
                                                Get API key <ExternalLink size={11} />
                                            </a>
                                        </div>
                                    ))}
                                </div>

                                <Tip>
                                    Gemini and Groq both have free tiers — great for trying things out.
                                </Tip>
                            </div>
                        </Step>

                        {/* Step 4: Test Connection */}
                        <Step
                            number={4}
                            title="Test Your Connection"
                            description="Make sure everything is wired up"
                        >
                            <div className="space-y-4 text-[13px] text-text-secondary leading-relaxed">
                                <p>
                                    In{' '}
                                    <Link to="/config" className="text-accent-text hover:text-accent-light underline underline-offset-2">
                                        Settings
                                    </Link>, click the <strong className="text-text-primary">Test Connection</strong> button. You'll see a result for each service:
                                </p>

                                <div className="bg-[#0a0a12] border border-border rounded-lg p-4 space-y-2.5">
                                    {[
                                        { label: 'GitHub', desc: 'Token is valid and repos are accessible' },
                                        { label: 'AI Provider', desc: 'API key works and model responds' },
                                    ].map((item) => (
                                        <div key={item.label} className="flex items-center gap-3 py-1">
                                            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                                            <div>
                                                <span className="text-text-primary font-medium">{item.label}</span>
                                                <span className="text-text-dim ml-2">&mdash; {item.desc}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <p>
                                    If something fails, double-check your token or API key and try again.
                                </p>
                            </div>
                        </Step>

                        {/* Step 5: Fix an Issue */}
                        <Step
                            number={5}
                            title="Fix Your First Issue"
                            description="Label a GitHub issue and let Super Agent handle the rest"
                        >
                            <div className="space-y-4 text-[13px] text-text-secondary leading-relaxed">
                                <p>You're ready! There are two ways to trigger a fix:</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-[#0a0a12] border border-border rounded-lg p-4">
                                        <div className="text-[11px] uppercase tracking-wide text-text-dim font-semibold mb-2">Option A — From GitHub</div>
                                        <div className="space-y-2">
                                            <NumberedItem n={1}>
                                                Create an issue describing the bug or feature
                                            </NumberedItem>
                                            <NumberedItem n={2}>
                                                Add the <InlineCode>ai-agent</InlineCode> label
                                            </NumberedItem>
                                            <NumberedItem n={3}>
                                                Super Agent picks it up via webhook
                                            </NumberedItem>
                                        </div>
                                    </div>
                                    <div className="bg-[#0a0a12] border border-border rounded-lg p-4">
                                        <div className="text-[11px] uppercase tracking-wide text-text-dim font-semibold mb-2">Option B — From Dashboard</div>
                                        <div className="space-y-2">
                                            <NumberedItem n={1}>
                                                Go to the{' '}
                                                <Link to="/issues" className="text-accent-text hover:text-accent-light underline underline-offset-2">Issues</Link>{' '}page
                                            </NumberedItem>
                                            <NumberedItem n={2}>
                                                Find the issue you want fixed
                                            </NumberedItem>
                                            <NumberedItem n={3}>
                                                Click <strong className="text-text-primary">Fix</strong> or <strong className="text-text-primary">Retry</strong>
                                            </NumberedItem>
                                        </div>
                                    </div>
                                </div>

                                <p>
                                    Track progress on the{' '}
                                    <Link to="/" className="text-accent-text hover:text-accent-light underline underline-offset-2">
                                        Dashboard
                                    </Link>. When done, you'll get a pull request to review and merge.
                                </p>

                                <div className="bg-[#0a0a12] border border-border rounded-lg p-4">
                                    <div className="text-[11px] uppercase tracking-wide text-text-dim font-semibold mb-3">Example Issue</div>
                                    <div className="space-y-2">
                                        <div className="text-text-primary font-semibold">Bug: Login form doesn't validate email format</div>
                                        <p className="text-text-dim text-[12px] leading-relaxed">
                                            The login form at /auth/login accepts any string as an email.
                                            It should validate the format and show an error for invalid inputs.
                                        </p>
                                        <div className="flex gap-2 mt-2">
                                            <span className="text-[11px] font-mono bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">bug</span>
                                            <span className="text-[11px] font-mono bg-accent-muted text-accent-text border border-accent/20 px-2 py-0.5 rounded">ai-agent</span>
                                        </div>
                                    </div>
                                </div>

                                <Tip>
                                    The more context you put in the issue (file paths, expected behavior, error messages), the better the fix.
                                </Tip>
                            </div>
                        </Step>
                    </div>

                    {/* Quick Links */}
                    <div className="mt-6 bg-surface border border-border rounded-xl p-6">
                        <h3 className="text-[15px] font-semibold text-zinc-100 mb-4">Quick Links</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Link
                                to="/"
                                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-border hover:bg-white/[0.06] hover:border-accent/30 transition-all group"
                            >
                                <LayoutDashboard size={16} className="text-text-dim group-hover:text-accent-text transition-colors" />
                                <span className="text-[13px] text-text-secondary group-hover:text-text-primary transition-colors">Dashboard</span>
                            </Link>
                            <Link
                                to="/issues"
                                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-border hover:bg-white/[0.06] hover:border-accent/30 transition-all group"
                            >
                                <Bug size={16} className="text-text-dim group-hover:text-accent-text transition-colors" />
                                <span className="text-[13px] text-text-secondary group-hover:text-text-primary transition-colors">Issues</span>
                            </Link>
                            <Link
                                to="/config"
                                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-border hover:bg-white/[0.06] hover:border-accent/30 transition-all group"
                            >
                                <Settings size={16} className="text-text-dim group-hover:text-accent-text transition-colors" />
                                <span className="text-[13px] text-text-secondary group-hover:text-text-primary transition-colors">Settings</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
