# 🚀 Quick Start - User API Keys & Token Tracking

## ✅ Implementation Complete!

Your system now tracks token usage per user and supports custom API keys. Here's how to test it.

## 🎯 Quick Test (5 minutes)

### 1. Start the Services
```bash
# Terminal 1: Start UI
cd services/ui
node app.js

# Terminal 2: Start API  
cd services/api
node server.js

# Terminal 3: Start Analyzer
cd services/analyzer
node worker.js

# Terminal 4: Start Autofix
cd services/autofix
node worker.js
```

### 2. Open Dashboard
- Navigate to http://localhost:3000
- Login with your GitHub account
- You should see the **Token Usage Widget** at the top

### 3. Test Token Widget
- The widget shows:
  - Your subscription tier (FREE by default)
  - Tokens used / remaining / limit
  - Progress bar (should be at 0% initially)

### 4. Test API Keys Page
- Click **Settings** dropdown (⚙️ icon) in header
- Click **API Keys**
- Try adding a Groq or Gemini API key
- You should see "✓ API key added successfully"

### 5. Test Subscription Page
- Click **Settings** → **Subscription**
- Click **Upgrade to Pro** button
- Check dashboard → Badge should show "PRO"
- Token limit should be 100,000

### 6. Trigger a Real PR Analysis
- Create a PR in a connected repository
- Watch the logs for:
  ```
  [autofix] User context loaded { userId: ..., hasGroqKey: true/false }
  ```
- After completion, refresh dashboard
- Token usage should increase

## 📊 What to Look For

### Dashboard Widget (Real-time)
```
🎯 Your Token Usage
[FREE] or [PRO] or [ENTERPRISE]

Progress Bar: ████░░░░░░ 35%

Tokens Used: 350
Remaining: 650
Total Limit: 1,000
```

### With User API Keys
If user adds their own keys, you'll see:
```
Token Usage: Using own API keys
No platform tokens consumed
```

### When Limit is Reached
```
⚠️ You're running low on tokens! 
Add your API keys or upgrade your plan
```

## 🧪 Manual Testing Scenarios

### Scenario A: Free User Journey
1. Start with fresh user (0 tokens used)
2. Trigger PR analysis
3. Check dashboard → Tokens increased
4. Repeat until ~900/1000 tokens
5. Next PR should show warning
6. At 1000+ should fail

### Scenario B: Own API Keys
1. Go to Settings → API Keys
2. Add Groq key: `gsk_your_key_here`
3. Trigger PR analysis
4. Check logs for "userKey: true"
5. Dashboard shows "Using own keys"
6. Platform tokens NOT consumed

### Scenario C: Upgrade Flow
1. Start as Free (1,000 limit)
2. Use 500 tokens
3. Go to Settings → Subscription
4. Click "Upgrade to Pro"
5. Check dashboard:
   - Badge shows "PRO"
   - Limit is 100,000
   - Used resets to 0

## 🔍 Where to Check

### MongoDB
```javascript
// Check user's token usage
db.users.findOne({ username: "yourname" }, { 
  tokensUsed: 1, 
  tokenLimit: 1, 
  subscriptionTier: 1,
  apiKeys: 1 
})

// Should show:
{
  tokensUsed: 350,
  tokenLimit: 1000,
  subscriptionTier: "free",
  apiKeys: {
    groq: "encrypted_string_here" // if added
  }
}
```

### Logs to Monitor
```bash
# Look for these in autofix worker logs:
[autofix] User context loaded
[autofix] hasGroqKey: true
[autofix] tokenLimit: 1000
[autofix] tokensUsed: 350

# Look for in LLM logs:
[LLM][Groq] success { userKey: true, tokens: 250 }
[UserTokens] Incremented tokens { userId: ..., tokens: 250 }
```

### API Endpoint Test
```bash
# Get user usage stats
curl -X GET http://localhost:3000/api/user/usage \
  -H "Cookie: connect.sid=your_session_cookie"

# Should return:
{
  "ok": true,
  "tokensUsed": 350,
  "tokenLimit": 1000,
  "percentage": 35,
  "remaining": 650,
  "subscriptionTier": "free",
  "hasOwnKeys": false,
  "unlimited": false
}
```

## 🐛 Common Issues & Fixes

### Widget Shows 0/0
**Cause:** User document not loading
**Fix:** Check authentication, refresh page

### Keys Not Working
**Cause:** Encryption key missing
**Fix:** Ensure `ENCRYPTION_KEY` in `.env`

### Tokens Not Tracking
**Cause:** userId not in PatchRequest
**Fix:** Check Installation has userId field

### LLM Using Wrong Keys
**Cause:** userContext not passed
**Fix:** Check buildPreview() passes userContext

## 📝 Environment Check

Make sure these are set:
```env
# In .env file
ENCRYPTION_KEY=9o52LGnP0bYCeSzxywfhBE4a7sIvXHZQ
GROQ_API_KEY=your_platform_key
GEMINI_API_KEY=your_platform_key
MONGO_URI=mongodb://localhost:27017/peer
```

## ✨ Success Indicators

You'll know it's working when:

1. ✅ Dashboard shows token widget with real numbers
2. ✅ Settings pages load without errors
3. ✅ Can add/remove API keys successfully
4. ✅ Can upgrade/downgrade subscription
5. ✅ PR analysis logs show "User context loaded"
6. ✅ Token usage increments after LLM calls
7. ✅ User API keys are used when present
8. ✅ System blocks when limit exceeded

## 🎉 Ready to Go!

Everything is implemented and ready. Just:
1. Start all services
2. Open dashboard
3. Try the Settings pages
4. Trigger a PR to see it in action

For detailed implementation docs, see:
- [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)
- [USER_API_KEYS_INTEGRATION.md](./USER_API_KEYS_INTEGRATION.md)

---

**Questions?** Check the troubleshooting section in IMPLEMENTATION_COMPLETE.md
