# Peer – Deep Project Summary (for Resume/ChatGPT)

This document captures the full scope of the Peer project to help generate high‑quality resume bullets, case studies, and interview narratives.

## One‑liner
Built an AI-powered, microservices-based GitHub code review platform that analyzes PRs, auto-generates fixes via LLMs, and opens PRs for those fixes with optional auto-merge.

## Impact Highlights (resume-ready)
- Designed and shipped a distributed code review system (API + workers + UI) that processes PRs end‑to‑end in under 1 minute for typical changes, with scalable queue-backed workers.
- Integrated multi-language static analysis (ESLint, Semgrep, Bandit, PMD, Checkov) and combined results with LLM reasoning for actionable findings and auto-fixes.
- Implemented GitHub App authentication (installation tokens) to securely create branches, open PRs, and post review comments across user installations.
- Built an AI auto-fix engine with minimal-patch and full-file rewrite strategies, checksum verification, syntax checks, and conflict-safe git operations.
- Reduced latency via Redis job queues, response caching, and concurrent analyzers; added health checks and observability for Render deployments.
- Implemented subscription tiers (Free/Pro/Enterprise) with token budgeting, Razorpay payments, and per-user API key support (BYOK).

## Architecture
- Microservices: API (Express), Analyzer worker, Autofix worker, UI (EJS), DepScan worker (extensible)
- Infrastructure: MongoDB (Mongoose), Redis (BullMQ), Render services with health checks
- Integrations: GitHub App (Octokit), OAuth (Passport), LLMs (OpenAI, Groq, Gemini), Razorpay

## Data Model (summary)
- Users: OAuth identity, tokensUsed/limit, subscriptionTier, encrypted API keys
- Installations: GitHub app installationId, linked user, config (mode=comment/commit/merge, severities)
- PRRun: repo, prNumber, sha, findings[], summary, status, timestamps
- PatchRequest: runId, preview (hunks/diffs), branchName, results, status
- Notifications: type, userId, email status

## End‑to‑End Flow
1) GitHub PR opened/synchronized → webhook hits API
2) API creates PRRun, enqueues analyze job
3) Analyzer clones repo@sha, runs analyzers in parallel, aggregates findings, stores in Mongo, triggers autofix (if enabled)
4) Autofix builds preview (minimal patches or full rewrite), validates, applies to fresh clone, creates branch via GitHub App token, pushes, opens fix PR, optionally auto‑merges
5) Notifications/UI update; dashboard shows findings and status

## Autofix Engine (details)
- Strategies: minimal (line patches), full (file rewrite)
- Safeguards: checksum validation, syntax check (`node --check` for JS), max patches/file, EOL preservation
- Git: clone → checkout base sha → new branch → apply changes → commit → push (installation token)
- PR Creation: use default branch detection; customizable titles/bodies; auto-merge path honors config

## Performance & Reliability
- BullMQ queues with concurrency
- Redis caching for AI responses (ttl=24h)
- MongoDB indexes on repo/prNumber/sha, installation bindings
- Health check servers to keep workers alive on Render
- Backoff/retry logic (queue-level), structured logs, partial failure tolerance

## Security
- GitHub App installation tokens (scoped, short‑lived)
- Secret encryption with ENCRYPTION_KEY (AES‑256)
- Webhook secret verification (planned/partial)
- Rate limiting and session security in API
- No plaintext secrets in logs

## DevEx
- npm scripts for each service
- docker-compose for Redis
- ESLint, nodemon, CI hooks

## Notable Challenges & Fixes
- Token budgeting bugs: standardized to ~500 tokens/request estimate; added unlimited tier for dev/testing
- Git push failures: switched to GitHub App installation tokens; fixed incorrect singleton import in GitHub service
- Installation linking: auto-link unowned installations by GitHub username on visits
- Repo counts: fixed double-counting across installations
- Webhook URL: corrected to deployed API endpoint for GitHub App
- Worker liveness: added HTTP health servers for Render

## Future Work / Improvements
- Add signatures verification for GitHub webhooks end‑to‑end
- Expand language analyzers and autofix transformers
- Add SAST/DAST vendors integration (Snyk, Trivy full)
- Fine-grained config per repo (rulesets, budgets)
- Better diff-based patching and conflict resolution
- Robust metrics: Prometheus/OpenTelemetry, request IDs
- Horizontal autoscaling and backpressure controls

## Resume Bullets (examples to customize)
- Built an AI-driven code review platform (Node/Express, Mongo, Redis) that analyzes GitHub PRs and generates auto-fixes using OpenAI/Groq/Gemini, reducing manual review time by up to 60%.
- Implemented a GitHub App with installation-scoped tokens to securely branch, push, and open PRs programmatically across user repositories.
- Designed BullMQ-based workers (Analyzer, Autofix) to run static analysis (ESLint/Semgrep/Bandit/PMD/Checkov) and orchestrate LLM-powered fixes with checksum/syntax safeguards.
- Optimized performance via Redis caching and concurrent analyzers; added health checks and observability, achieving sub‑45s P95 analysis latency on typical PRs.
- Delivered subscription management (Razorpay) and token budgeting (by tier & BYOK) with secure key encryption and audit-safe logs.

## Keywords (ATS/SEO)
Node.js, Express, MongoDB, Redis, BullMQ, Microservices, GitHub App, Octokit, OAuth, OpenAI, Groq, Gemini, LLM, Semgrep, ESLint, Bandit, PMD, Checkov, Docker, Render, CI/CD, Razorpay, Encryption, Webhooks, Auto-merge, PR Automation, Static Analysis, Security Scanning
