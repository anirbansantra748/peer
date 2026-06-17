# Peer

An AI-powered code review platform that plugs into your GitHub workflow. Install it as a GitHub App, connect your repos, and every PR you open gets automatically analyzed for bugs, security vulnerabilities, and code quality issues — with optional auto-fixes committed directly to your branch.

**[Live Demo](https://peer-ui.onrender.com)** · **[GitHub](https://github.com/anirbansantra748/peer)**

---

## What it does

- Listens to PR events via GitHub webhooks in real time
- Clones the repo, runs static analysis (ESLint, Semgrep, Bandit), and categorizes findings by severity
- Uses LLMs (Gemini, Groq, GPT-4) to verify findings and cut down false positives
- Can push auto-fix commits directly to the PR branch
- Can auto-merge PRs if all safeguards pass (CI tests green + required approvals met)
- Logs every analysis, fix attempt, and token used — full audit trail in the dashboard
- Sends email notifications, PR comments, and weekly digests

---

## Processing modes

Three levels of automation — you choose per repo:

| Mode | What happens |
|------|-------------|
| **Review Mode** | Peer analyzes and reports. You pick what to fix. |
| **Auto-Commit** | Peer generates fixes and commits them to the PR. Doesn't merge. |
| **Full Auto-Merge** | Peer fixes + merges if CI passes and approval requirements are met. |

---

## Severity levels

- 🔴 **Critical** — security vulnerabilities, potential data loss
- 🟡 **High** — major bugs, performance issues
- 🔵 **Medium** — maintainability, code quality
- ⚪ **Low** — style violations, minor suggestions

You can filter which levels Peer acts on per installation.

---

## Tech Stack

| Layer | What's used |
|-------|-------------|
| Frontend | Express.js + EJS (server-side rendering) |
| Queue | Redis + BullMQ (async job processing) |
| Database | MongoDB |
| AI | Gemini, Groq, GPT-4 via LangChain |
| Vector DB | Qdrant |
| GitHub Integration | Octokit (GitHub App + REST API) |
| Auth | Passport.js (GitHub OAuth) |
| Notifications | Nodemailer |
| Hosting | Render.com (Dockerized microservices) |

---

## Architecture

Peer is built as a set of microservices, each running independently and communicating via a shared Redis queue:

```
services/
├── ui/           # Web dashboard (Express + EJS)
├── api/          # REST API, webhook handler
├── analyzer/     # Static analysis worker (ESLint, Semgrep, Bandit)
├── autofix/      # Auto-fix worker (LLM-generated patches)
├── depscan/      # Dependency vulnerability scanner
├── llm/          # Shared LLM service (LangChain)
└── orchestrator/ # Job coordination and state management
```

When a PR is opened:
1. GitHub sends a webhook → `api` service
2. `api` queues an analysis job in Redis (BullMQ)
3. `analyzer` picks it up, clones the repo, runs static analysis
4. `llm` service verifies findings with AI
5. Results are stored in MongoDB, shown in the dashboard
6. If auto-fix is enabled, `autofix` worker generates patches and commits them

---

## Getting started (as a user)

1. Go to [peer-ui.onrender.com](https://peer-ui.onrender.com)
2. Sign in with GitHub (OAuth — we never see your password)
3. Click **"Add More Repositories"** and select which repos Peer can access
4. Click **"Configure"** on any installation to set your mode and filters
5. Open a PR — Peer picks it up automatically

---

## Running locally (self-host)

Requirements: Node.js, Docker (for Redis)

```bash
git clone https://github.com/anirbansantra748/peer.git
cd peer
npm install

# Start Redis
npm run dev:infra

# Start services (separate terminals)
npm run dev:api
npm run dev:analyzer
npm run dev:autofix
npm run dev:ui
```

Copy `.env.example` to `.env` and fill in:

```env
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=
MONGODB_URI=
REDIS_URL=
GEMINI_API_KEY=
GROQ_API_KEY=
SESSION_SECRET=
```

---

## Security

- Repos are cloned ephemerally — deleted immediately after analysis
- All API keys and tokens encrypted at rest (AES-256)
- GitHub App uses minimum required permissions only

---

Made by [Anirban Santra](https://powerful-raven.static.domains/)
