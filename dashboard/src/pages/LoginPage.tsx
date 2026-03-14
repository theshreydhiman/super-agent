import { Terminal } from 'lucide-react';

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-base dot-grid flex items-center justify-center px-4">
            <div className="bg-surface border border-border rounded-xl p-6 sm:p-10 max-w-md w-full text-center">
                {/* Brand */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center mx-auto mb-6">
                    <Terminal size={28} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-zinc-100 tracking-tight mb-2">Super Agent</h1>
                <p className="text-text-muted text-sm mb-8 leading-relaxed">
                    AI-powered GitHub issue automation.<br />
                    Sign in to manage your agents and track activity.
                </p>

                {/* Login button */}
                <a
                    href="/auth/github"
                    className="inline-flex items-center gap-3 bg-white/[0.06] hover:bg-white/[0.1] text-text-primary px-6 py-3 rounded-xl font-semibold text-sm transition-all border border-border hover:border-border-hover hover:glow-accent"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    Sign in with GitHub
                </a>

                {/* Links */}
                <div className="mt-6 flex items-center justify-center gap-4 text-sm">
                    <a href="/guide" className="text-text-secondary hover:text-accent-light transition-colors">Getting Started</a>
                    <span className="text-text-dim">&middot;</span>
                    <a href="/about" className="text-text-secondary hover:text-accent-light transition-colors">About</a>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-[11px] text-text-dim font-mono">
                        v1.0 &middot; Secure OAuth 2.0 Authentication
                    </p>
                </div>
            </div>
        </div>
    );
}
