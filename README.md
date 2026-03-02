# 🤖 Super Agent

**AI-powered multi-agent system for automated GitHub issue resolution.**

Super Agent watches your GitHub repository for issues tagged with a specific label, dispatches AI-powered worker agents to generate code fixes, has a reviewer agent validate the changes, creates pull requests to your dev branch, and notifies you via email — all fully automated.

---

## ✨ How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    SUPER AGENT                          │
│                                                         │
│   Trigger (Webhook / Cron / One-shot)                   │
│       │                                                 │
│       ▼                                                 │
│   Fetch issues labeled "ai-agent"                       │
│       │                                                 │
│       ▼                                                 │
│   ┌──────────────────────────────────┐                  │
│   │  Worker Agents (concurrent)      │                  │
│   │  • Analyze issue with AI         │                  │
│   │  • Read relevant source files    │                  │
│   │  • Generate code fix             │                  │
│   │  • Commit to fix/issue-N branch  │                  │
│   └──────────────────────────────────┘                  │
│       │                                                 │
│       ▼                                                 │
│   ┌──────────────────────────────────┐                  │
│   │  Reviewer Agent                  │                  │
│   │  • Diff the fix branch vs dev    │                  │
│   │  • AI code review                │                  │
│   │  • Create pull request           │                  │
│   └──────────────────────────────────┘                  │
│       │                                                 │
│       ▼                                                 │
│   📧 Email notification with PR summary                 │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A **GitHub Personal Access Token** with `repo` scope
- A **Google Gemini API key** ([Get one here](https://aistudio.google.com/apikey))
- *(Optional)* A **Gmail App Password** for email notifications

---

## 🚀 Setup

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/super-agent.git
cd super-agent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env`:

```dotenv
# ─── GitHub Configuration ───
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-repo-name
DEV_BRANCH=dev

# ─── Gemini Configuration ───
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash          # or any compatible Gemini model

# ─── Email Configuration (Gmail SMTP) ───
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password            # Gmail App Password
NOTIFICATION_EMAIL=your-email@gmail.com

# ─── Trigger Configuration ───
WEBHOOK_MODE=true                      # Enable GitHub webhook server
CRON_MODE=true                         # Enable cron-based polling
POLL_INTERVAL_MINUTES=5                # Polling interval (if cron enabled)
WEBHOOK_PORT=3000                      # Port for webhook server
WEBHOOK_SECRET=your-webhook-secret     # GitHub webhook secret

# ─── Agent Configuration ───
ISSUE_LABEL=ai-agent                   # Label that triggers the agent
MAX_CONCURRENT_AGENTS=3                # Max parallel worker agents
```

> **Required variables:** `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, and `GEMINI_API_KEY`. The rest have sensible defaults.

---

## ▶️ Running the Agent

### Development mode (with hot-reload via `tsx`)

```bash
npm run dev
```

### Production mode

```bash
# Build TypeScript → JavaScript
npm run build

# Start the compiled app
npm start
```

### One-shot mode

If **both** `WEBHOOK_MODE` and `CRON_MODE` are set to `false`, the agent runs a single sweep and exits — useful for manual or CI-triggered runs.

---

## 🔧 Trigger Modes

| Mode | Description |
|------|-------------|
| **Webhook** | Starts an Express server on `WEBHOOK_PORT`. Configure a GitHub webhook to send **Issues** events to `http://<host>:<port>/webhook`. The agent runs immediately when a matching issue is opened or labeled. |
| **Cron** | Polls for new issues every `POLL_INTERVAL_MINUTES` minutes. Also runs once immediately on startup. |
| **One-shot** | Runs once and exits. Triggered when both Webhook and Cron modes are disabled. |

You can enable **both** Webhook and Cron modes simultaneously.

### Setting up the GitHub Webhook

1. Go to your repo → **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL:** `http://<your-server>:3000/webhook`
3. **Content type:** `application/json`
4. **Secret:** Same value as `WEBHOOK_SECRET` in your `.env`
5. **Events:** Select **Issues**
6. Click **Add webhook**

---

## 🏗️ Project Structure

```
super-agent/
├── src/
│   ├── index.ts                 # Entry point & bootstrap
│   ├── config.ts                # Environment config & validation
│   ├── agents/
│   │   ├── super-agent.ts       # Orchestrator — manages the full pipeline
│   │   ├── worker-agent.ts      # Analyzes issues & generates code fixes
│   │   └── reviewer-agent.ts    # Reviews changes & creates PRs
│   ├── ai/
│   │   └── ai-engine.ts         # Gemini AI integration (analyze, fix, review)
│   ├── github/
│   │   └── github-client.ts     # GitHub API wrapper (Octokit)
│   ├── services/
│   │   └── email-service.ts     # Email notifications (Nodemailer)
│   ├── triggers/
│   │   ├── webhook-server.ts    # Express webhook server
│   │   └── cron-poller.ts       # Cron-based polling trigger
│   └── utils/
│       ├── logger.ts            # Structured logger
│       └── retry.ts             # Retry utility with backoff
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## 🏷️ How to Use

1. **Label an issue** in your GitHub repo with `ai-agent` (or your configured `ISSUE_LABEL`).
2. Super Agent picks up the issue (via webhook or next cron tick).
3. A **Worker Agent** creates a `fix/issue-<N>` branch, analyzes the issue with AI, reads the relevant files, generates a fix, and commits it.
4. A **Reviewer Agent** diffs the branch against `dev`, performs an AI code review, and opens a pull request.
5. You receive an **email notification** with a summary of all PRs created.
6. **Review and merge** the PR at your convenience.

### Labels used by the agent

| Label | Meaning |
|-------|---------|
| `ai-agent` | Issue is eligible for automated fixing |
| `in-progress` | Agent is currently working on the issue |
| `ai-pr-created` | A PR has been created for this issue |

---

## 📦 Tech Stack

| Package | Purpose |
|---------|---------|
| **TypeScript** | Type-safe codebase |
| **@octokit/rest** | GitHub REST API client |
| **@octokit/webhooks** | Webhook signature verification |
| **@google/generative-ai** | Google Gemini AI integration |
| **express** | Webhook HTTP server |
| **node-cron** | Scheduled polling |
| **nodemailer** | Email notifications |
| **simple-git** | Git operations |
| **dotenv** | Environment variable loading |

---

## 📝 Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Run in development mode with `tsx` |
| `build` | `npm run build` | Compile TypeScript to `dist/` |
| `start` | `npm start` | Run the compiled production build |
| `test` | `npm test` | Run tests with Jest |

---

## 🛡️ Security Notes

- **Never commit your `.env` file.** It's already in `.gitignore`.
- Use a **GitHub fine-grained PAT** with only the permissions you need (`repo` scope).
- Always set a `WEBHOOK_SECRET` and verify signatures in production.
- For Gmail, use an [App Password](https://myaccount.google.com/apppasswords), not your actual password.

---

## 📄 License

MIT
