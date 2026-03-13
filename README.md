# Super Agent

**AI-powered multi-agent system for automated GitHub issue resolution with a web dashboard.**

Super Agent watches your GitHub repositories for issues tagged with a configurable label, dispatches AI-powered worker agents to generate code fixes, has a reviewer agent validate the changes, creates pull requests, and notifies you via email — all managed through a web dashboard with GitHub OAuth login.

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    SUPER AGENT                          │
│                                                         │
│   Trigger (Dashboard UI / Webhook / API)                │
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
│   │  • Diff the fix branch vs base   │                  │
│   │  • AI code review                │                  │
│   │  • Create pull request           │                  │
│   └──────────────────────────────────┘                  │
│       │                                                 │
│       ▼                                                 │
│   Email notification with PR summary                    │
└─────────────────────────────────────────────────────────┘
```

---

## Features

- **Web Dashboard** — Monitor runs, view issues, trigger fixes, and manage settings via a React UI
- **GitHub OAuth Login** — Secure authentication; each user manages their own credentials
- **Multi-Provider AI** — Choose between Gemini, OpenAI, Claude, or Groq per user
- **Per-User Config** — API keys, repo settings, and preferences stored encrypted in MySQL
- **Single-Issue Targeting** — Fix or retry individual issues from the dashboard
- **Webhook Support** — Auto-trigger on GitHub issue events with per-user authentication
- **Encrypted Secrets** — All API keys and tokens encrypted with AES-256-GCM
- **Concurrent Workers** — Process multiple issues in parallel with configurable limits
- **AI Code Review** — Reviewer agent validates fixes before creating PRs
- **Email Notifications** — Get notified when PRs are created (via EmailJS)
- **Real-Time Updates** — Socket.IO pushes live issue/stats updates to the dashboard

---

## Prerequisites

- **Node.js** >= 18
- **MySQL** 8.x
- A **GitHub OAuth App** (for dashboard login)
- At least one AI provider API key (Gemini, OpenAI, Claude, or Groq)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/theshreydhiman/super-agent.git
cd super-agent
npm install
cd dashboard && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```dotenv
# ─── GitHub OAuth App (required for dashboard login) ───
GITHUB_CLIENT_ID=your_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_oauth_app_client_secret

# ─── MySQL Database ───
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=super_agent

# ─── Security (required) ───
ENCRYPTION_KEY=<random-32-byte-hex>    # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=<random-secret-string>  # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ─── Server ───
WEBHOOK_PORT=3001
DASHBOARD_URL=http://localhost:3001

# ─── Webhook (optional) ───
WEBHOOK_SECRET=your_webhook_secret
WEBHOOK_MODE=true
```

### 3. Create the MySQL database

```sql
CREATE DATABASE super_agent;
```

Tables are auto-created on first startup via migrations.

### 4. Create a GitHub OAuth App

1. Go to **GitHub Settings > Developer settings > OAuth Apps > New OAuth App**
2. Set **Authorization callback URL** to: `http://localhost:3001/auth/github/callback` (or your production URL)
3. Copy the Client ID and Client Secret to your `.env`

---

## Running

### Development

```bash
# Backend (with hot-reload)
npm run dev

# Dashboard (separate terminal)
cd dashboard && npm run dev
```

### Production

```bash
# Build both backend and dashboard
npm run build
cd dashboard && npm run build && cd ..

# Start
npm start
```

The server starts on the configured `WEBHOOK_PORT` (default 3001) and serves:
- **Dashboard:** `http://localhost:3001`
- **API:** `http://localhost:3001/api`
- **Webhook:** `http://localhost:3001/webhook`
- **Health:** `http://localhost:3001/health`

---

## Dashboard

After logging in with GitHub:

| Page | Description |
|------|-------------|
| **Dashboard** | Overview stats — total runs, issues processed, PRs created, success rate |
| **Runs** | List of all agent runs with status, duration, and rerun capability |
| **Issues** | GitHub issues with the configured label — click Fix or Retry per issue |
| **Settings** | Configure GitHub token, AI provider/key, base branch, notification email |

---

## Project Structure

