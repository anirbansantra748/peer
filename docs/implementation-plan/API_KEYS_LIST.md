# 📋 API KEYS QUICK LIST

> **Copy this. Get these keys. Takes 20 minutes total.**

---

## Required API Keys (Total: ~20 minutes)

### 1. Qdrant Cloud ⏱️ 10 min

**What**: Vector database for RAG  
**Free**: 1 GB forever  
**Link**: https://qdrant.tech/

**Steps**:
1. Click "Start Free"
2. Sign up with GitHub
3. Create cluster (select "Free" tier)
4. Wait 2-3 minutes
5. Copy URL and API key

**You get**:
```
QDRANT_URL=https://xyz-abc-12345.qdrant.io
QDRANT_API_KEY=pa-xxxxxxxxxxxxxxxxxx
```

---

### 2. Voyage AI ⏱️ 5 min

**What**: Generate embeddings  
**Free**: 200M tokens  
**Link**: https://www.voyageai.com/

**Steps**:
1. Click "Get API Key"
2. Sign up (email/Google)
3. Dashboard → API Keys
4. Create new key
5. Copy key (starts with `pa-`)

**You get**:
```
VOYAGE_API_KEY=pa-xxxxxxxxxxxxxxxxxx
```

---

### 3. Groq ⏱️ 5 min

**What**: Fast LLM inference  
**Free**: Rate-limited  
**Link**: https://console.groq.com/

**Steps**:
1. Sign up with Google/GitHub
2. Go to "API Keys"
3. Create new key
4. Copy key (starts with `gsk_`)

**You get**:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxx
```

---

### 4. Google Gemini (Optional) ⏱️ 3 min

**What**: LLM backup  
**Free**: 15 req/min  
**Link**: https://makersuite.google.com/app/apikey

**Steps**:
1. Sign in with Google
2. Click "Create API Key"
3. Select/create project
4. Copy key (starts with `AIza`)

**You get**:
```
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxx
```

---

## Copy-Paste Into .env

**Open your `.env` file and add these:**

```env
# ═══════════════════════════════════════════════
# NEW API KEYS (Add these)
# ═══════════════════════════════════════════════

# Qdrant Vector Database
QDRANT_URL=paste-your-url-here
QDRANT_API_KEY=paste-your-key-here

# Voyage AI Embeddings
VOYAGE_API_KEY=paste-your-key-here
VOYAGE_MODEL=voyage-code-3

# Groq LLM
GROQ_API_KEY=paste-your-key-here

# Google Gemini LLM (Optional)
GEMINI_API_KEY=paste-your-key-here

# RAG Configuration
ENABLE_RAG=true
RAG_SIMILARITY_THRESHOLD=0.75
RAG_TOP_K=5
COMPLEXITY_THRESHOLD=5

# File Storage
STORAGE_PATH=./storage
ENABLE_SCHEDULER=true
```

---

## Test Your Keys

**After adding to `.env`, test them:**

### Test Qdrant
```bash
curl -X GET "$QDRANT_URL/collections" -H "api-key: $QDRANT_API_KEY"
# Should return: {"result":{"collections":[]}}
```

### Test Voyage AI
```bash
curl https://api.voyageai.com/v1/embeddings \
  -H "Authorization: Bearer $VOYAGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":"test","model":"voyage-code-3"}'
# Should return embedding array
```

### Test Groq
```bash
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"mixtral-8x7b-32768","messages":[{"role":"user","content":"Hi"}]}'
# Should return chat response
```

---

## Checklist

- [ ] Qdrant: Account created, cluster ready, keys in `.env`
- [ ] Voyage AI: Account created, key in `.env`
- [ ] Groq: Account created, key in `.env`
- [ ] Gemini: (Optional) Account created, key in `.env`
- [ ] All keys tested with curl commands above
- [ ] `.env` file saved

---

## When Done

**Tell AI:**
```
I have all API keys ready. They're in my .env file and tested.
```

**Then AI can start implementation! 🚀**

---

## Total Cost

**Monthly**: $0  
**Setup Time**: 20 minutes  
**Limits**: All free tiers sufficient for development

✅ **100% Free Tech Stack**
