# 🚀 Complete Deployment Guide for Render

This guide will walk you through deploying your Peer Code Review application to Render step-by-step.

---

## 📋 Prerequisites Checklist

Before starting, make sure you have:

- ✅ GitHub account
- ✅ Render account (sign up at https://render.com)
- ✅ MongoDB Atlas account (free tier)
- ✅ Upstash Redis account (free tier)
- ✅ All your GitHub App credentials ready
- ✅ Razorpay API keys
- ✅ AI API keys (Groq/Gemini/OpenRouter)

---

## 🗂️ Step 1: Prepare External Services

### 1.1 MongoDB Atlas (Free Tier - Database)

1. **Go to** https://www.mongodb.com/cloud/atlas/register
2. **Sign up/Login**
3. **Create a new cluster:**
   - Click "Build a Database"
   - Choose **FREE** M0 tier
   - Select **Singapore** region (closest to Render)
   - Click "Create"
4. **Create Database User:**
   - Go to "Database Access"
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Username: `peer_admin`
   - Password: Generate a strong password (save it!)
   - Database User Privileges: **Atlas admin**
   - Click "Add User"
5. **Whitelist IP Addresses:**
   - Go to "Network Access"
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"
6. **Get Connection String:**
   - Go to "Database" → Click "Connect"
   - Choose "Connect your application"
   - Copy the connection string:
     ```
     mongodb+srv://peer_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<password>` with your actual password
   - Replace `/?retryWrites` with `/peer?retryWrites` (add database name)
   - **Save this connection string!**

### 1.2 Upstash Redis (Free Tier - Queue/Cache)

1. **Go to** https://upstash.com
2. **Sign up/Login**
3. **Create Redis Database:**
   - Click "Create Database"
   - Name: `peer-redis`
   - Type: **Regional**
   - Region: **ap-southeast-1 (Singapore)**
   - Click "Create"
4. **Get Redis URL:**
   - Click on your database
   - Copy the **Redis URL** (starts with `rediss://`)
   - Example: `rediss://default:xxxxx@xxxxx.upstash.io:6379`
   - **Save this URL!**

### 1.3 Generate Encryption Key

Open terminal and run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**Save this key!** You'll use it for `ENCRYPTION_KEY`

---

## 📦 Step 2: Push Code to GitHub

1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - ready for deployment"
   ```

2. **Create GitHub Repository:**
   - Go to https://github.com/new
   - Name: `peer-code-review`
   - Visibility: **Private** (recommended)
   - Click "Create repository"

3. **Push to GitHub:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/peer-code-review.git
   git branch -M main
   git push -u origin main
   ```

---

## 🌐 Step 3: Deploy to Render

### 3.1 Create Render Account & Connect GitHub

1. **Go to** https://render.com
2. **Sign up** using your GitHub account
3. **Authorize** Render to access your repositories

### 3.2 Deploy Using Blueprint (render.yaml)

1. **From Render Dashboard:**
   - Click **"New +"** → **"Blueprint"**
   - Select "Connect a repository"
   - Find and select `peer-code-review`
   - Click "Connect"

2. **Render will detect `render.yaml`** and show you 4 services:
   - `peer-api` (Web Service)
   - `peer-ui` (Web Service)
   - `peer-analyzer` (Background Worker)
   - `peer-autofix` (Background Worker)

3. **Click "Create Services"** - Don't worry about errors yet!

---

## 🔐 Step 4: Configure Environment Variables

You need to add environment variables to **EACH** service. Here's what each service needs:

### 4.1 Configure `peer-api` Service

1. Click on `peer-api` service
2. Go to **"Environment"** tab
3. Add these variables:

| Key | Value | Description |
|-----|-------|-------------|
| `NODE_ENV` | `production` | Already set ✅ |
| `PORT` | `3001` | Already set ✅ |
| `MONGO_URI` | `mongodb+srv://...` | MongoDB Atlas connection string |
| `REDIS_URL` | `rediss://...` | Upstash Redis URL |
| `GITHUB_APP_ID` | `YOUR_APP_ID` | From GitHub App settings |
| `GITHUB_APP_PRIVATE_KEY` | `-----BEGIN...` | Full private key (paste entire key) |
| `GITHUB_WEBHOOK_SECRET` | `YOUR_SECRET` | From GitHub App webhooks |
| `GITHUB_CLIENT_ID` | `YOUR_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | `YOUR_CLIENT_SECRET` | GitHub OAuth App Secret |
| `SESSION_SECRET` | `random_32_char_string` | Generate with: `openssl rand -hex 32` |
| `GROQ_API_KEY` | `gsk_...` | Optional - Your Groq API key |
| `GEMINI_API_KEY` | `AI...` | Optional - Your Gemini key |
| `OPENROUTER_API_KEY` | `sk-...` | Optional - Your OpenRouter key |
| `RAZORPAY_KEY_ID` | `rzp_...` | Your Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | `...` | Your Razorpay Secret |
| `ENCRYPTION_KEY` | `64_char_hex` | From Step 1.3 |
| `UI_BASE` | `https://peer-ui.onrender.com` | Will update after deployment |

4. Click **"Save Changes"**

### 4.2 Configure `peer-ui` Service

1. Click on `peer-ui` service
2. Go to **"Environment"** tab
3. Add these variables:

| Key | Value | Description |
|-----|-------|-------------|
| `NODE_ENV` | `production` | Already set ✅ |
| `UI_PORT` | `3000` | Already set ✅ |
| `MONGO_URI` | `mongodb+srv://...` | Same as API |
| `GITHUB_CLIENT_ID` | `YOUR_CLIENT_ID` | Same as API |
| `GITHUB_CLIENT_SECRET` | `YOUR_CLIENT_SECRET` | Same as API |
| `SESSION_SECRET` | `random_32_char_string` | Same as API |
| `RAZORPAY_KEY_ID` | `rzp_...` | Same as API |
| `RAZORPAY_KEY_SECRET` | `...` | Same as API |
| `ENCRYPTION_KEY` | `64_char_hex` | Same as API |
| `API_BASE` | `https://peer-api.onrender.com` | Will update after deployment |
| `GITHUB_CALLBACK_URL` | `https://peer-ui.onrender.com/auth/github/callback` | Will update |

4. Click **"Save Changes"**

### 4.3 Configure `peer-analyzer` Worker

1. Click on `peer-analyzer` service
2. Go to **"Environment"** tab
3. Add these variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Same as API |
| `REDIS_URL` | Same as API |
| `GITHUB_APP_ID` | Same as API |
| `GITHUB_APP_PRIVATE_KEY` | Same as API |
| `GROQ_API_KEY` | Same as API |
| `GEMINI_API_KEY` | Same as API |
| `OPENROUTER_API_KEY` | Same as API |

4. Click **"Save Changes"**

### 4.4 Configure `peer-autofix` Worker

1. Click on `peer-autofix` service
2. Go to **"Environment"** tab
3. Add same variables as `peer-analyzer`
4. Click **"Save Changes"**

---

## 🔄 Step 5: Update URLs After Initial Deployment

After all services deploy, you'll get URLs like:
- `peer-api`: `https://peer-api.onrender.com` or `https://peer-api-xxxx.onrender.com`
- `peer-ui`: `https://peer-ui.onrender.com` or `https://peer-ui-xxxx.onrender.com`

### 5.1 Update Environment Variables with Actual URLs

1. **Update `peer-api` service:**
   - Change `UI_BASE` to your actual UI URL

2. **Update `peer-ui` service:**
   - Change `API_BASE` to your actual API URL
   - Change `GITHUB_CALLBACK_URL` to `https://YOUR_UI_URL/auth/github/callback`

3. **Click "Save Changes"** on each service (they will redeploy automatically)

---

## 🔧 Step 6: Update GitHub App Settings

1. **Go to your GitHub App settings:**
   - https://github.com/settings/apps/YOUR_APP_NAME

2. **Update URLs:**
   - **Homepage URL:** `https://your-ui-url.onrender.com`
   - **Callback URL:** `https://your-ui-url.onrender.com/auth/github/callback`
   - **Webhook URL:** `https://your-api-url.onrender.com/webhooks/github`
   - **Setup URL:** `https://your-ui-url.onrender.com/installations` (optional)

3. **Click "Save changes"**

---

## 🧪 Step 7: Test Your Deployment

### 7.1 Check Service Health

Visit these URLs in your browser:
- `https://your-api-url.onrender.com/health` - Should return `{"ok": true, "status": "healthy"}`
- `https://your-ui-url.onrender.com/health` - Should return health status

### 7.2 Test Login

1. Go to `https://your-ui-url.onrender.com`
2. Click "Login with GitHub"
3. Authorize the app
4. You should be redirected to dashboard

### 7.3 Test GitHub App Installation

1. Go to your repo → Settings → GitHub Apps
2. Install your Peer app
3. Create a test PR
4. Check if Peer analyzes it

---

## ⚠️ Important Notes & Troubleshooting

### Free Tier Limitations

**Render Free Tier:**
- Services sleep after 15 minutes of inactivity
- First request after sleep takes ~30-60 seconds (cold start)
- **750 hours/month** per service (sleep helps you stay within limit)

**Solutions:**
- Use a cron job to ping your services every 14 minutes
- Upgrade to paid plan ($7/month per service) for always-on

### Common Issues

#### 1. **Services Won't Start**
- Check logs: Click service → "Logs" tab
- Common cause: Missing environment variables
- Fix: Add all required env vars

#### 2. **MongoDB Connection Error**
- Make sure you whitelisted 0.0.0.0/0 in MongoDB Atlas
- Check connection string format
- Ensure database name is in the URL: `/peer?retryWrites=true`

#### 3. **Redis Connection Error**
- Make sure you're using `rediss://` (with double 's')
- Check Upstash dashboard for correct URL

#### 4. **GitHub Webhook Not Working**
- Update webhook URL in GitHub App settings
- Make sure it's `https://your-api-url.onrender.com/webhooks/github`
- Check webhook secret matches

#### 5. **Login Redirect Error**
- Update `GITHUB_CALLBACK_URL` in UI service
- Update GitHub App callback URL
- Both must match exactly

### Viewing Logs

For each service:
1. Click on the service
2. Go to "Logs" tab
3. Watch real-time logs
4. Download logs if needed

---

## 🎯 Deployment Checklist

Before going live:

- [ ] All 4 services are running (green status)
- [ ] Health endpoints return 200 OK
- [ ] MongoDB connected (check logs)
- [ ] Redis connected (check logs)
- [ ] GitHub login works
- [ ] GitHub App installation works
- [ ] Test PR gets analyzed
- [ ] Payment flow works (Razorpay)
- [ ] Webhook deliveries successful
- [ ] Custom domain configured (optional)

---

## 🌍 Step 8: Custom Domain (Optional)

### 8.1 For UI Service

1. **Buy domain** (e.g., from Namecheap, GoDaddy)
2. **In Render:**
   - Go to `peer-ui` service
   - Click "Settings"
   - Scroll to "Custom Domains"
   - Click "Add Custom Domain"
   - Enter: `app.yourdomain.com`
   - Follow DNS instructions (add CNAME record)
3. **Update GitHub App URLs** with your custom domain
4. **Update env vars:**
   - `GITHUB_CALLBACK_URL`: `https://app.yourdomain.com/auth/github/callback`
   - Update `UI_BASE` in API service

### 8.2 For API Service

Same process:
- Domain: `api.yourdomain.com`
- Update webhook URL in GitHub App
- Update `API_BASE` in UI service

---

## 📊 Monitoring & Maintenance

### Enable Email Alerts

1. Go to Render dashboard
2. Click your avatar → "Account Settings"
3. Enable "Deployment notifications"
4. Enable "Health check failure alerts"

### Monitor Performance

- Check logs regularly
- Monitor MongoDB Atlas usage
- Monitor Redis usage
- Check GitHub webhook deliveries
- Monitor Razorpay transactions

### Keep Services Awake (Optional)

Create a simple ping service:
```bash
# Use cron-job.org or similar
# Ping every 14 minutes:
GET https://your-ui-url.onrender.com/health
GET https://your-api-url.onrender.com/health
```

---

## 🔄 Updating Your Deployment

When you make code changes:

1. **Commit and push to GitHub:**
   ```bash
   git add .
   git commit -m "Your update message"
   git push origin main
   ```

2. **Render auto-deploys:**
   - All services will automatically rebuild and redeploy
   - Watch logs during deployment
   - Check health endpoints after deployment

3. **Manual redeploy:**
   - Click service → "Manual Deploy" → "Deploy latest commit"

---

## 🆘 Need Help?

- **Render Docs:** https://render.com/docs
- **MongoDB Atlas Docs:** https://www.mongodb.com/docs/atlas/
- **Upstash Docs:** https://docs.upstash.com/redis
- **GitHub Support:** Your repo issues page

---

## ✅ Success!

If everything is working:
- ✨ Your app is live at `https://your-ui-url.onrender.com`
- 🚀 GitHub PRs are being analyzed automatically
- 💳 Payments are processing
- 🎉 You're ready to onboard users!

**Next Steps:**
1. Share your app with users
2. Monitor performance
3. Gather feedback
4. Iterate and improve!

---

Made with ❤️ by Peer Team
