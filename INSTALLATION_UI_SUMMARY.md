# GitHub App Installation UI - Implementation Summary

## ✅ Completed Features

### 1. **Installation List Page** (`/installations`)
- Displays all active GitHub App installations
- Shows installation details:
  - Account name and type
  - Installation status (active/suspended)
  - Repository selection mode (all repos or selected)
  - Number of repositories
- Current configuration display:
  - Processing mode (analyze/commit/merge)
  - Severity levels (critical/high/medium/low)
  - Max files per run
  - Auto-merge settings
- Repository list:
  - Shows first 5 repos with details
  - Displays private/public status
  - Links to GitHub repositories
- Empty state for users with no installations
- Navigation links to install more repositories

### 2. **Settings Page** (`/installations/:id/settings`)
- Comprehensive configuration form with sections:

#### **Processing Mode**
- Analyze Only: Just analyze and comment (recommended)
- Commit Fixes: Auto-create commits with fixes
- Auto-Merge: Automatically merge approved PRs (dangerous)

#### **Severity Levels**
- Checkbox selection for: Critical, High, Medium, Low
- Visual badges with color coding
- At least one must be selected (defaults to critical + high)

#### **Performance Limits**
- Max Files Per Run (1-50)
- Configurable per installation

#### **Auto-Merge Settings**
- Enable/disable auto-merge
- Require tests to pass
- Required number of approvals (0-10)
- Warning about dangerous features

### 3. **Backend Routes**
- `GET /installations` - List all active installations
- `GET /installations/:id/settings` - View settings form
- `POST /installations/:id/settings` - Save configuration changes

### 4. **Integration with PR Workflow**
- PR webhook handler checks installation before processing
- Returns 403 if app not installed on repository
- Applies installation config during analysis:
  - Filters findings by configured severity levels
  - Stores installationId reference in PRRun
- Analyzer worker uses installation config:
  - Loads config at job start
  - Filters findings before saving to database

## 📁 Files Created/Modified

### Created:
1. `services/ui/views/installations.ejs` - Installation list page
2. `services/ui/views/settings.ejs` - Settings configuration page
3. `services/api/routes/githubAppWebhooks.js` - GitHub App webhook handler
4. `shared/models/Installation.js` - Installation MongoDB model
5. `shared/services/githubApp.js` - GitHub App API service

### Modified:
1. `services/ui/app.js` - Added installation routes
2. `services/ui/views/index.ejs` - Added installations link
3. `services/api/server.js` - Integrated installation lookup in PR webhook
4. `services/analyzer/worker.js` - Apply installation config during analysis
5. `shared/models/PRRun.js` - Added installationId field
6. `.env` - Added GITHUB_APP_WEBHOOK_SECRET

## 🎨 UI Design

- **Theme**: GitHub dark theme (matching GitHub's UI)
- **Colors**: 
  - Background: `#0d1117`
  - Cards: `#161b22`
  - Borders: `#30363d`
  - Primary: `#58a6ff` (GitHub blue)
  - Success: `#238636` (GitHub green)
- **Responsive**: Works on desktop and mobile
- **Interactive**: Hover states, transitions, visual feedback

## 🔐 Security

- All routes protected with `requireAuth` middleware
- Webhook signature verification using HMAC SHA-256
- No secrets exposed in client-side code
- Installation config stored securely in MongoDB

## 🚀 How to Use

### 1. **Start Services**
```bash
# API Server
npm run api

# UI Server
npm run ui

# Analyzer Worker
npm run analyzer

# ngrok (for webhooks)
ngrok http 3001
```

### 2. **Create GitHub App**
- Go to: https://github.com/settings/apps/new
- Webhook URL: `https://YOUR-NGROK-URL.ngrok.io/webhook/github-app`
- Webhook secret: Value from `.env` → `GITHUB_APP_WEBHOOK_SECRET`
- Permissions: Pull requests (read/write), Contents (read/write)
- Events: Installation, Pull request

### 3. **Install App**
- Install app on repositories
- Installation automatically saved to database
- View in UI at `/installations`

### 4. **Configure**
- Go to `/installations`
- Click "Configure" on any installation
- Adjust settings:
  - Choose processing mode
  - Select severity levels
  - Set performance limits
  - Configure auto-merge (if needed)
- Save configuration

### 5. **Test PR Workflow**
- Open a PR on installed repository
- Webhook triggers analysis
- Installation config applied automatically
- Only configured severities shown in results

## 🔄 Data Flow

```
PR Opened
  ↓
Webhook → /webhook/github
  ↓
Look up Installation (by repo)
  ↓
Validate repository access
  ↓
Create PRRun (with installationId)
  ↓
Enqueue analysis job
  ↓
Worker loads installation config
  ↓
Run analysis
  ↓
Filter findings by severities
  ↓
Save to database
```

## 📝 Configuration Options

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Mode | analyze, commit, merge | analyze | How to process PRs |
| Severities | critical, high, medium, low | critical, high | Which issues to report |
| Max Files | 1-50 | 10 | Files to analyze per run |
| Auto-Merge | enabled/disabled | disabled | Auto-merge PRs |
| Require Tests | yes/no | yes | Tests must pass to merge |
| Required Approvals | 0-10 | 0 | Approvals needed to merge |

## 🎯 Next Steps (Optional Enhancements)

1. **User Authentication Integration**
   - Link installations to logged-in users
   - Filter installations by userId
   - User-specific API keys

2. **Per-Repository Settings**
   - Override installation config for specific repos
   - Repository-level rules and exclusions

3. **Webhook Logs**
   - View webhook delivery history
   - Debug failed webhooks
   - Replay webhooks

4. **Analytics Dashboard**
   - PR analysis statistics
   - Finding trends over time
   - Most common issues by repo

5. **Notifications**
   - Email/Slack alerts for critical findings
   - Weekly summary reports
   - Installation health monitoring

## ✅ Testing Checklist

- [x] Install GitHub App
- [x] Webhook received and saved to DB
- [x] View installations page
- [x] Configure installation settings
- [x] Save settings successfully
- [x] Open PR triggers analysis
- [x] Installation config applied
- [x] Findings filtered by severity
- [ ] Test all three modes (analyze/commit/merge)
- [ ] Test with multiple installations
- [ ] Test repository add/remove
- [ ] Test installation suspend/unsuspend

## 🐛 Known Issues

None currently. Ready for testing!

## 📚 Documentation

For more details, see:
- Installation Model: `shared/models/Installation.js`
- Webhook Handler: `services/api/routes/githubAppWebhooks.js`
- GitHub App Service: `shared/services/githubApp.js`
