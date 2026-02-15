# 🔑 Third-Party Services Setup Guide

> **Purpose**: Complete list of all API keys and services needed  
> **Instructions**: Get these ready BEFORE starting implementation

---

## Required Services (Must Have)

### 1. Qdrant Cloud - Vector Database ⭐ CRITICAL

**What it's for**: Store code embeddings for RAG semantic search

**Free Tier**: 1 GB forever (no credit card needed)

**How to get**:
1. Go to: https://qdrant.tech/
2. Click "Start Free"
3. Sign up with GitHub (easiest)
4. Click "Create Cluster"
5. Select "Free" tier
6. Choose region (closest to you)
7. Wait 2-3 minutes for cluster creation

**What you'll receive**:
```env
QDRANT_URL=https://xyz-abc-12345.aws.qdrant.io
QDRANT_API_KEY=your-api-key-here
```

**Add to `.env` file**:
```bash
# Vector Database
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=pa-xxxxxxxxxxxxxxxxxx
```

---

### 2. Voyage AI - Embedding Generation ⭐ CRITICAL

**What it's for**: Generate vector embeddings from code snippets

**Free Tier**: 200 million tokens (enough for ~200K code snippets)

**How to get**:
1. Go to: https://www.voyageai.com/
2. Click "Get API Key" or "Sign Up"
3. Sign up (email or Google)
4. Go to Dashboard → API Keys
5. Click "Create New Key"
6. Copy the key (starts with `pa-`)

**What you'll receive**:
```env
VOYAGE_API_KEY=pa-xxxxxxxxxxxxxxxxxxxxxx
```

**Add to `.env` file**:
```bash
# Embeddings
VOYAGE_API_KEY=pa-your-voyage-key-here
VOYAGE_MODEL=voyage-code-3
```

---

### 3. Groq API - LLM (Free Tier) ⭐ RECOMMENDED

**What it's for**: Fast LLM inference for auto-fixes

**Free Tier**: Rate-limited but generous for development

**How to get**:
1. Go to: https://console.groq.com/
2. Sign up with Google/GitHub
3. Go to "API Keys"
4. Create new key
5. Copy key (starts with `gsk_`)

**What you'll receive**:
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxx
```

**Add to `.env` file**:
```bash
# LLM Primary
GROQ_API_KEY=gsk-your-groq-key-here
```

---

### 4. Google Gemini API - LLM Fallback ⭐ RECOMMENDED

**What it's for**: Backup LLM if Groq rate-limited

**Free Tier**: 15 requests per minute

**How to get**:
1. Go to: https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Select existing project or create new
5. Copy key (starts with `AIza`)

**What you'll receive**:
```env
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxx
```

**Add to `.env` file**:
```bash
# LLM Fallback
GEMINI_API_KEY=AIza-your-gemini-key-here
```

---

## Already Have (Existing)

### ✅ MongoDB Atlas
- Already configured ✅
- URI in `.env` as `MONGO_URI`

### ✅ Redis Cloud  
- Already configured ✅
- URI in `.env` as `REDIS_URL`

### ✅ GitHub App
- Already configured ✅
- Keys in `.env` (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, etc.)

### ✅ Razorpay
- Already configured ✅
- Keys in `.env` (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)

---

## Optional Services (Can Add Later)

### 5. Cloudflare R2 - File Storage (Optional)

**What it's for**: Long-term storage of analysis recordings

**Free Tier**: 10 GB storage

**When to use**: After 1000+ analysis runs (not needed initially)

**How to get** (when ready):
1. Go to: https://dash.cloudflare.com/
2. Sign up
3. Go to R2 Object Storage
4. Create bucket
5. Generate API token

**For now**: Use local file storage (`./storage`)

---

### 6. OpenAI API - LLM (Optional)

**What it's for**: Highest quality LLM (not free)

**Cost**: ~$0.01 per 1K tokens

**When to use**: If Groq + Gemini both fail

**How to get** (if user wants):
1. Go to: https://platform.openai.com/api-keys
2. Sign up + add payment method
3. Create API key
4. Add to `.env` as `OPENAI_API_KEY`

**For now**: Skip this (use free Groq/Gemini)

---

## Complete `.env` Template

**Copy this to `.env` file and fill in values:**

```env
# ─── EXISTING (Already Have) ─────────────────────────────
NODE_ENV=production
PORT=3001

