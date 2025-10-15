# GitHub OAuth Authentication Setup Guide

## ✅ What's Been Implemented

Step 2: Auth Layer is complete! You now have:

- ✅ GitHub OAuth login
- ✅ User model in MongoDB
- ✅ Session management
- ✅ Protected routes
- ✅ Encrypted token storage

## 🔧 Setup Instructions

### Step 1: Create a GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in the details:
   - **Application name:** `Peer Code Review (Dev)`
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/auth/github/callback`
   - **Description:** `AI-powered code review tool`
4. Click **"Register application"**
5. You'll see your **Client ID** immediately
6. Click **"Generate a new client secret"** to get your **Client Secret**
7. **Copy both values** - you'll need them in the next step

### Step 2: Update Your .env File

Add these new environment variables to your `.env` file:

```bash
# GitHub OAuth (from the app you just created)
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback

# Session & Security
SESSION_SECRET=some_random_string_32_chars_or_more
ENCRYPTION_KEY=another_random_string_32_chars_minimum
NODE_ENV=development
```

**To generate random secrets:**

```bash
# On Windows PowerShell:
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})

# On Mac/Linux:
openssl rand -base64 32
```

### Step 3: Restart the UI Server

```bash
# Stop the UI server (Ctrl+C)
# Then restart:
node services/ui/app.js
```

You should see:
```
[ui] Connected to MongoDB
[ui] listening on 3000
```

### Step 4: Test the OAuth Flow

1. **Open your browser:** http://localhost:3000
   
2. **You should be redirected to:** `/login`
   
3. **Click "Sign in with GitHub"**
   
4. **GitHub will ask for authorization**
   - Review the permissions (email access)
   - Click **"Authorize"**
   
5. **You'll be redirected back to:** `http://localhost:3000`
   
6. **You're now logged in!** 🎉

### Step 5: Verify Authentication

**Check your session:**
```bash
# In browser console (F12):
fetch('/auth/me').then(r => r.json()).then(console.log)
```

You should see your user data:
```json
{
  "id": "...",
  "githubId": "...",
  "username": "your-github-username",
  "displayName": "Your Name",
  "email": "your@email.com",
  "avatar": "https://avatars.githubusercontent.com/...",
  "createdAt": "...",
  "lastLogin": "..."
}
```

**Check MongoDB:**
```bash
mongosh
> use peer
> db.users.find().pretty()
> db.sessions.find().pretty()
```

You should see:
- Your user in the `users` collection (with encrypted accessToken)
- Your session in the `sessions` collection

## 🔐 Security Features

### Access Token Encryption

Your GitHub access token is encrypted using AES-256-GCM before being stored:

```javascript
// Storage (encrypted)
accessToken: "a1b2c3...:d4e5f6...:g7h8i9..."
//            ^IV      ^encrypted ^authTag

// Never stored in plain text
// Can only be decrypted with ENCRYPTION_KEY
```

### Session Security

- **HttpOnly cookies** - JavaScript can't access session cookie
- **7-day expiration** - Session expires after 1 week
- **Secure flag** - HTTPS-only in production
- **MongoDB store** - Sessions persist across server restarts

### Protected Routes

All sensitive routes require authentication:

- `/` - Dashboard (protected)
- `/run` - Manual run page (protected)
- `/runs/:runId/select` - Issue selection (protected)
- `/runs/:runId/preview` - Preview diffs (protected)
- `/runs/:runId/patches/apply` - Apply fixes (protected)

**Public routes:**
- `/login` - Login page
- `/auth/github` - OAuth initiation
- `/auth/github/callback` - OAuth callback

## 🧪 Testing Checklist

- [ ] Can access `/login` page
- [ ] Click "Sign in with GitHub" redirects to GitHub
- [ ] GitHub authorization works
- [ ] Redirected back to app after auth
- [ ] Can access `/` (dashboard) when logged in
- [ ] Cannot access `/` when logged out (redirects to `/login`)
- [ ] `/auth/me` returns user data when logged in
- [ ] `/auth/logout` logs out and redirects to `/login`
- [ ] Session persists after server restart
- [ ] User data visible in MongoDB
- [ ] Access token is encrypted in database

## 🐛 Troubleshooting

### "ENCRYPTION_KEY environment variable is required"

**Problem:** Missing encryption key

**Solution:** Add to `.env`:
```bash
ENCRYPTION_KEY=your_32_char_random_string_here
```

### "GitHub OAuth callback error"

**Problem:** Callback URL mismatch

**Solution:** Ensure these match:
- GitHub OAuth App callback: `http://localhost:3000/auth/github/callback`
- .env GITHUB_CALLBACK_URL: `http://localhost:3000/auth/github/callback`

### "Session store connection error"

**Problem:** MongoDB not running or wrong connection string

**Solution:**
1. Start MongoDB: `mongod` (or `brew services start mongodb-community`)
2. Check MONGO_URI in `.env`: `mongodb://localhost:27017/peer`

### "Cannot GET /" keeps redirecting

**Problem:** Login loop or middleware order issue

**Solution:** 
1. Clear browser cookies
2. Check that `passport.session()` comes AFTER `express-session()`
3. Restart UI server

### "User not found in database after login"

**Problem:** User creation failed

**Solution:** Check UI server logs for errors during OAuth callback

## 📖 How It Works

### Authentication Flow

```
1. User visits /
   ↓
2. requireAuth middleware checks if authenticated
   ↓
3. Not authenticated → redirect to /login
   ↓
4. User clicks "Sign in with GitHub"
   ↓
5. Redirect to GitHub OAuth page
   ↓
6. User authorizes app
   ↓
7. GitHub redirects to /auth/github/callback
   ↓
8. Passport fetches user profile + access token
   ↓
9. User.findOrCreateFromGitHub() creates/updates user
   ↓
10. Access token encrypted and stored
    ↓
11. User ID stored in session
    ↓
12. Redirect to original URL (/)
    ↓
13. requireAuth passes → user can access page
```

### Session Flow

```
Browser                     Server                      MongoDB
  |                           |                            |
  |-- GET / ----------------->|                            |
  |                           |-- Check session cookie --->|
  |                           |<-- Session data -----------|
  |                           |-- Load user by ID -------->|
  |                           |<-- User data --------------|
  |<-- Render page (with user)|                            |
```

## 🎯 Next Steps

Now that authentication is working, you're ready for **Step 3: GitHub App Integration**!

This will add:
- GitHub App installation flow
- Repository access
- Webhook installation
- Per-installation settings

See `GITHUB-APP-SETUP-GUIDE.md` (coming next!)

## 📚 Resources

- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Passport.js Documentation](https://www.passportjs.org/)
- [Express Session Guide](https://github.com/expressjs/session)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
