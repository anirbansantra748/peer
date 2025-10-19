# User API Keys & Token Tracking - Full Integration

## ✅ COMPLETED

### 1. Token Tracking Utility (`shared/utils/userTokens.js`)
- Created utility functions for per-user token management
- `checkUserTokenLimit(user, estimatedTokens)` - Check if user can make request
- `incrementUserTokens(userId, tokens)` - Track usage after LLM call
- `getUserApiKeys(user)` - Decrypt and return user's API keys
- `getUserTokenStats(userId)` - Get current usage stats
- `resetUserTokens(userId)` - Reset usage (billing period)

### 2. LLM Functions Updated (`shared/llm/rewrite.js`)
- Modified `callGroq({ system, user, userApiKey })` to accept user API keys
- Modified `callGemini({ system, user, userApiKey })` to accept user API keys
- Both functions now return `tokens` count in response
- Modified `rewriteFileWithAI({ file, code, findings, userContext })` to:
  - Accept user context parameter
  - Extract user API keys if available
  - Pass user keys to LLM providers
  - Track token usage after each call (only if using platform keys)

### 3. Dashboard Token Widget (`services/ui/views/index.ejs`)
- Added beautiful token usage card showing:
  - Subscription tier badge (Free/Pro/Enterprise)
  - Progress bar with color coding (green/orange/red)
  - Tokens used, remaining, and total limit
  - Warning message when approaching limit
- Auto-refreshes on page load
- Updates when user upgrades subscription

### 4. User Usage API (`services/ui/app.js`)
- Added `GET /api/user/usage` endpoint
- Returns user's token statistics
- Includes subscription info and API key status

## 🔴 REMAINING TASKS

### Critical: Link User Context to LLM Calls

The system now supports user API keys and token tracking, but we need to pass the user context through the autofix pipeline.

#### Problem
The autofix engine (`shared/autofix/engine.js`) calls `rewriteFileWithAI()` but doesn't have access to user context. The call chain is:

```
webhook → PRRun created → autofixQueue.add('preview') → 
autofixWorker → buildPreview() → rewriteFileWithAI()
```

#### Solution

**Option A: Store userId in PatchRequest (RECOMMENDED)**

1. Update `PatchRequest` model to include `userId`:
```javascript
// shared/models/PatchRequest.js
const patchRequestSchema = new mongoose.Schema({
  // ... existing fields
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }
});
```

2. When creating PatchRequest, find and store userId:
```javascript
// Find userId from Installation (via PRRun)
const run = await PRRun.findById(runId);
const installation = await Installation.findById(run.installationId);
const userId = installation.userId;

// Create PatchRequest with userId
const patchRequest = await PatchRequest.create({
  runId,
  repo,
  sha,
  selectedFindingIds,
  userId, // <-- ADD THIS
  // ... other fields
});
```

3. Update `buildPreview()` in `shared/autofix/engine.js`:
```javascript
async function buildPreview(patchRequestId) {
  const patch = await PatchRequest.findById(patchRequestId);
  const prRun = await PRRun.findById(patch.runId);
  
  // Load user context
  const User = require('../models/User');
  const userContext = patch.userId ? await User.findById(patch.userId) : null;
  
  // Check token limit before starting
  if (userContext) {
    const { checkUserTokenLimit } = require('../utils/userTokens');
    const check = await checkUserTokenLimit(userContext, 2000); // Estimate
    if (!check.allowed) {
      patch.status = 'failed';
      patch.error = check.reason;
      await patch.save();
      throw new Error(check.reason);
    }
  }
  
  // ... existing cloning and processing code ...
  
  // When calling LLM:
  const improved = await rewriteFileWithAI({ 
    file, 
    code: currentText, 
    findings: relatedFindings,
    userContext  // <-- PASS USER CONTEXT
  });
  
  // Token tracking is handled inside rewriteFileWithAI
}
```

**Option B: Pass userId in job data**

Alternatively, pass userId through the queue job:
```javascript
// When adding to queue
await autofixQueue.add('preview', { 
  patchRequestId,
  userId: installation.userId 
});

// In worker
async (job) => {
  const { patchRequestId, userId } = job.data;
  const userContext = userId ? await User.findById(userId) : null;
  // Pass to buildPreview
}
```

### Where to Make Changes

#### 1. Find where PatchRequest is created
```bash
grep -r "PatchRequest.create\|new PatchRequest" services/
```

Look for the file that creates patch requests (likely in `services/api/` or webhook handler).

#### 2. Update PatchRequest model
Add `userId` field to schema in `shared/models/PatchRequest.js`

#### 3. Link userId when creating patches
When a PR webhook comes in:
- PRRun is created (already has installationId)
- Installation has userId
- PatchRequest should store userId from Installation

#### 4. Update buildPreview() and buildPreviewForSingleFile()
In `shared/autofix/engine.js`:
- Load User document using userId from PatchRequest
- Pass `userContext` to all `rewriteFileWithAI()` calls
- Add token limit check at start

## Testing Checklist

### User API Keys
- [ ] User adds Groq API key → Key encrypted and saved
- [ ] User adds Gemini API key → Key encrypted and saved  
- [ ] System detects user has own keys → Uses them instead of platform keys
- [ ] LLM calls succeed with user's keys
- [ ] Token usage NOT tracked when using user's keys

### Token Tracking
- [ ] Free user makes LLM call → tokensUsed increments
- [ ] Free user reaches limit → Further calls blocked with error
- [ ] Pro user makes LLM call → tokensUsed increments (higher limit)
- [ ] Enterprise user has unlimited → No blocking

### Dashboard Widget
- [ ] Widget shows correct token usage
- [ ] Progress bar color changes (green → orange → red)
- [ ] Subscription badge shows correct tier
- [ ] Warning appears at 90% usage
- [ ] After upgrade → Stats update correctly

### Subscription Upgrades
- [ ] Upgrade to Pro → tokenLimit = 100,000, tokensUsed = 0
- [ ] Upgrade to Enterprise → tokenLimit = -1 (unlimited)
- [ ] Downgrade to Free → tokenLimit = 1,000, tokensUsed capped

## Current State

✅ Infrastructure is ready:
- User token tracking functions
- LLM functions accept user keys
- Dashboard shows usage
- API endpoint for stats

🔴 Missing link:
- Need to pass user context from webhook → autofix engine → LLM calls
- Requires updating PatchRequest model and creation logic

## Next Steps

1. **Find PatchRequest creation point** (services/api or webhook handler)
2. **Add userId to PatchRequest model**
3. **Update buildPreview() to load and pass user context**
4. **Test end-to-end** with real PR

## Files Modified

✅ Created:
- `shared/utils/userTokens.js` - Token management utilities

✅ Modified:
- `shared/llm/rewrite.js` - Accept user API keys, track tokens
- `services/ui/app.js` - API keys routes, subscription routes, usage API
- `services/ui/views/index.ejs` - Token usage widget
- `services/ui/views/api-keys.ejs` - Already existed
- `services/ui/views/subscription.ejs` - Already existed

🔴 Need to modify:
- `shared/models/PatchRequest.js` - Add userId field
- `shared/autofix/engine.js` - Pass user context to LLM
- Where PatchRequest is created - Store userId