```
super-agent/
├── src/
│   ├── index.ts                 # Entry point & server bootstrap
│   ├── config.ts                # Environment config defaults
│   ├── server.ts                # Express app factory (session, routes, SPA)
│   ├── socket.ts                # Socket.IO setup for real-time updates
│   ├── agents/
│   │   ├── super-agent.ts       # Orchestrator — manages the full pipeline
│   │   ├── worker-agent.ts      # Analyzes issues & generates code fixes
│   │   └── reviewer-agent.ts    # Reviews changes & creates PRs
│   ├── ai/
│   │   └── ai-engine.ts         # Multi-provider AI (Gemini/OpenAI/Claude/Groq)
│   ├── github/
│   │   └── github-client.ts     # GitHub API wrapper (Octokit)
│   ├── db/
│   │   ├── connection.ts        # MySQL pool
│   │   ├── migrate.ts           # Auto-migrations
│   │   └── schema.sql           # Database schema
│   ├── middleware/
│   │   ├── auth-middleware.ts    # Session-based auth guard
│   │   └── error-handler.ts     # Global error handler
│   ├── repositories/
│   │   ├── issue-repository.ts  # Processed issues data access
│   │   ├── config-repository.ts # Per-user config (encrypted)
│   │   └── user-repository.ts   # User accounts
│   ├── routes/
│   │   ├── auth-routes.ts       # GitHub OAuth flow
│   │   ├── issue-routes.ts      # Issues listing & fix trigger endpoint
│   │   ├── config-routes.ts     # User settings CRUD & connectivity tests
│   │   └── dashboard-routes.ts  # Stats & recent activity
│   ├── services/
│   │   ├── user-config.ts       # Per-user runtime config (DB -> .env -> defaults)
│   │   ├── run-tracker.ts       # DB callbacks for issue/PR tracking
│   │   ├── email-service.ts     # Email notifications (EmailJS)
│   │   └── encryption.ts        # AES-256-GCM encryption for secrets
│   ├── triggers/
│   │   └── webhook-server.ts    # GitHub webhook handler (per-user auth)
│   └── utils/
│       ├── logger.ts            # Structured colored logger
│       ├── retry.ts             # Exponential backoff with jitter
│       └── scheduler.ts         # API polling scheduler
├── dashboard/                   # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── pages/               # Dashboard, Runs, Issues, Config, RunDetail
│   │   ├── components/          # Layout, StatusBadge, StatsCard, Pagination
│   │   ├── hooks/               # useFetch
│   │   └── api/                 # API client with auth redirect
│   └── ...
├── .env.example
├── package.json
└── tsconfig.json
```

---

## How to Use

1. **Log in** to the dashboard with your GitHub account
2. **Configure settings** — add your GitHub token, select an AI provider, and enter the API key
3. **Label an issue** in your repo with `ai-agent` (or your configured label)
4. **Click Fix** on the Issues page, or wait for a webhook trigger
5. A Worker Agent creates a `fix/issue-<N>` branch, analyzes the issue with AI, generates a fix, and commits it
6. A Reviewer Agent diffs the branch, performs an AI code review, and opens a pull request
7. **Review and merge** the PR at your convenience

### Labels used by the agent

| Label | Meaning |
|-------|---------|
| `ai-agent` | Issue is eligible for automated fixing (configurable) |
| `in-progress` | Agent is currently working on the issue |
| `ai-pr-created` | A PR has been created for this issue |

---

## Webhook Setup (Optional)

For auto-triggering when issues are created or labeled:

1. Go to your repo > **Settings** > **Webhooks** > **Add webhook**
2. **Payload URL:** `https://<your-server>/webhook`
3. **Content type:** `application/json`
4. **Secret:** Same value as `WEBHOOK_SECRET` in your `.env` (or configured per-user in dashboard settings)
5. **Events:** Select **Issues**

> **Note:** The webhook handler identifies the sender from the GitHub payload and loads their stored OAuth token and config from the database. The sender must have logged into the dashboard at least once for webhook-triggered runs to work.

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| **TypeScript** | Type-safe backend and frontend |
| **Express** | HTTP server, API routes, session management |
| **React + Vite** | Dashboard frontend |
| **Tailwind CSS** | Dashboard styling |
| **MySQL** | User data, run tracking, encrypted config storage |
| **@octokit/rest** | GitHub REST API client |
| **Google Generative AI** | Gemini AI provider |
| **OpenAI SDK** | OpenAI/Groq AI provider |
| **Anthropic SDK** | Claude AI provider |
| **Socket.IO** | Real-time dashboard updates |
| **express-session** | Session-based authentication |
| **express-mysql-session** | MySQL session store |

---

## Security Notes

- **Never commit your `.env` file** — it's in `.gitignore`
- All sensitive config values (API keys, tokens) are **encrypted with AES-256-GCM** in the database
- Set `ENCRYPTION_KEY` and `SESSION_SECRET` to unique random values
- Use a GitHub fine-grained PAT with only the permissions you need (`repo` scope)
- Always set a `WEBHOOK_SECRET` for production webhook endpoints
- Session cookies are set to `secure: true` when `NODE_ENV=production`

---

## License

MIT
