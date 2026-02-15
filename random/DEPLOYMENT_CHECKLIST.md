# ✅ Quick Deployment Checklist

Use this checklist while deploying. Check off each item as you complete it.

## 🎯 Pre-Deployment

- [1] MongoDB Atlas account created
- [ ] MongoDB cluster created (Free M0 tier, Singapore region)
- [ ] MongoDB user created with password saved
- [ ] MongoDB IP whitelist set to 0.0.0.0/0
- [ ] MongoDB connection string copied and saved
- [ ] Upstash Redis account created
- [ ] Redis database created (Singapore region)
- [ ] Redis URL copied and saved (starts with `rediss://`)
- [ ] Encryption key generated: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Session secret generated: `openssl rand -hex 32`
- [ ] All GitHub App credentials ready
- [ ] Razorpay keys ready
- [ ] AI API keys ready (Groq/Gemini/OpenRouter)

## 📦 GitHub Setup

- [ ] Code pushed to GitHub repository
- [ ] Repository is accessible
- [ ] `render.yaml` file is in root directory
- [ ] `DEPLOYMENT_GUIDE.md` reviewed

## 🌐 Render Setup

- [ ] Render account created
- [ ] GitHub connected to Render
- [ ] Blueprint deployment initiated
- [ ] All 4 services created:
  - [ ] peer-api (Web Service)
  - [ ] peer-ui (Web Service)
  - [ ] peer-analyzer (Worker)
  - [ ] peer-autofix (Worker)

## 🔐 Environment Variables

### peer-api Service
- [ ] NODE_ENV = production
- [ ] PORT = 3001
- [ ] MONGO_URI
- [ ] REDIS_URL
- [ ] GITHUB_APP_ID
- [ ] GITHUB_APP_PRIVATE_KEY
- [ ] GITHUB_WEBHOOK_SECRET
- [ ] GITHUB_CLIENT_ID
- [ ] GITHUB_CLIENT_SECRET
- [ ] SESSION_SECRET
- [ ] GROQ_API_KEY
- [ ] GEMINI_API_KEY
- [ ] OPENROUTER_API_KEY
- [ ] RAZORPAY_KEY_ID
- [ ] RAZORPAY_KEY_SECRET
- [ ] ENCRYPTION_KEY
- [ ] UI_BASE (update after deployment)

### peer-ui Service
- [ ] NODE_ENV = production
- [ ] UI_PORT = 3000
- [ ] MONGO_URI
- [ ] GITHUB_CLIENT_ID
- [ ] GITHUB_CLIENT_SECRET
- [ ] SESSION_SECRET
- [ ] RAZORPAY_KEY_ID
- [ ] RAZORPAY_KEY_SECRET
- [ ] ENCRYPTION_KEY
- [ ] API_BASE (update after deployment)
- [ ] GITHUB_CALLBACK_URL (update after deployment)

### peer-analyzer Service
- [ ] NODE_ENV = production
- [ ] MONGO_URI
- [ ] REDIS_URL
- [ ] GITHUB_APP_ID
- [ ] GITHUB_APP_PRIVATE_KEY
- [ ] GROQ_API_KEY
- [ ] GEMINI_API_KEY
- [ ] OPENROUTER_API_KEY

### peer-autofix Service
- [ ] NODE_ENV = production
- [ ] MONGO_URI
- [ ] REDIS_URL
- [ ] GITHUB_APP_ID
- [ ] GITHUB_APP_PRIVATE_KEY
- [ ] GROQ_API_KEY
- [ ] GEMINI_API_KEY
- [ ] OPENROUTER_API_KEY

## 🔄 Post-Deployment Updates

- [ ] All services deployed successfully
- [ ] Got actual URLs from Render
- [ ] Updated `UI_BASE` in peer-api with actual UI URL
- [ ] Updated `API_BASE` in peer-ui with actual API URL
- [ ] Updated `GITHUB_CALLBACK_URL` in peer-ui with actual URL
- [ ] Services redeployed after URL updates

## 🔧 GitHub App Configuration

- [ ] Updated Homepage URL
- [ ] Updated Callback URL (matches GITHUB_CALLBACK_URL)
- [ ] Updated Webhook URL (points to API service)
- [ ] Updated Setup URL (optional)
- [ ] Webhook secret matches GITHUB_WEBHOOK_SECRET

## 🧪 Testing

- [ ] API health endpoint works: `/health` returns 200
- [ ] UI health endpoint works: `/health` returns 200
- [ ] MongoDB connection successful (check logs)
- [ ] Redis connection successful (check logs)
- [ ] Login with GitHub works
- [ ] Redirected to dashboard after login
- [ ] Profile shows correctly
- [ ] GitHub App installation works
- [ ] Create test PR in a repo
- [ ] PR gets analyzed by Peer
- [ ] Webhook delivery successful
- [ ] Findings appear in PR comments
- [ ] Payment flow works (test mode)
- [ ] Documentation page loads: `/docs`

## 📊 Monitoring Setup

- [ ] Email alerts enabled in Render
- [ ] Deployment notifications enabled
- [ ] Health check alerts enabled
- [ ] Bookmark Render dashboard
- [ ] Bookmark MongoDB Atlas dashboard
- [ ] Bookmark Upstash Redis dashboard
- [ ] Set up uptime monitoring (optional)

## 🌍 Optional: Custom Domain

- [ ] Domain purchased
- [ ] DNS records configured
- [ ] Custom domain added to peer-ui
- [ ] Custom domain added to peer-api
- [ ] GitHub App URLs updated with custom domain
- [ ] Environment variables updated
- [ ] SSL certificate active

## 📝 Documentation

- [ ] Deployment guide reviewed
- [ ] All credentials saved securely
- [ ] Emergency contacts documented
- [ ] Backup plan in place

## 🎉 Launch

- [ ] All tests passed
- [ ] All services running smoothly
- [ ] No errors in logs
- [ ] Ready to onboard users!

---

## 🚨 Emergency Contacts

- Render Support: https://render.com/support
- MongoDB Support: https://support.mongodb.com
- Upstash Support: https://upstash.com/support
- GitHub Support: https://support.github.com

---

## 📞 Quick Commands

**Generate Encryption Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generate Session Secret:**
```bash
openssl rand -hex 32
```

**Test API Health:**
```bash
curl https://your-api-url.onrender.com/health
```

**Test UI Health:**
```bash
curl https://your-ui-url.onrender.com/health
```

**View Logs:**
1. Go to Render dashboard
2. Click on service
3. Click "Logs" tab

---

**Last Updated:** <%= new Date().toLocaleDateString() %>
