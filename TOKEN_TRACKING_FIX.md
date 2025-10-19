# Token Tracking Fix - Dashboard Not Showing Token Usage

## Problem
Users reported that although LLM calls were being processed and tokens were being consumed (visible in logs), the dashboard was not reflecting the token usage. The token usage widget showed static values that never increased.

## Root Cause Analysis

### 1. Missing Token Tracking for Some Providers
The `incrementUserTokens` function was only being called for **Groq** and **Gemini** providers, but NOT for:
- DeepSeek
- OpenAI
- OpenRouter

This meant that if you were using any of these providers, token usage would never be tracked.

### 2. Incomplete Token Response Objects
Some LLM provider functions weren't returning `tokens` in their response objects:
- `callOpenAI` - was missing `tokens`, `provider`, and `responseTime`
- `callDeepSeek` - was missing `tokens` in return object
- `callOpenRouter` - was missing `tokens` in return object

### 3. Missing User Context Propagation
In the smart routing fallback paths (lines 400-530 in rewrite.js), token tracking was missing even when `userContext` was available.

## Changes Made

### 1. Enhanced All LLM Provider Functions (`shared/llm/rewrite.js`)

#### OpenAI Provider
- Added `startTime` tracking
- Added `tokens` extraction from API response
- Added `responseTime` calculation
- Added debug logging
- Return object now includes: `text`, `modelUsed`, `provider`, `responseTime`, `tokens`

#### DeepSeek Provider
- Added `tokens` extraction from API response
- Return object now includes `tokens` field

#### OpenRouter Provider
- Return object now includes `tokens` field (was already extracted but not returned)

### 2. Added Token Tracking for All Providers

Added `incrementUserTokens` calls after EVERY LLM call across all code paths:

**Manual Provider Override Paths (lines 337-401):**
- DeepSeek manual override
- OpenRouter manual override
- OpenAI manual override

**Smart Routing - Simple Complexity Path (lines 400-470):**
- OpenRouter fallback
- DeepSeek fallback

**Smart Routing - Complex Complexity Path (lines 437-530):**
- DeepSeek primary
- Gemini fallback (fixed to pass userApiKey)
- Groq fallback (fixed to pass userApiKey)
- OpenRouter fallback

### 3. Enhanced Debug Logging

Added comprehensive logging in `shared/utils/userTokens.js`:
- Log when token increment is skipped (invalid userId or tokens)
- Log before incrementing tokens
- Log after successful increment with new totals
- Log failures with error details

## How Token Tracking Now Works

1. **LLM Call Made**: Any LLM provider (Groq, Gemini, DeepSeek, OpenAI, OpenRouter) processes a request
2. **Tokens Counted**: Provider API returns token usage in response
3. **User Context Check**: If `userContext` is available (passed from engine.js)
4. **API Key Check**: 
   - If user has their own API keys → tokens NOT tracked (they use their own)
   - If using platform keys → tokens ARE tracked
5. **Increment Call**: `incrementUserTokens(userId, tokenCount)` is called
6. **Database Update**: MongoDB User document's `tokensUsed` field is incremented
7. **Dashboard Reflects**: Next dashboard load shows updated usage via `/api/user/usage` endpoint

## Testing the Fix

### 1. Enable Debug Logging
Set in your `.env`:
```
LLM_DEBUG=1
```

### 2. Trigger a PR Analysis
- Create or update a pull request in a connected repository
- Monitor the autofix worker logs

### 3. Look for These Log Messages
```
[LLM][Groq] success { model: 'llama-3.3-70b-versatile', responseTime: '1234ms', tokens: 1500 }
[UserTokens] Incrementing tokens: { userId: '507f1f77bcf86cd799439011', tokens: 1500 }
[UserTokens] Tokens incremented successfully: { userId: '507f1f77bcf86cd799439011', tokensAdded: 1500, newTotal: 3250, limit: 100000 }
```

### 4. Check Dashboard
- Navigate to the dashboard at `http://localhost:3000/`
- The "🤖 AI Usage" widget should now show updated token counts
- Refresh the page to see the latest stats

## Verification Steps

1. **Check Current Token Usage**
   ```javascript
   // In MongoDB or via API
   db.users.findOne({ githubUsername: "yourUsername" }, { tokensUsed: 1, tokenLimit: 1 })
   ```

2. **Trigger an AI Fix**
   - Create a PR with some code issues
   - Let the analyzer process it
   - Review the autofix preview

3. **Verify Token Increment**
   - Check logs for `[UserTokens] Tokens incremented successfully`
   - Refresh dashboard and verify the widget shows increased usage
   - Query database to confirm `tokensUsed` field was updated

## API Endpoint for Token Usage

The dashboard uses this endpoint to fetch token stats:

**Endpoint**: `GET /api/user/usage`

**Response**:
```json
{
  "ok": true,
  "tokensUsed": 3250,
  "tokenLimit": 100000,
  "percentage": 3,
  "remaining": 96750,
  "subscriptionTier": "pro",
  "hasOwnKeys": false,
  "unlimited": false
}
```

## Known Limitations

1. **Cached Results**: If an LLM response is served from cache, tokens = 0 (correct behavior, no API call made)
2. **User API Keys**: When users provide their own Groq/Gemini keys, platform doesn't track their usage (expected)
3. **Minimal Strategy**: Uses token estimation for patch planning, actual tokens may vary slightly

## Related Files Modified

1. `shared/llm/rewrite.js` - Enhanced all provider functions and added token tracking
2. `shared/utils/userTokens.js` - Added debug logging to increment function
3. `shared/autofix/engine.js` - Already correctly passes userContext (no changes needed)

## Next Steps

If token usage is still not showing:
1. Check MongoDB connection - ensure User model is accessible
2. Verify userId is correctly passed from PatchRequest to engine
3. Check if LLM provider is actually being called (not all cached)
4. Review browser console for errors when fetching `/api/user/usage`
5. Verify the dashboard widget JavaScript is polling the endpoint
