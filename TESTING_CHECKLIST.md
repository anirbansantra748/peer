# Peer - Testing Checklist ✅

## System Status

### Services Running ✅
- ✅ API Server (port 3001) - Health: OK
- ✅ UI Server (port 3000) - Running
- ✅ Analyzer Worker - Active
- ✅ Autofix Worker - Active
- ✅ MongoDB - Connected
- ✅ Redis/BullMQ - Connected

---

## Completed Features (Tasks 1-9)

### ✅ Task 1: Mode Tooltips
**Location:** `/installations/:id/settings`
- [x] Explanatory tooltips for Mode 0, 1, 2
- [x] User-friendly descriptions

### ✅ Task 2: Status Badges
**Location:** Dashboard & Run Pages
- [x] Visual icons for queued/running/completed/failed
- [x] Color-coded badges
- [x] Severity indicators (Critical, High, Medium, Low)

### ✅ Task 3: Recent Activity Feed
**Location:** Dashboard (`/`)
- [x] Last 10 PR runs displayed
- [x] Repo, PR number, status, timestamp
- [x] Issue counts and fix rates

### ✅ Task 4: Dashboard Stats Cards
**Location:** Dashboard (`/`)
- [x] Total PRs analyzed
- [x] Total issues found
- [x] Issues fixed
- [x] Connected repositories
- [x] Fix rate percentage

### ✅ Task 5: Visual Step Tracker
**Location:** Run detail pages
- [x] Step-by-step progress indicator
- [x] Status-based visual feedback

### ✅ Task 6: Re-run AI Fixes
**Location:** Run detail page
- [x] "Re-run AI fixes" button
- [x] POST endpoint to re-trigger autofix
- [x] Redirects to preview page

### ✅ Task 7: Repo-wise Stats Table
**Location:** Dashboard (`/`) & `/repos`
- [x] Aggregated stats by repository
- [x] PRs count, issues fixed, success rate
- [x] Sortable columns
- [x] Clickable repository cards

### ✅ Task 8: LLM Usage Display
**Location:** Dashboard widget & `/api/llm/usage`
- [x] Total API calls tracked
- [x] Total tokens used
- [x] Primary provider shown
- [x] Live refresh button

### ✅ Task 9: Onboarding Flow
**Location:** `/onboarding`
- [x] 3-step wizard (Connect GitHub → Choose Mode → Done)
- [x] User.onboardingComplete flag
- [x] Auto-redirect for new users
- [x] API endpoints for status & completion

---

## Manual Testing Guide

### 1. Login & Authentication
```
Test: Visit http://localhost:3000
Expected: Redirected to /login if not authenticated
Action: Click "Login with GitHub"
Expected: OAuth flow, redirected to dashboard
```

### 2. Onboarding (New Users)
```
Test: Fresh user visits http://localhost:3000
Expected: Redirected to /onboarding
Step 1: Click "Connect GitHub App"
Step 2: Select mode (Auto-Merge or Manual Review)
Step 3: Click "Go to Dashboard"
Expected: onboardingComplete flag set to true
```

### 3. Dashboard Stats
```
Test: Visit http://localhost:3000
Expected:
- Stats summary bar (Last Updated, Total PRs, Issues Found, Issues Fixed, Fix Rate)
- AI Usage widget (calls, tokens, provider)
- 4 clickable stat cards
- Repository statistics table
- Recent activity feed (last 10 runs)
```

### 4. Repository Overview
```
Test: Click "Total PRs" or "Issues Found" on dashboard
Expected: Navigate to /repos
Shows:
- Summary cards (Total Repos, Total PRs, Total Issues, Issues Fixed)
- Clickable repository cards with stats
- Mode badges (Auto Merge / Manual)
- Last activity timestamp
```

### 5. Repository Details
```
Test: Click on a repository card
Expected: Navigate to /repo/:owner/:repoName
Shows:
- All issues found in that repo
- Issues grouped by PR
- Fixed/Unfixed status
- File names
- Severity levels
```

