# Peer (PR Auto Reviewer Platform)

Peer automatically reviews GitHub PRs: runs static analysis and dependency/IaC scans, then uses an LLM to explain issues. Results are stored in MongoDB, surfaced in a simple EJS UI, and can be posted back to GitHub.

---

## What matters (folders and key files)
A quick map of the important pieces and what each does right now.

- services/api/server.js
  - Express API.
  - GET /health → returns { ok: true }.
  - POST /webhook/github → accepts { repo, prNumber, sha }, creates a PRRun in Mongo, enqueues a BullMQ job to the "analyze" queue, responds with { ok, runId }.
  - Uses MONGO_URI and Redis via shared/queue.

- services/analyzer/worker.js
  - BullMQ Worker for queue "analyze".
  - On job: set PRRun.status=running → add a dummy finding → update summary → set status=completed (or failed on error).
  - Uses same Mongo DB.

- shared/queue/index.js
  - Central BullMQ setup.
  - Exports { connection, analyzeQueue, Worker } backed by Redis (REDIS_HOST/REDIS_PORT or REDIS_URL).

- shared/models/PRRun.js
  - Mongoose model.
  - Fields: repo, prNumber, sha, status, findings[], summary{low,medium,high,critical}, timestamps.
  - Unique index on { repo, prNumber, sha }.

- services/ui/app.js
  - Express + EJS placeholder UI (GET / and /run) – will later read from Mongo and show findings.

- infra/docker-compose.yml
  - MongoDB and Redis for local dev.

- package.json
  - Scripts: dev:api, dev:ui, dev:analyzer.

- .env / .env.example
  - MONGO_URI, REDIS_URL or REDIS_HOST/REDIS_PORT, API_PORT (optional), etc.

---

## How it flows (end-to-end)
Plain-language sequence for the current pipeline.

1) GitHub sends PR event (opened/synchronize) → POST /webhook/github.
2) API maps payload to { repo, prNumber, sha } → creates PRRun (status=queued).
3) API enqueues BullMQ job "analyze" → { runId, repo, prNumber, sha }.
4) Analyzer worker picks job → status=running.
5) Analyzer clones repo@sha → detects deps → best-effort `npm audit` → scans IaC files.
6) Worker writes findings + summary → status=completed (or failed).
7) UI (later) reads from Mongo and displays results.

---

## Run locally
- Prereqs: Node 18+, Docker Desktop (for Redis only), MongoDB running locally (no container).
- Start infra (Redis only):
  - npm run dev:infra
- Install deps (from project root):
  - npm install
- Start API:
  - npm run dev:api
- Start Analyzer:
  - npm run dev:worker
- Start UI (optional now):
  - npm run dev:ui

---

## Test it
- POST the webhook locally (use Postman or curl):

```bash path=null start=null
curl -X POST http://localhost:3001/webhook/github \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "test/repo",
    "prNumber": 1,
    "sha": "abc123"
  }'
```

Expected:
- API returns { ok: true, runId }.
- Analyzer logs a job, updates PRRun to completed.
- Mongo will have one PRRun with 1 high-severity dummy finding and summary.high = 1.

Example PRRun document (trimmed):
```json path=null start=null
{
  "repo": "test/repo",
  "prNumber": 1,
  "sha": "abc123",
  "status": "completed",
  "findings": [
    {
      "file": "src/main.js",
      "line": 42,
      "rule": "no-hardcoded-secrets",
      "severity": "high",
      "message": "Potential hardcoded API key detected",
      "source": "static-analysis",
      "suggestion": "Move sensitive data to environment variables or secure configuration"
    }
  ],
  "summary": { "low": 0, "medium": 0, "high": 1, "critical": 0 }
}
```

---

## Environment
- .env (copy from .env.example):
  - MONGO_URI=mongodb://localhost:27017/peer
  - REDIS_URL=redis://localhost:6379 (or REDIS_HOST/REDIS_PORT)
  - API_PORT=3001 (optional)
  - UI_PORT=3000 (optional)
  - GITHUB_WEBHOOK_SECRET= (set if using GitHub webhooks)
  - GITHUB_TOKEN= (set if cloning private repos via https)
  - Do not commit secrets.

---

## Next steps
Short, ordered list of what to do after this is working.

1) API hardening
   - Validate payload better, return consistent errors, add request ids.
   - Optional: idempotency (upsert PRRun on same repo+prNumber+sha).
2) Analyzer real logic
   - Clone PR or fetch changed files; run ESLint/Semgrep; attach real findings.
3) DepScan worker
   - New queue and worker for dependency + IaC scans (npm audit, Checkov).
4) Orchestrator
   - Merge/dedupe findings, assign severities, compute summary.
5) LLM explanations
   - Generate human‑readable explanations and suggestions per finding.
6) UI pages
   - List runs, run details, filters by repo/severity; link to GitHub PR.
7) GitHub integration
   - Verify webhook signature; post PR comments/status checks with summary + link to UI.
8) Packaging
   - Add service containers to docker-compose; healthchecks; prod Dockerfiles.

---

Questions or changes you want? Tell me and I’ll tighten the docs further or add diagrams.