# Database
MONGO_URI=mongodb+srv://...your-existing-uri...
REDIS_URL=redis://...your-existing-uri...

# GitHub App
GITHUB_APP_ID=...existing...
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_CLIENT_ID=...existing...
GITHUB_CLIENT_SECRET=...existing...
GITHUB_CALLBACK_URL=...existing...

# Payment
RAZORPAY_KEY_ID=...existing...
RAZORPAY_KEY_SECRET=...existing...

# Session
SESSION_SECRET=...existing...

# ─── NEW (You Need to Get These) ─────────────────────────

# Vector Database (REQUIRED)
QDRANT_URL=https://xyz.qdrant.io
QDRANT_API_KEY=pa-your-qdrant-key

# Embeddings (REQUIRED)
VOYAGE_API_KEY=pa-your-voyage-key
VOYAGE_MODEL=voyage-code-3

# LLM Primary (REQUIRED)
GROQ_API_KEY=gsk-your-groq-key

# LLM Fallback (RECOMMENDED)
GEMINI_API_KEY=AIza-your-gemini-key

# RAG Configuration
ENABLE_RAG=true
RAG_SIMILARITY_THRESHOLD=0.75
RAG_TOP_K=5
COMPLEXITY_THRESHOLD=5

# File Storage
STORAGE_PATH=./storage
ENABLE_SCHEDULER=true

# Optional (Not Needed Yet)
# OPENAI_API_KEY=sk-...
# R2_ENDPOINT=...
# R2_ACCESS_KEY_ID=...
```

---

## Checklist Before Starting Implementation

**Get these API keys first:**

- [ ] Qdrant Cloud account created
  - [ ] Cluster created (1 GB free)
  - [ ] URL copied to `.env`
  - [ ] API key copied to `.env`

- [ ] Voyage AI account created
  - [ ] API key generated
  - [ ] Key copied to `.env`

- [ ] Groq API key obtained
  - [ ] Key copied to `.env`

- [ ] Google Gemini key obtained (optional but recommended)
  - [ ] Key copied to `.env`

- [ ] Verify existing keys still work
  - [ ] MongoDB connection works
  - [ ] Redis connection works
  - [ ] GitHub OAuth works

---

## Testing API Keys

**Run these commands to verify:**

### Test Qdrant
```bash
curl -X GET "$QDRANT_URL/collections" \
  -H "api-key: $QDRANT_API_KEY"
# Should return: {"result": {"collections": []}}
```

### Test Voyage AI
```bash
curl https://api.voyageai.com/v1/embeddings \
  -H "Authorization: Bearer $VOYAGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": "test", "model": "voyage-code-3"}'
# Should return embedding vector
```

### Test Groq
```bash
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "mixtral-8x7b-32768", "messages": [{"role": "user", "content": "Hello"}]}'
# Should return response
```

---

## Cost Estimate

| Service | Free Tier | Expected Usage | Monthly Cost |
|---------|-----------|----------------|--------------|
| Qdrant | 1 GB | ~500K findings | **$0** |
| Voyage AI | 200M tokens | ~100K embeddings | **$0** |
| Groq | Rate-limited | Primary LLM | **$0** |
| Gemini | 15 RPM | Fallback | **$0** |
| MongoDB | 512 MB | Metadata | **$0** |
| Redis | 30 MB | Queue | **$0** |
| Render | 750 hrs | Hosting | **$0** |
| **TOTAL** | - | - | **$0/month** |

---

## What to Tell Me When Ready

Once you have all API keys, tell me:
✅ "Got all API keys, ready to start"

Then we'll proceed with Module 02 (Static Analyzers) implementation!