### 6. PR Details
```
Test: Click "View Details" on a PR in recent activity
Expected: Navigate to /pr/:runId
Shows:
- PR metadata (repo, number, SHA)
- Issue count and fix rate
- Status badge
- List of all findings with:
  - Severity badge
  - File location
  - Description
  - Fixed status
- "Re-run AI fixes" button
```

### 7. Re-run Fixes
```
Test: On PR detail page, click "Re-run AI fixes"
Expected:
- New PatchRequest created
- Autofix job enqueued
- Redirected to preview page
```

### 8. LLM Usage
```
Test: Dashboard AI Usage widget
Action: Click refresh button
Expected:
- Total calls updated
- Total tokens updated
- Primary provider displayed
```

### 9. Installations Management
```
Test: Visit /installations
Expected:
- List of GitHub App installations
- Repository names
- Mode settings
- Edit button for each installation
```

### 10. Installation Settings
```
Test: Click "Edit" on an installation
Expected: Navigate to /installations/:id/settings
Shows:
- Mode selector with tooltips
- Severity checkboxes
- Max files per run input
- Save button
```

---

## API Endpoints Testing

### Health Check
```bash
curl http://localhost:3001/health
# Expected: {"ok":true}
```

### LLM Usage
```bash
curl http://localhost:3001/api/llm/usage
# Expected: {"ok":true,"total":{"calls":N,"tokens":N},"providers":{...},"daily":[...]}
```

### Onboarding Status
```bash
curl -b cookies.txt http://localhost:3000/api/onboarding/status
# Expected: {"hasInstallation":true/false}
```

### Complete Onboarding
```bash
curl -X POST http://localhost:3000/api/onboarding/complete \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"mode":"merge"}'
# Expected: {"ok":true}
```

---

## GitHub Webhook Testing

### Create a Test PR
```
1. Go to a connected repository on GitHub
2. Create a new branch: git checkout -b test-peer-fixes
3. Make a code change with deliberate issues
4. Push and open a PR
5. Watch logs in analyzer worker
```

### Expected Flow
```
1. Webhook received → PRRun created
2. Analyzer worker picks up job
3. Findings generated and saved to PRRun
4. If mode=merge/commit: Autofix triggered automatically
5. Autofix creates preview
6. Autofix applies patch
7. Autofix creates PR or commits directly
8. Dashboard updates with new data
```

### Check Logs
```bash
# Analyzer worker
tail -f analyzer-worker.log

# Autofix worker
tail -f autofix-worker.log

# API server
tail -f api-server.log
```

---

## Database Verification

### MongoDB Collections
```javascript
use peer

// Check users
db.users.find().pretty()

// Check installations
db.installations.find().pretty()

// Check PR runs
db.prruns.find().limit(5).pretty()

// Check patch requests
db.patchrequests.find().limit(5).pretty()

// Check LLM usage
db.llmusage.aggregate([
  {$group: {_id: null, totalCalls: {$sum: "$calls"}, totalTokens: {$sum: "$tokens"}}}
])
```

### Redis/BullMQ Queues
```javascript
// Check queue status via BullBoard (if installed)
// Visit http://localhost:3001/admin/queues

// Or use Redis CLI
redis-cli
KEYS bull:*
```

---

## Known Issues & Fixes Applied

### ✅ Fixed: Import Path Error
**Issue:** `require('../services/github')` doesn't exist
**Fix:** Changed to `require('../services/githubApp')`

### ✅ Fixed: ESM Import Error
**Issue:** `@octokit/app` is ESM-only
**Status:** Using compatible imports

### ✅ Fixed: Duplicate PRRun Inserts
**Issue:** Webhook triggers multiple times
**Fix:** Added duplicate handling in webhook handler

### ✅ Fixed: Route Wildcard Syntax
**Issue:** `/repo/:repoName(*)` invalid syntax
**Fix:** Changed to `/repo/:owner/:repoName`

