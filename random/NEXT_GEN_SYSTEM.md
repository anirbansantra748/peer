# 🧠 Peer v2.0 – Next-Generation AI Code Review System

> A RAG-powered, context-aware code review platform that learns and improves over time

---

## 📋 Table of Contents

1. [Current State vs. Vision](#current-state-vs-vision)
2. [Free-Tier Strategy](#free-tier-strategy)
3. [System Architecture](#system-architecture)
4. [Core Components](#core-components)
5. [Data Flow & Processing](#data-flow--processing)
6. [Technology Choices & Trade-offs](#technology-choices--trade-offs)
7. [Competitive Advantages over CodeRabbit](#competitive-advantages-over-coderabbit)
8. [Learning Over Time](#learning-over-time)
9. [Cost Analysis](#cost-analysis)
10. [Phase-wise Implementation](#phase-wise-implementation)
11. [Open Questions & Decisions](#open-questions--decisions)

---

## 🎯 Current State vs. Vision

### What We Have Now (v1.0) ✅
```
GitHub PR → Webhook → BullMQ Queue → Static Analyzers → LLM Review → PR Comment
```

| Component | Status |
|-----------|--------|
| GitHub App Integration | ✅ Working |
| Webhook Processing | ✅ Working |
| BullMQ Queue System | ✅ Working |
| Redis Caching | ✅ Working |
| MongoDB Storage | ✅ Working |
| Multi-LLM Support (Gemini/Groq/GPT) | ✅ Working |
| Static Analyzers (ESLint, Semgrep, etc.) | ✅ Working |
| Auto-fix Generation | ✅ Working |
| Web Dashboard | ✅ Working |
| Payment (Razorpay) | ✅ Working |

### What We're Building (v2.0) 🚀

```
GitHub PR → Webhook → Queue → [RAG Context Engine] → [Multi-level AI] → Intelligent Review
                              ↓
                    [Repository Understanding]
                    [Codebase Indexing]
                    [Vector Embeddings]
                    [Learning System]
```

| Component | Status |
|-----------|--------|
| Repository Indexing | 🔨 To Build |
| Vector Embeddings (Free) | 🔨 To Build |
| ChromaDB Integration | 🔨 To Build |
| RAG-based Context | 🔨 To Build |
| Multi-tier AI Processing | 🔨 To Build |
| Learning/Feedback Loop | 🔨 To Build |
| Stack-specific Analysis | 🔨 To Build |

---

## 💸 Free-Tier Strategy

**Budget Constraint:** ₹0 - ₹500/month (~$0-6 USD)

### Embedding Options (100% FREE)

| Service | Free Tier | Rate Limit | Quality | Recommendation |
|---------|-----------|------------|---------|----------------|
| **Google Gemini Embeddings** | ✅ FREE | 1,500 requests/day | Excellent | **PRIMARY CHOICE** |
| **Jina AI Embeddings** | ✅ FREE | 1M tokens/month | Very Good | Backup option |
| **Cohere Embed** | ✅ Trial | 100 req/min | Good | Trial only |
| **Hugging Face Inference** | ✅ FREE | Rate limited | Good | Fallback |

#### Gemini Embeddings (Our Choice)
```javascript
// FREE - No credit card required
// Model: text-embedding-004
// Dimensions: 768
// Max tokens: 2048 per request
// Rate: 1500 requests/day = ~45,000 chunks/month
```

**Why Gemini Embeddings:**
- Completely free (no trial period)
- High quality (competes with OpenAI ada-002)
- Same API key you already have for Gemini LLM
- 768 dimensions = good balance of quality vs. storage

### Vector Database (100% FREE)

| Database | Free Tier | Storage | Best For | Our Choice |
|----------|-----------|---------|----------|------------|
| **ChromaDB** | ✅ Self-hosted | Unlimited | Prototyping, small-medium scale | **YES** |
| Qdrant | ✅ Self-hosted | Unlimited | Production scale | Future upgrade |
| Pinecone | Free tier | 100K vectors | Managed service | Too limited |
| Weaviate | ✅ Self-hosted | Unlimited | Advanced features | Overkill for now |

**Why ChromaDB:**
- You already know it
- Zero cost (runs in-process or local Docker)
- Easy to migrate later if needed
- ~50-100 repos is fine on single node

### LLM Processing (Mixed Strategy)

| Task Type | Model | Cost | Use Case |
|-----------|-------|------|----------|
| Simple fixes | Gemini Flash | FREE | Typos, syntax, simple patterns |
| Complex analysis | Groq (Llama-3) | FREE | Function rewrites, logic fixes |
| High-context review | Gemini Pro | FREE | Full file understanding |
| Fallback | GPT-4 (if user has key) | Paid | User's own API key |

---

## 🏗️ System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PEER v2.0 ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────┘

1. INSTALLATION FLOW
   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │ User Installs│────▶│ Background   │────▶│ ChromaDB     │
   │ GitHub App   │     │ Indexer Queue│     │ (Vectors)    │
   └──────────────┘     └──────────────┘     └──────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │ Gemini       │
                        │ Embeddings   │
                        └──────────────┘

2. PR REVIEW FLOW
   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │ PR Created   │────▶│ Webhook      │────▶│ Analysis     │
   │              │     │ (API Server) │     │ Queue        │
   └──────────────┘     └──────────────┘     └──────────────┘
                                                    │
         ┌────────────────────────────────────────┬─┴──────────────────┐
         ▼                                        ▼                    ▼
   ┌──────────────┐                        ┌──────────────┐     ┌──────────────┐
   │ Is Repo      │                        │ Static       │     │ Security     │
   │ Indexed?     │                        │ Analyzers    │     │ Scanners     │
   └──────────────┘                        └──────────────┘     └──────────────┘
         │                                        │                    │
    ┌────┴────┐                                   └────────┬───────────┘
    │         │                                            │
    ▼         ▼                                            ▼
┌────────┐ ┌────────────┐                           ┌──────────────┐
│ NO:    │ │ YES:       │                           │ Findings     │
│ Quick  │ │ RAG-based  │                           │ Aggregator   │
│ Review │ │ Context    │                           └──────────────┘
└────────┘ └────────────┘                                  │
    │             │                                        │
    └──────┬──────┘                                        │
           │                                               │
           ▼                                               ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                    AI PROCESSING PIPELINE                      │
   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
   │  │ Tier 1: Fast │  │ Tier 2: Deep │  │ Tier 3: Full │        │
   │  │ Gemini Flash │  │ Groq Llama   │  │ Gemini Pro   │        │
   │  │ Simple fixes │  │ Medium tasks │  │ Complex      │        │
   │  └──────────────┘  └──────────────┘  └──────────────┘        │
   └──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │ PR Comment   │
                       │ + Auto-fix   │
                       │ + Dashboard  │
                       └──────────────┘
```

### Repository Indexing Detail

```
Repository Installation
        │
        ▼
┌─────────────────┐
│ Clone Repository│
│ (Shallow, main) │
└─────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PARALLEL EXTRACTION                           │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │ File Scanner  │  │ Dependency    │  │ Config Parser │       │
│  │ - Extensions  │  │ Scanner       │  │ - package.json│       │
│  │ - Structure   │  │ - package.json│  │ - .env.example│       │
│  │ - Git history │  │ - requirements│  │ - docker      │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────┐
│ Stack Detection │
│ MERN/Django/etc │
└─────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CODE CHUNKING (Per File)                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Strategy:                                                  │  │
│  │ 1. AST-based chunking (functions, classes) - PREFERRED    │  │
│  │ 2. Semantic chunking (logical blocks) - FALLBACK          │  │
│  │ 3. Sliding window (500 tokens, 100 overlap) - LAST RESORT │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EMBEDDING GENERATION                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Gemini text-embedding-004                                  │  │
│  │ - Batch size: 100 chunks                                   │  │
│  │ - Rate limiting: 1500/day spread across time               │  │
│  │ - Priority: High-change files first                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────┐
│ ChromaDB Store  │
│ Collection/repo │
└─────────────────┘
```

---

## 🔧 Core Components

### 1. Repository Indexer

**Purpose:** Background service that indexes repositories after installation

```javascript
// Pseudo-code structure
class RepositoryIndexer {
  // Triggered when: App installed, manual refresh, or first PR
  async indexRepository(repoId, options) {
    // 1. Clone repository (shallow)
    // 2. Detect stack (MERN, Django, etc.)
    // 3. Scan all files
    // 4. Chunk code intelligently
    // 5. Generate embeddings (Gemini)
    // 6. Store in ChromaDB
    // 7. Update repo metadata
  }
  
  // Incremental indexing for subsequent PRs
  async updateIndex(repoId, changedFiles) {
    // Only re-index changed files
    // Much faster than full reindex
  }
}
```

**Chunking Strategy:**
| File Type | Strategy | Chunk Size |
|-----------|----------|------------|
| JavaScript/TypeScript | AST (functions, classes) | Variable (by function) |
| Python | AST (functions, classes) | Variable (by function) |
| JSON/YAML | Section-based | Per key-value block |
| Markdown/Docs | Header-based | Per section |
| Other | Sliding window | 500 tokens, 100 overlap |

### 2. Vector Store (ChromaDB)

**Collection Structure:**
```
peer_vectors/
├── repo_{repoId}/
│   ├── files/           # File content chunks
│   ├── functions/       # Function-level chunks
│   ├── imports/         # Import/dependency graph
│   └── metadata/        # Config, README, etc.
```

**Metadata per chunk:**
```javascript
{
  repo_id: "github:owner/repo",
  file_path: "src/utils/helper.js",
  chunk_type: "function",  // function | class | import | config | doc
  function_name: "calculateTotal",
  start_line: 45,
  end_line: 78,
  language: "javascript",
  stack: "MERN",
  last_modified: "2024-01-10",
  imports: ["lodash", "./constants"],
  exports: ["calculateTotal"]
}
```

### 3. RAG Context Builder

**Purpose:** Build relevant context for AI review

```javascript
class RAGContextBuilder {
  async buildContext(prDiff, repoId) {
    // 1. Extract changed functions/files from PR
    // 2. Query ChromaDB for similar code
    // 3. Query for import/export dependencies
    // 4. Get relevant docs/configs
    // 5. Rank by relevance
    // 6. Fit within token budget
    return {
      changedCode: [...],
      similarCode: [...],
      dependencies: [...],
      configs: [...],
      totalTokens: X
    };
  }
}
```

**Context Priority:**
1. **Direct changes** (full content of changed files)
2. **Imports** (files that changed files import from)
3. **Exports** (files that import from changed files)
4. **Similar functions** (vector similarity search)
5. **Config files** (package.json, tsconfig, etc.)
6. **Documentation** (README, comments)

### 4. Multi-Tier AI Processor

**Issue Classification:**

| Complexity | Examples | AI Model | Token Budget |
|------------|----------|----------|--------------|
| **Simple** | Variable naming, typos, missing semicolons | Gemini Flash | 1000 tokens |
| **Medium** | Logic improvements, better patterns | Groq Llama-3 | 4000 tokens |
| **Complex** | Architectural issues, security flaws | Gemini Pro | 8000 tokens |

**Classification Rules:**
```javascript
function classifyIssue(finding) {
  // Simple: Single line, syntax, formatting
  if (finding.lines <= 3 && finding.type in ['style', 'syntax']) {
    return 'simple';
  }
  
  // Complex: Security, architecture, multi-file
  if (finding.type in ['security', 'architecture'] || finding.affectedFiles > 1) {
    return 'complex';
  }
  
  // Medium: Everything else
  return 'medium';
}
```

---

## 🔄 Data Flow & Processing

### First PR Flow (Repository Not Indexed)

```
1. PR Webhook arrives
2. Check: Is repo indexed?
   ├── NO:
   │   ├── Add to background indexing queue (HIGH priority)
   │   ├── Run QUICK review (without RAG context)
   │   ├── Post initial findings as PR comment
   │   └── Note: "Full codebase analysis in progress..."
   │
3. Indexing completes in background
4. For next PRs, full RAG context is available
```

### Subsequent PR Flow (Repository Indexed)

```
1. PR Webhook arrives
2. Check: Is repo indexed? YES ✓
3. Build RAG context:
   ├── Get changed files from PR diff
   ├── Query similar functions from ChromaDB
   ├── Get import/export dependencies
   └── Compile context (within token budget)
4. Run parallel analysis:
   ├── Static analyzers (ESLint, Semgrep, etc.)
   ├── AI security review
   └── AI quality review (with RAG context)
5. Classify findings by complexity
6. Process through tiered AI:
   ├── Simple → Gemini Flash (batch processing)
   ├── Medium → Groq Llama-3
   └── Complex → Gemini Pro
7. Generate fixes and suggestions
8. Post comprehensive PR comment
9. Update learning database (if feedback received)
```

### Multi-Repo Installation Handling

**Problem:** User installs on 20 repos → could overwhelm system

**Solution: Smart Queue Priority**

```javascript
const indexingPriority = {
  // Highest priority: Repos with active PRs
  'pr_pending': 1000,
  
  // High priority: Recently active repos
  'active_last_week': 100,
  
  // Medium priority: Has commits in last month
  'active_last_month': 50,
  
  // Low priority: Dormant repos
  'dormant': 10
};

// Max concurrent indexing per user: 2
// Max concurrent indexing global: 5
```

---

## ⚖️ Technology Choices & Trade-offs

### Embedding: Gemini vs. Alternatives

| Aspect | Gemini | OpenAI | Jina | Our Choice |
|--------|--------|--------|------|------------|
| Cost | FREE | $0.0001/1K | FREE (limited) | **Gemini** |
| Quality | 9/10 | 10/10 | 8/10 | **Gemini** |
| Rate Limit | 1500/day | Unlimited | 1M tokens/mo | **Gemini** |
| Latency | ~100ms | ~80ms | ~150ms | **Gemini** |

**Trade-off:** Slightly lower rate limit, but completely free and high quality.

### Vector DB: ChromaDB vs. Alternatives

| Aspect | ChromaDB | Qdrant | Pinecone | Our Choice |
|--------|----------|--------|----------|------------|
| Cost | FREE | FREE (self-host) | LIMITED free | **ChromaDB** |
| Scale | ~100K vectors | Millions | Billions | **ChromaDB** (for now) |
| Ease | Very Easy | Medium | Easy | **ChromaDB** |
| Migration | Easy to migrate | N/A | Hard | **ChromaDB** |

**Trade-off:** Not infinitely scalable, but perfect for starting and easy to migrate later.

### Chunking: LangChain vs. Custom

| Aspect | LangChain | Custom AST | Our Choice |
|--------|-----------|------------|------------|
| Flexibility | Limited | Full control | **Custom AST** |
| Dependencies | Heavy (many packages) | Minimal | **Custom AST** |
| Code-awareness | Generic | Language-specific | **Custom AST** |
| Maintenance | External updates | Our responsibility | **Custom AST** |

**Trade-off:** More initial work, but better results for code. Use tree-sitter for AST parsing.

---

## 🏆 Competitive Advantages over CodeRabbit

### What CodeRabbit Does

| Feature | CodeRabbit | Available? |
|---------|------------|------------|
| PR Review | Real-time AI review | ✅ |
| Multi-language | Yes | ✅ |
| GitHub Integration | GitHub only | ✅ |
| GitLab/Bitbucket | Coming soon | ❌ |
| Dashboard | Basic | ❌ |
| Auto-fix | Limited | ❌ |
| Self-hosted | No | ❌ |
| Pricing | $12/user/month (pro) | 💰 |

### Our Advantages

| Feature | Peer | Advantage Level |
|---------|------|-----------------|
| **FREE Tier** | Truly free (not trial) | 🔥🔥🔥 |
| **Web Dashboard** | Full audit history, analytics | 🔥🔥 |
| **Auto-fix with PR** | Creates fix branches automatically | 🔥🔥🔥 |
| **Auto-merge** | Configurable automatic merging | 🔥🔥 |
| **3 Review Modes** | Comment / Commit / Merge | 🔥🔥 |
| **Codebase Understanding** | RAG-powered context | 🔥🔥🔥 |
| **Stack-aware** | MERN, Django, etc. specific | 🔥🔥 |
| **Self-hosted Option** | Full control | 🔥🔥 |
| **Multi-LLM** | Gemini + Groq + GPT fallback | 🔥 |
| **Learning System** | Improves with feedback | 🔥🔥🔥 |

### Unique Selling Points (USP)

1. **Free Forever (for small teams)**
   - Not a trial, truly free
   - Open source option

2. **Smarter Context (RAG)**
   - Understands your codebase
   - Not just the PR diff
   - Knows about dependencies

3. **Auto-fix That Works**
   - Creates actual PRs
   - Can auto-merge safe fixes
   - User approves complex fixes

4. **Stack-Specific Intelligence**
   - Knows MERN vs Django patterns
   - Framework-specific best practices
   - Library version awareness

5. **Full Audit Trail**
   - Web dashboard
   - Historical analysis
   - Team insights

---

## 🧪 Learning Over Time

### Feedback Collection

```javascript
// User actions that provide learning signals
const feedbackSignals = {
  // Strong positive
  'fix_applied': +10,
  'suggestion_implemented': +5,
  'thumbs_up': +3,
  
  // Negative
  'fix_rejected': -5,
  'thumbs_down': -3,
  'marked_false_positive': -10,
  
  // Neutral (still useful)
  'comment_replied': 0,
  'fix_modified': -1  // Partial success
};
```

### Learning Storage

```javascript
// Store in ChromaDB or separate collection
const learningRecord = {
  finding_type: "unused-variable",
  code_context: "function foo() { const x = 1; }",
  suggestion_made: "Remove unused variable 'x'",
  user_action: "fix_applied",
  feedback_score: +10,
  repo_type: "MERN",
  timestamp: "2024-01-10"
};
```

### Improvement Strategies

| Strategy | Complexity | Effectiveness | Our Choice |
|----------|------------|---------------|------------|
| **Prompt refinement** | Low | Medium | ✅ Phase 1 |
| **Example injection** | Medium | High | ✅ Phase 2 |
| **RAG over feedback** | Medium | High | ✅ Phase 2 |
| **Fine-tuning** | High | Very High | ❌ Future |

**Phase 1: Prompt Refinement**
- Store which prompts got positive feedback
- Use successful prompts as templates
- A/B test different prompt styles

**Phase 2: Example Injection**
- "For similar code, users accepted this fix..."
- Include positive examples in context
- Weight recent feedback higher

---

## 💰 Cost Analysis

### Monthly Costs (Current Plan)

| Service | Cost | Notes |
|---------|------|-------|
| Gemini API | ₹0 | Free tier |
| Groq API | ₹0 | Free tier |
| ChromaDB | ₹0 | Self-hosted |
| MongoDB Atlas | ₹0 | Free tier (512MB) |
| Domain | ₹500/year | ~₹42/month |
| VPS (later) | ₹500-1000 | When needed |

**Total: ₹0-500/month** ✅ Within budget

### Scaling Costs (When Successful)

| Scale | Monthly Cost | Notes |
|-------|--------------|-------|
| 10 users, 100 repos | ₹0 | Free tiers sufficient |
| 100 users, 1000 repos | ₹2000-5000 | Small VPS needed |
| 1000 users, 10000 repos | ₹15000-30000 | Multiple VPS, paid APIs |

---

## 📅 Phase-wise Implementation

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Gemini Embeddings integration
- [ ] Integrate ChromaDB
- [ ] Basic file chunking (sliding window)
- [ ] Repository indexing queue
- [ ] Simple RAG context builder

### Phase 2: Intelligence (Week 3-4)
- [ ] AST-based chunking (tree-sitter)
- [ ] Stack detection (MERN, Django, etc.)
- [ ] Multi-tier AI processing
- [ ] Enhanced RAG with dependencies
- [ ] Basic feedback collection

### Phase 3: Learning (Week 5-6)
- [ ] Feedback storage in vector DB
- [ ] Prompt refinement based on feedback
- [ ] Example injection in prompts
- [ ] Dashboard for learning insights

### Phase 4: Polish (Week 7-8)
- [ ] Performance optimization
- [ ] Rate limit handling
- [ ] Error recovery
- [ ] Documentation
- [ ] Marketing/landing page

---

## ❓ Open Questions & Decisions

### Questions for You

1. **Incremental Indexing Priority:**
   - Index on app installation (proactive)?
   - Index on first PR (lazy)?
   - Both (hybrid)?
   
2. **Feedback UI:**
   - Thumbs up/down on PR comments?
   - Dashboard feedback form?
   - Both?

3. **Auto-merge Defaults:**
   - Off by default (safer)?
   - On for "safe" fixes only?
   - User configures during installation?

4. **Stack Detection:**
   - Auto-detect only?
   - Let user configure/override?
   - Suggest and confirm?

5. **Free Tier Limits:**
   - Unlimited repos, rate limited?
   - 5 repos, unlimited reviews?
   - Token-based (like current)?

### Technical Decisions to Make

1. **Chunking Library:**
   - Custom implementation with tree-sitter?
   - LangChain text splitters?
   - Hybrid approach?

2. **ChromaDB Deployment:**
   - In-process (same Node.js)?
   - Docker container (separate)?
   - Cloud service (later)?

3. **Queue Priority Algorithm:**
   - Simple FIFO with priority?
   - Weighted fair queuing?
   - Rate limiting per user?

---

## 📝 Quick Reference

### Free Services We're Using

| Service | Used For | Rate Limit |
|---------|----------|------------|
| Gemini text-embedding-004 | Embeddings | 1500/day |
| Gemini Flash | Simple AI tasks | 15 req/min |
| Gemini Pro | Complex AI tasks | 60 req/min |
| Groq Llama-3-70b | Medium AI tasks | 30 req/min |
| MongoDB Atlas | Database | 512MB |
| ChromaDB | Vector store | Unlimited (self-hosted) |

### Key Files to Create

```
shared/
├── embeddings/
│   ├── geminiEmbeddings.js    # Gemini embedding client
│   └── embeddingService.js    # Abstraction layer
├── vectorStore/
│   ├── chromaClient.js        # ChromaDB connection
│   └── vectorService.js       # CRUD operations
├── rag/
│   ├── contextBuilder.js      # Build review context
│   └── ragService.js          # RAG orchestration
├── indexer/
│   ├── repoIndexer.js         # Index repositories
│   ├── chunker.js             # Code chunking
│   └── stackDetector.js       # Detect MERN, Django, etc.
└── learning/
    ├── feedbackCollector.js   # Collect user feedback
    └── learningService.js     # Apply learning
```

---

## 🎯 Summary

**What we're building:** A smarter CodeRabbit alternative that:
1. Actually understands your codebase (RAG)
2. Is completely free for small teams
3. Has auto-fix that creates real PRs
4. Learns and improves over time
5. Has a beautiful web dashboard

**Key technology choices:**
- Embeddings: Gemini (free, high quality)
- Vector DB: ChromaDB (free, easy, scalable enough)
- AI: Multi-tier (Flash → Groq → Pro)
- Chunking: Custom AST-based

**Budget:** ₹0-500/month ✅

---

*Created: 2026-01-10*
*Version: 2.0 Planning Document*
