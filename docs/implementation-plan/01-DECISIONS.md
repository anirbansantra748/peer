# ✅ Final Technical Decisions

> **Status**: Approved  
> **Cost**: $0/month  
> **Last Updated**: 2026-01-25

## Critical Decisions

### 1. Load Balancer: Render.com Built-in ✅

**Decision**: Use Render's automatic load balancing  
**Rationale**: Free, zero config, handles health checks  
**Cost**: $0  
**Action**: No code needed (already configured in render.yaml)

---

### 2. Vector Database: Qdrant Cloud ✅

**Decision**: Qdrant Cloud Free Tier  
**Details**:
- Storage: 1 GB free forever
- Capacity: ~1M vectors (1024-dim)
- Features: Managed cluster, HA, monitoring

**Why Not Others**:
- ❌ ChromaDB: Only $5 credits (not perpetual)
- ❌ Weaviate: 14-day trial only
- ❌ Pinecone: No free tier

**Setup URL**: https://qdrant.tech/  
**Cost**: $0

---

### 3. Embedding Generation: Voyage AI ✅

**Decision**: Voyage AI `voyage-code-3` model  
**Details**:
- Free quota: 200M tokens (~200K code snippets)
- Dimension: 1024
- Optimized for code

**Why Not Others**:
- ❌ Cohere: Only 1000 calls/month
- ❌ OpenAI: Costs $0.02/1M tokens
- ❌ Together AI: No free tier

**API**: https://docs.voyageai.com/  
**Cost**: $0

---

### 4. RAG Framework: LangChain.js ✅

**Decision**: LangChain.js  
**Rationale**:
- Open source (free)
- Built-in Qdrant integration
- Document splitters for code
- Large community

**Alternative**: LlamaIndex (LangChain has better Node.js support)  
**Cost**: $0

---

### 5. Static Analyzers: 9 Tools ✅

All free, all mandatory:

| Tool | Purpose | Language |
|------|---------|----------|
| npm audit | Dependencies | Node.js |
| pip-audit | Dependencies | Python |
| TruffleHog | Secrets | All |
| ESLint | Linting | JS/TS |
| Semgrep | Security | Multi-lang |
| Bandit | Security | Python |
| Hadolint | Dockerfile | Docker |
| Checkov | IaC | Terraform/K8s |
| PMD | Code quality | Java |

**Total Cost**: $0

---

### 6. File Storage: Hybrid Approach ✅

**Initial (Development)**:
- Local filesystem: `/tmp` for cloned repos
- Local storage: `./storage` for recordings

**Production (Future)**:
- Cloudflare R2: 10 GB free
- For long-term recording storage

**What to Store**:
1. **Temporary (delete after analysis)**:
   - Cloned repositories
   - Intermediate analyzer outputs

2. **Permanent**:
   - Analysis recordings (JSON logs)
   - PR snapshots
   - Error reports

**Files NOT stored**:
- User source code (privacy)
- Credentials
- Large binaries

**Storage Path**: `./storage/recordings/` (local)  
**Cost**: $0

---

### 7. LLM Providers: Multi-tier Fallback ✅

**Primary**: Groq (free tier)
- Models: mixtral-8x7b, llama-3.1-70b
- Fast inference

**Fallback 1**: Google Gemini (free tier)
- Model: gemini-1.5-flash
- 15 RPM limit

**Fallback 2**: OpenAI (user's API key)
- Model: gpt-4o-mini
- User provides key (their cost)

**Cost**: $0 (using free tiers)

---

### 8. Infrastructure Stack ✅

**Hosting**: Render.com
- Free tier: 750 hours/month
- 4 services (API, UI, Workers)

**Database**: MongoDB Atlas
- Free tier: 512 MB
- Enough for metadata

**Cache/Queue**: Redis Cloud
- Free tier: 30 MB
- For BullMQ

**Cost**: $0/month total

---

### 9. Import/Export Analysis: Babel ✅

**For JavaScript/TypeScript**:
- `@babel/parser`: Parse code to AST
- `@babel/traverse`: Walk AST

**For Python**:
- Python built-in `ast` module

**Purpose**: Build dependency graph for RAG context

**Cost**: $0 (open source)

---

### 10. Clone Strategy: Smart Incremental ✅

**First PR Event**: Full clone
**Subsequent Updates**: Fetch only (`git fetch`)

**Rationale**:
- Saves time on PR updates
- Reduces disk usage
- Faster analysis

**Implementation**: Check if repo exists in temp before cloning

---

## Rollback Plans

### Payment Failure Rollback

```javascript
// If Razorpay payment fails
try {
  await processPayment();
  await addTokens();
} catch (error) {
  // DO NOT add tokens
  await logFailure();
  await notifyUser('Payment failed');
  // No rollback needed - tokens never added
}
```

### Token Deduction Rollback

```javascript
// If LLM call fails after deducting tokens
const session = await mongoose.startSession();
session.startTransaction();

try {
  await User.updateOne({ _id }, { $inc: { tokens: -amount } }, { session });
  const result = await callLLM();
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction(); // Tokens restored
  throw error;
}
```

### Embedding Failure Rollback

```javascript
// If Qdrant storage fails
try {
  const embedding = await generateEmbedding();
  await qdrant.upsert(embedding);
} catch (error) {
  // Mark as failed, retry later
  await Finding.updateOne({ _id }, { embeddingFailed: true });
  // Queue for retry
  await embeddingQueue.add('retry', { findingId }, { delay: 60000 });
}
```

---

## Environmental Variables (Final)

```env
# ─── EXISTING ────────────────────────────────
MONGO_URI=mongodb+srv://...
REDIS_URL=redis://...
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY=...
GROQ_API_KEY=...
GEMINI_API_KEY=...

# ─── NEW (ADD THESE) ─────────────────────────
QDRANT_URL=https://xyz.qdrant.io
QDRANT_API_KEY=...
VOYAGE_API_KEY=pa-...
ENABLE_RAG=true
RAG_SIMILARITY_THRESHOLD=0.75
RAG_TOP_K=5
COMPLEXITY_THRESHOLD=5
STORAGE_PATH=./storage
ENABLE_SCHEDULER=true
```

---

## Installation Commands

### Required Tools (Global)

```bash
# Secret scanning
npm install -g trufflehog

# Dockerfile linting
# Download from: https://github.com/hadolint/hadolint/releases
curl -L https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-x86_64 -o /usr/local/bin/hadolint
chmod +x /usr/local/bin/hadolint

# IaC scanning
pip install checkov

# Python dependency audit
pip install pip-audit
```

### Project Dependencies

```bash
# Install new packages
npm install @qdrant/js-client-rest @langchain/community langchain @babel/parser @babel/traverse
```

---

## Success Criteria

After implementation:
- [ ] All 9 static analyzers running
- [ ] Embeddings generating for findings
- [ ] RAG returning similar issues
- [ ] Error classification working (simple vs complex)
- [ ] Token management with rollback
- [ ] Local file storage working
- [ ] Scheduler running cleanup jobs
- [ ] Total cost: $0/month

**All decisions finalized. Ready to implement.** ✅