### ✅ Fixed: URL Encoding
**Issue:** Repo links had `%2F` instead of `/`
**Fix:** Removed `encodeURIComponent` from template

---

## Next Steps (Remaining Tasks)

### Task 10: GitHub Connection Status
- [ ] Add connection status badge to dashboard
- [ ] Show ✅ connected or ❌ not connected
- [ ] Add "Sync repos" button

### Task 11: AI Fix Diff Modal
- [ ] Before/after comparison modal
- [ ] Side-by-side or inline diff view
- [ ] Use `originalText` and `improvedText` from PatchRequest

### Task 12: Retry Webhook Delivery
- [ ] POST `/api/webhooks/:id/retry` endpoint
- [ ] Re-enqueue failed PRRun
- [ ] WebhookLog collection for tracking

### Task 13: Healthcheck & Monitoring
- [ ] Expand `/health` endpoint
- [ ] Check MongoDB, Redis, queue status
- [ ] Add `/api/metrics` for Prometheus

### Task 14: Rate Limiting
- [ ] Install `express-rate-limit`
- [ ] Apply to webhook and API routes
- [ ] Configure per-IP/per-user limits

### Task 15: Dark/Light Theme
- [ ] Add theme toggle button
- [ ] Store preference in localStorage
- [ ] Apply CSS classes conditionally

### Task 16: Help/FAQ Page
- [ ] Create `/help` route
- [ ] Answer common questions
- [ ] Link from dashboard footer

### Task 17: Feedback Form
- [ ] Add "Send Feedback" button
- [ ] POST `/api/feedback` endpoint
- [ ] Email or Discord webhook integration

### Task 18: Responsive Layout
- [ ] Test on mobile (768px)
- [ ] Test on tablet (1024px)
- [ ] Test on desktop (1440px)
- [ ] Fix flex/grid layouts

---

## Performance Benchmarks

### Target Metrics
- Dashboard load time: < 2s
- PR analysis time: < 30s
- Autofix generation: < 60s
- API response time: < 200ms

### Current Status
- [ ] Run performance tests
- [ ] Measure and record metrics
- [ ] Identify bottlenecks
- [ ] Optimize slow queries

---

## Security Checklist

- [x] GitHub OAuth tokens encrypted
- [x] Session cookies httpOnly
- [x] HTTPS in production (via NODE_ENV check)
- [ ] Rate limiting on webhooks
- [ ] CSRF protection
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using Mongoose ORM)
- [ ] XSS prevention (EJS auto-escapes)

---

## Deployment Checklist

### Environment Variables
```bash
# Required
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=
MONGO_URI=
REDIS_URL=
SESSION_SECRET=
ENCRYPTION_KEY=

# Optional
NODE_ENV=production
API_BASE=https://api.yourdom ain.com
UI_BASE=https://yourdomain.com
PORT_API=3001
PORT_UI=3000
```

### Pre-deployment
- [ ] Set all environment variables
- [ ] Test with production MongoDB
- [ ] Test with production Redis
- [ ] Run security audit: `npm audit`
- [ ] Run linting: `npm run lint`
- [ ] Build and test in staging environment

### Post-deployment
- [ ] Verify health endpoints
- [ ] Test GitHub webhook delivery
- [ ] Monitor error logs
- [ ] Check database connections
- [ ] Verify worker processes running

---

## Support & Documentation

### User Documentation
- [ ] Getting Started guide
- [ ] Configuration guide
- [ ] Troubleshooting guide
- [ ] API documentation

### Developer Documentation
- [ ] Architecture overview
- [ ] Database schema
- [ ] API reference
- [ ] Contributing guide

---

## Success Criteria ✅

**System is production-ready when:**
- ✅ All 18 tasks completed
- ✅ All manual tests pass
- ✅ Security checklist complete
- ✅ Performance benchmarks met
- ✅ Documentation complete
- ✅ 24-hour stability test passed

---

**Last Updated:** 2025-10-17
**Tasks Completed:** 9/18 (50%)
**System Status:** Functional, Feature Development In Progress
