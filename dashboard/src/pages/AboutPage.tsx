import { PageHeader } from '../components/Layout';
import { Link } from 'react-router-dom';
import {
    Bot,
    GitPullRequest,
    Bug,
    Code,
    Eye,
    Cpu,
    ArrowRight,
    Github,
    Zap,
    Shield,
    BookOpen,
} from 'lucide-react';

function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
    return (
        <div className="bg-[#0a0a12] border border-border rounded-lg p-5">
            <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center mb-3">
                <Icon size={18} className="text-accent-text" />
            </div>
            <h3 className="text-[14px] font-semibold text-zinc-100 mb-1.5">{title}</h3>
            <p className="text-[13px] text-text-dim leading-relaxed">{description}</p>
        </div>
    );
}

export default function AboutPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <PageHeader
                title="About"
                subtitle="What is Super Agent?"
                actions={
                    <Link
                        to="/guide"
                        className="px-4 py-2.5 rounded-[10px] text-[13px] font-semibold bg-accent hover:bg-accent-hover text-white transition-all hover:glow-accent flex items-center gap-2"
                    >
                        <BookOpen size={15} />
                        Getting Started
                    </Link>
                }
            />

            <div className="flex-1 dot-grid p-7">
                <div className="max-w-3xl">
                    {/* Hero */}
                    <div className="bg-surface border border-border rounded-xl p-8 mb-6 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center mx-auto mb-5">
                            <Bot size={30} className="text-white" />
                        </div>
                        <h2 className="text-[22px] font-bold text-zinc-100 mb-3">Super Agent</h2>
                        <p className="text-[15px] text-text-secondary leading-relaxed max-w-xl mx-auto">
                            An AI-powered system that automatically reads your GitHub issues,
                            analyzes your codebase, writes fixes, reviews its own work,
                            and opens pull requests — so you can focus on building.
                        </p>
                        <div className="mt-5 inline-flex items-center gap-2 text-[12px] font-mono text-text-dim bg-white/[0.03] border border-border rounded-full px-4 py-1.5">
                            v1.0 &middot; Open Source
                        </div>
                    </div>

                    {/* How It Works */}
                    <div className="bg-surface border border-border rounded-xl p-6 mb-6">
                        <h3 className="text-[16px] font-semibold text-zinc-100 mb-4">How It Works</h3>
                        <div className="space-y-4">
                            {[
                                {
                                    icon: Bug,
                                    step: '1',
                                    title: 'You create a GitHub issue',
                                    desc: 'Describe the bug or feature you want. Add the trigger label (default: ai-agent).',
                                },
                                {
                                    icon: Code,
                                    step: '2',
                                    title: 'Worker agent analyzes your code',
                                    desc: 'An AI agent reads the issue, clones your repo, understands the codebase, and writes a fix.',
                                },
                                {
                                    icon: Eye,
                                    step: '3',
                                    title: 'Reviewer agent validates the changes',
                                    desc: 'A second agent reviews the fix for correctness, style, and potential issues.',
                                },
                                {
                                    icon: GitPullRequest,
                                    step: '4',
                                    title: 'Pull request is created',
                                    desc: 'The fix is pushed to a new branch and a PR is opened for you to review and merge.',
                                },
                            ].map((item) => (
                                <div key={item.step} className="flex items-start gap-4">
                                    <div className="w-9 h-9 rounded-full bg-accent-muted flex items-center justify-center shrink-0 border border-accent/30">
                                        <span className="text-accent-text font-bold text-sm">{item.step}</span>
                                    </div>
                                    <div className="pt-0.5">
                                        <div className="text-[14px] font-semibold text-zinc-100">{item.title}</div>
                                        <p className="text-[13px] text-text-dim mt-0.5">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Features */}
                    <div className="bg-surface border border-border rounded-xl p-6 mb-6">
                        <h3 className="text-[16px] font-semibold text-zinc-100 mb-4">Features</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FeatureCard
                                icon={Cpu}
                                title="Multi-AI Support"
                                description="Choose from Google Gemini, OpenAI, Anthropic Claude, or Groq. Switch providers anytime."
                            />
                            <FeatureCard
                                icon={Github}
                                title="GitHub Native"
                                description="Works directly with GitHub issues, branches, and pull requests. No extra tools needed."
                            />
                            <FeatureCard
                                icon={Eye}
                                title="Built-in Code Review"
                                description="Every fix is reviewed by a separate AI agent before a PR is created."
                            />
                            <FeatureCard
                                icon={Zap}
                                title="Webhook & Manual Triggers"
                                description="Auto-detect labeled issues via webhook, or trigger fixes manually from the dashboard."
                            />
                            <FeatureCard
                                icon={Shield}
                                title="Encrypted Credentials"
                                description="API keys and tokens are encrypted with AES-256-GCM before storage. Nothing stored in plain text."
                            />
                            <FeatureCard
                                icon={Bot}
                                title="Concurrent Agents"
                                description="Run multiple AI agents in parallel to fix several issues at once."
                            />
                        </div>
                    </div>

                    {/* Supported Providers */}
                    <div className="bg-surface border border-border rounded-xl p-6 mb-6">
                        <h3 className="text-[16px] font-semibold text-zinc-100 mb-4">Supported AI Providers</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { name: 'Gemini', model: 'gemini-2.0-flash' },
                                { name: 'OpenAI', model: 'gpt-4o' },
                                { name: 'Claude', model: 'claude-sonnet-4-6' },
                                { name: 'Groq', model: 'llama-3.3-70b' },
                            ].map((p) => (
                                <div key={p.name} className="bg-[#0a0a12] border border-border rounded-lg p-4 text-center">
                                    <div className="text-[14px] font-semibold text-text-primary mb-1">{p.name}</div>
                                    <div className="text-[11px] text-text-dim font-mono">{p.model}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="bg-surface border border-border rounded-xl p-6 flex items-center justify-between">
                        <div>
                            <h3 className="text-[15px] font-semibold text-zinc-100">Ready to get started?</h3>
                            <p className="text-[13px] text-text-dim mt-1">Set up your agent in a few minutes.</p>
                        </div>
                        <Link
                            to="/guide"
                            className="px-4 py-2.5 rounded-[10px] text-[13px] font-semibold bg-accent hover:bg-accent-hover text-white transition-all hover:glow-accent flex items-center gap-2 shrink-0"
                        >
                            Get Started <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
