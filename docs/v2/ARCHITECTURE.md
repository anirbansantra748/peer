# 🏗️ Peer Architecture - Complete Module Breakdown & Implementation Plan

> **100% Free Tech Stack** - No paid services, all hosted solutions, no local models

![Architecture Diagram](docs/architecture-diagram.png)

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Module Status Matrix](#module-status-matrix)
3. [Free Tech Stack](#free-tech-stack)
4. [Module Details](#module-details)
5. [Implementation Approach](#implementation-approach)
6. [Setup Instructions](#setup-instructions)

---

## 🎯 Architecture Overview

**Peer** is an AI-powered code review platform with RAG (Retrieval Augmented Generation) capabilities. The system analyzes pull requests, generates embeddings for semantic search, and provides intelligent auto-fixes using context from historical data.

### System Flow

```
Browser → Load Balancer → Authentication → Route Handler
                                              ↓
                                    ┌─────────┴──────────┐
                                    ↓                    ↓
                              Redis Queue         MongoDB Store
                                    ↓                    ↓
                        ┌───────────┴────────┐      [User Data]
                        ↓                    ↓      [PR Runs]
                  Analyzer Worker      Autofix Worker
                        ↓                    ↓
                  [Get Findings]    [Small Error? → Direct LLM]
                        ↓            [Complex Error? → RAG + LLM]
                        ↓                    ↓
               [Generate Embeddings]   [Query Vector DB]
                        ↓                    ↓
                  [Store in Qdrant]    [Build Context]
                                            ↓
                                   [LLM Processing (Groq/Gemini/OpenAI)]
                                            ↓
                                      [Create PR with Fixes]
```

### Key Components

1. **Frontend & API Layer** - Express.js server with EJS templates
2. **Authentication** - GitHub OAuth via Passport.js
3. **Queue System** - BullMQ with Redis for job management
4. **Database** - MongoDB for persistent storage
5. **Analysis Engine** - Multi-language static analyzers
6. **RAG System** - Vector embeddings + semantic search
7. **LLM Integration** - Multi-provider fallback (Groq, Gemini, OpenAI)
8. **File Storage** - Local/cloud storage for recordings
9. **Scheduler** - Cron jobs for maintenance tasks

---

## 📊 Module Status Matrix

| Module | Status | Priority | Complexity |
|--------|--------|----------|-----------|
| **1. Browser/Entry Point** | ✅ Done | - | Low |
| **2. Load Balancer** | ⏸️ Optional | Low | Medium |
| **3. Request/Entry (Express)** | ✅ Done | - | Low |
| **4. Authentication (Passport.js)** | ✅ Done | - | Medium |
| **5. Route Handler** | ✅ Done | - | Low |
| **6. Redis Queue (BullMQ)** | ✅ Done | - | Medium |
| **7. MongoDB Models** | ✅ Done | - | Medium |
| **8. Analyzer Worker** | ✅ Done | - | High |
| **9. Autofix Worker** | ✅ Done | - | High |
| **10. LLM Integration** | ✅ Done | - | High |
| **11. Error Classification** | 🔄 Partial | **High** | Medium |
| **12. RAG System** | ❌ New | **High** | High |
| **13. Embeddings Generation** | ❌ New | **High** | Medium |
| **14. Vector Database (Qdrant)** | ❌ New | **High** | Medium |
| **15. File + Recordings Storage** | 🔄 Partial | **Medium** | Low |
| **16. Store Scheduling** | ❌ New | **Medium** | Low |
| **17. Mongo DB (Extended Models)** | ❌ New | **Medium** | Low |
| **18. Payment Service** | ✅ Done | - | Medium |

**Legend:**
- ✅ Done: Fully implemented
- 🔄 Partial: Exists but needs enhancement
- ❌ New: Needs to be built
- ⏸️ Optional: Can be added later

---

## 💰 Free Tech Stack

### Core Infrastructure (Existing ✅)

| Component | Technology | Free Tier | Status |
|-----------|-----------|-----------|--------|
| **Runtime** | Node.js 22.x | Free & Open Source | ✅ |
| **Web Framework** | Express.js 5.x | Free & Open Source | ✅ |
| **Database** | MongoDB Atlas | 512 MB Free Cluster | ✅ |
| **Cache/Queue** | Redis Cloud | 30 MB Free | ✅ |
| **Auth** | Passport.js + GitHub OAuth | Free | ✅ |
| **Hosting** | Render.com | Free tier (750 hrs/month) | ✅ |

### NEW Components (To Be Added 🔄)

#### 1. Vector Database: **Qdrant Cloud** ⭐ RECOMMENDED

**Why Qdrant?**
- ✅ **1 GB Free Forever** - No credit card required
- ✅ Hosted solution (no local setup)
- ✅ Multi-cloud, horizontal scaling included
- ✅ High-performance filtering (perfect for metadata + vectors)
- ✅ Built-in monitoring and backups
- ✅ REST API + Official Node.js client

**Free Tier Details:**
- Storage: 1 GB free cluster
- Vectors: ~1M vectors (768-dim embeddings)
- Features: Full managed cluster, HA, monitoring

**Alternatives Considered:**
- ChromaDB Cloud: Only $5 credits (not perpetual)
- Weaviate: 14-day trial only
- Pinecone: No free tier anymore

#### 2. Embedding Generation: **Voyage AI** ⭐ RECOMMENDED

**Why Voyage AI?**
- ✅ **200 Million Tokens Free** - Enough for ~200K code snippets
- ✅ State-of-the-art `voyage-code-3` model for code
- ✅ REST API (no SDK dependency)
- ✅ 1024-dimension embeddings (efficient)

**Free Tier Details:**
- Models: `voyage-code-3`, `voyage-3-large`, `voyage-3.5`
- Tokens: 200M free for code models
- No credit card required

**Alternatives Considered:**
- Cohere: Only 1000 API calls/month (too limited)
- Together AI: No explicit free tier
- OpenAI: Costs $0.02/1M tokens (we want free)

#### 3. RAG Framework: **LangChain.js** ⭐ RECOMMENDED

**Why LangChain?**
- ✅ Free & Open Source
- ✅ Built-in Qdrant integration
- ✅ Document splitters for code
- ✅ RAG pipelines out-of-the-box
- ✅ Large community, great docs

**Features We'll Use:**
- Text splitters (RecursiveCharacterTextSplitter)
- Vector store (QdrantVectorStore)
- Retrieval chains
- Memory management

**Alternative:** LlamaIndex (also good, but LangChain has better Node.js support)

#### 4. File Storage: **Local FS + Cloudflare R2** (Optional)

**Initial:** Local file system (free, simple)
**Future:** Cloudflare R2 (10 GB free storage)

---

## 🔧 Module Details

### Module 1-9: Already Implemented ✅

These modules are production-ready:
- Express.js API server with health checks
- GitHub OAuth authentication
- Redis-backed BullMQ job queues
- MongoDB models (User, Installation, PRRun, PaymentTransaction)
- Multi-language analyzer (ESLint, Semgrep, Bandit, PMD, etc.)
- Autofix worker with multi-LLM support
- UI dashboard with analytics

**No changes needed** - These serve as the foundation.

---

### Module 10: Enhanced LLM Integration 🔄

**Current State:**
- Multi-provider support: Groq, Gemini, OpenAI
- Intelligent fallback system
- Token tracking and budget management
- Response caching

**Enhancement Needed:**
Add context switching based on error complexity:

```javascript
// shared/llm/contextRouter.js (NEW)

async function buildLLMContext(finding, prRun) {
  const complexity = classifyErrorComplexity(finding);
  
  if (complexity < 5) {
    // Simple error: Direct LLM
    return {
      type: 'simple',
      context: buildSimpleContext(finding, prRun)
    };
  } else {
    // Complex error: RAG-enhanced
    const similarFindings = await queryRAG(finding);
    return {
      type: 'complex',
      context: buildRAGContext(finding, similarFindings, prRun)
    };
  }
}

function classifyErrorComplexity(finding) {
  let score = 0;
  
  // Severity factor
  if (finding.severity === 'critical') score += 4;
  else if (finding.severity === 'high') score += 3;
  else if (finding.severity === 'medium') score += 2;
  else score += 1;
  
  // Multi-file errors are complex
  if (finding.affectedFiles?.length > 1) score += 3;
  
  // Security issues are complex
  if (finding.category === 'security') score += 2;
  
  // Long error messages indicate complexity
  if (finding.message.length > 200) score += 1;
  
  return Math.min(score, 10); // Cap at 10
}
```

**Status:** 🔄 Needs implementation  
**Files to modify:**
- `shared/autofix/autofixer.js`
- Create `shared/llm/contextRouter.js`

---

### Module 11: Error Classification System ❌

**Purpose:** Intelligently route errors to appropriate LLM strategies

**Implementation:**

```javascript
// shared/analyzer/errorClassifier.js (NEW)

const ErrorComplexity = {
  TRIVIAL: 1,      // Formatting, unused imports
  SIMPLE: 3,       // Simple logic errors, single-file fixes
  MODERATE: 5,     // Multi-line changes, some context needed
  COMPLEX: 7,      // Multi-file, architectural issues
  CRITICAL: 10     // Security vulnerabilities, system-wide changes
};

class ErrorClassifier {
  classify(finding, prContext) {
    const features = this.extractFeatures(finding, prContext);
    const score = this.calculateComplexityScore(features);
    return this.getComplexityLevel(score);
  }
  
  extractFeatures(finding, prContext) {
    return {
      severity: finding.severity,
      category: finding.category,
      fileCount: finding.affectedFiles?.length || 1,
      linesChanged: finding.linesChanged || 0,
      hasSecurityImplications: this.isSecurityRelated(finding),
      requiresArchitecturalChange: this.needsArchitecturalChange(finding),
      messageLength: finding.message.length
    };
  }
  
  // ... more methods
}
```

**Status:** ❌ New module  
**Estimated effort:** 4-6 hours

---

### Module 12: RAG System (Core) ❌

**Purpose:** Retrieve similar historical findings to enhance LLM context

**Architecture:**

```
Code Finding → Generate Embedding → Query Qdrant → Retrieve Top-K Similar
                                                          ↓
                                                   Build Enhanced Context
                                                          ↓
                                                   Feed to LLM
```

**Implementation:**

```javascript
// shared/rag/ragSystem.js (NEW)

const { QdrantClient } = require('@qdrant/js-client-rest');
const { VoyageEmbeddings } = require('@langchain/community/embeddings/voyage');

class RAGSystem {
  constructor() {
    this.qdrant = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY
    });
    
    this.embeddings = new VoyageEmbeddings({
      apiKey: process.env.VOYAGE_API_KEY,
      modelName: 'voyage-code-3'
    });
  }
  
  async storeFinding(finding, embedding) {
    await this.qdrant.upsert('code-findings', {
      points: [{
        id: finding._id.toString(),
        vector: embedding,
        payload: {
          severity: finding.severity,
          category: finding.category,
          message: finding.message,
          file: finding.file,
          repo: finding.repo,
          fixApplied: finding.fixApplied || false,
          createdAt: finding.createdAt
        }
      }]
    });
  }
  
  async querySimilarFindings(finding, topK = 5) {
    const embedding = await this.generateEmbedding(finding);
    
    const results = await this.qdrant.search('code-findings', {
      vector: embedding,
      limit: topK,
      filter: {
        must: [
          { key: 'fixApplied', match: { value: true } }, // Only fixed issues
          { key: 'severity', match: { value: finding.severity } }
        ]
      }
    });
    
    return results.map(r => ({
      score: r.score,
      finding: r.payload,
      relevance: r.score > 0.75 ? 'high' : 'medium'
    }));
  }
  
  async generateEmbedding(finding) {
    const text = this.formatFindingForEmbedding(finding);
    const embeddings = await this.embeddings.embedQuery(text);
    return embeddings;
  }
  
  formatFindingForEmbedding(finding) {
    // Combine relevant fields into searchable text
    return `
      Severity: ${finding.severity}
      Category: ${finding.category}
      Message: ${finding.message}
      File: ${finding.file}
      Code Snippet: ${finding.snippet || ''}
    `.trim();
  }
}

module.exports = new RAGSystem();
```

**Dependencies to add:**
```bash
npm install @qdrant/js-client-rest @langchain/community langchain
```

**Status:** ❌ New module  
**Estimated effort:** 8-12 hours

---

### Module 13: Embeddings Generation Pipeline ❌

**Purpose:** Asynchronously generate and store embeddings for all findings

**Implementation:**

```javascript
// services/embeddings/embeddingWorker.js (NEW)

const { Worker } = require('bullmq');
const ragSystem = require('../../shared/rag/ragSystem');
const Finding = require('../../shared/models/Finding'); // NEW MODEL

const embeddingWorker = new Worker('embedding-queue', async job => {
  const { findingId } = job.data;
  
  try {
    const finding = await Finding.findById(findingId);
    if (!finding) throw new Error('Finding not found');
    
    // Generate embedding
    const embedding = await ragSystem.generateEmbedding(finding);
    
    // Store in Qdrant
    await ragSystem.storeFinding(finding, embedding);
    
    // Update MongoDB
    finding.embeddingGenerated = true;
    finding.embeddingGeneratedAt = new Date();
    await finding.save();
    
    return { success: true, findingId };
  } catch (error) {
    console.error('[embedding-worker] Error:', error);
    throw error;
  }
}, {
  connection: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  },
  concurrency: 3 // Process 3 embeddings concurrently
});

module.exports = embeddingWorker;
```

**Queue Setup:**

```javascript
// shared/queue/index.js (MODIFY)

const { Queue } = require('bullmq');

// Add new queue
const embeddingQueue = new Queue('embedding-queue', { connection });

// Helper function
async function queueEmbeddingGeneration(findingId) {
  await embeddingQueue.add('generate-embedding', { findingId });
}

module.exports = {
  analyzeQueue,
  autofixQueue,
  embeddingQueue, // NEW
  queueEmbeddingGeneration // NEW
};
```

**Integration Point:**

In `shared/analyzer/index.js`, after findings are created:

```javascript
// After saving findings to MongoDB
for (const finding of findings) {
  await queueEmbeddingGeneration(finding._id);
}
```

**Status:** ❌ New module  
**Estimated effort:** 4-6 hours

---

### Module 14: Vector Database (Qdrant) Setup ❌

**Purpose:** Managed vector storage for semantic search

**Setup Steps:**

1. **Create Qdrant Cloud Account:**
   - Visit: https://qdrant.tech/
   - Sign up with GitHub (free, no credit card)
   - Create free cluster (1 GB)

2. **Initialize Collection:**

```javascript
// scripts/init-qdrant.js (NEW)

const { QdrantClient } = require('@qdrant/js-client-rest');

async function initializeQdrant() {
  const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY
  });
  
  // Create collection for code findings
  await client.createCollection('code-findings', {
    vectors: {
      size: 1024, // Voyage AI voyage-code-3 dimension
      distance: 'Cosine'
    },
    optimizers_config: {
      indexing_threshold: 10000
    }
  });
  
  // Create indexes for filtering
  await client.createPayloadIndex('code-findings', {
    field_name: 'severity',
    field_schema: 'keyword'
  });
  
  await client.createPayloadIndex('code-findings', {
    field_name: 'category',
    field_schema: 'keyword'
  });
  
  await client.createPayloadIndex('code-findings', {
    field_name: 'fixApplied',
    field_schema: 'bool'
  });
  
  console.log('✅ Qdrant collection initialized');
}

initializeQdrant().catch(console.error);
```

**Run once:**
```bash
node scripts/init-qdrant.js
```

**Environment Variables:**
```env
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-api-key
```

**Status:** ❌ New setup  
**Estimated effort:** 2-3 hours

---

### Module 15: File + Recordings Storage 🔄

**Current State:** Basic local file storage exists in analyzer

**Enhancement Needed:**

```javascript
// shared/storage/storageManager.js (NEW)

const fs = require('fs').promises;
const path = require('path');

class StorageManager {
  constructor() {
    this.basePath = process.env.STORAGE_PATH || './storage';
    this.ensureDirectories();
  }
  
  async ensureDirectories() {
    await fs.mkdir(path.join(this.basePath, 'recordings'), { recursive: true });
    await fs.mkdir(path.join(this.basePath, 'artifacts'), { recursive: true });
  }
  
  async saveRecording(sessionId, data) {
    const filepath = path.join(
      this.basePath,
      'recordings',
      `${sessionId}_${Date.now()}.json`
    );
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    return filepath;
  }
  
  async saveArtifact(filename, buffer) {
    const filepath = path.join(this.basePath, 'artifacts', filename);
    await fs.writeFile(filepath, buffer);
    return filepath;
  }
  
  async getRecording(sessionId) {
    // Find latest recording for session
    const recordingsDir = path.join(this.basePath, 'recordings');
    const files = await fs.readdir(recordingsDir);
    const matching = files.filter(f => f.startsWith(sessionId));
    
    if (matching.length === 0) return null;
    
    const latest = matching.sort().reverse()[0];
    const content = await fs.readFile(path.join(recordingsDir, latest), 'utf-8');
    return JSON.parse(content);
  }
  
  async cleanupOldRecordings(daysOld = 30) {
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const recordingsDir = path.join(this.basePath, 'recordings');
    const files = await fs.readdir(recordingsDir);
    
    for (const file of files) {
      const filepath = path.join(recordingsDir, file);
      const stats = await fs.stat(filepath);
      
      if (stats.mtimeMs < cutoff) {
        await fs.unlink(filepath);
        console.log(`Deleted old recording: ${file}`);
      }
    }
  }
}

module.exports = new StorageManager();
```

**Status:** 🔄 Enhancement  
**Estimated effort:** 3-4 hours

---

### Module 16: Store Scheduling ❌

**Purpose:** Periodic maintenance tasks (cleanup, indexing, stats)

**Implementation:**

```javascript
// shared/scheduler/jobScheduler.js (NEW)

const cron = require('node-cron');
const storageManager = require('../storage/storageManager');
const ragSystem = require('../rag/ragSystem');

class JobScheduler {
  constructor() {
    this.jobs = [];
  }
  
  start() {
    // Cleanup old recordings daily at 2 AM
    this.jobs.push(cron.schedule('0 2 * * *', async () => {
      console.log('[scheduler] Running cleanup job');
      await storageManager.cleanupOldRecordings(30);
    }));
    
    // RAG index optimization weekly
    this.jobs.push(cron.schedule('0 3 * * 0', async () => {
      console.log('[scheduler] Optimizing RAG index');
      await ragSystem.optimizeIndex();
    }));
    
    // Generate weekly stats
    this.jobs.push(cron.schedule('0 4 * * 1', async () => {
      console.log('[scheduler] Generating weekly stats');
      await this.generateWeeklyStats();
    }));
    
    console.log('[scheduler] All jobs scheduled');
  }
  
  stop() {
    this.jobs.forEach(job => job.stop());
    console.log('[scheduler] All jobs stopped');
  }
  
  async generateWeeklyStats() {
    // Calculate RAG usage, LLM savings, etc.
    // Save to database for dashboard
  }
}

module.exports = new JobScheduler();
```

**Integration:**

In `services/api/server.js`:

```javascript
const scheduler = require('../../shared/scheduler/jobScheduler');

// After MongoDB connection
scheduler.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  scheduler.stop();
  // ... other cleanup
});
```

**Status:** ❌ New module  
**Estimated effort:** 2-3 hours

---

### Module 17: Extended MongoDB Models ❌

**New Model: Finding**

```javascript
// shared/models/Finding.js (NEW)

const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema({
  prRunId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PRRun',
    required: true,
    index: true
  },
  
  // Finding details
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  message: String,
  file: String,
  line: Number,
  snippet: String,
  
  // Metadata
  repo: String,
  installationId: String,
  
  // Fix tracking
  fixApplied: {
    type: Boolean,
    default: false
  },
  fixCommitSha: String,
  fixPrNumber: Number,
  
  // Embedding status
  embeddingGenerated: {
    type: Boolean,
    default: false
  },
  embeddingGeneratedAt: Date,
  
  // RAG metrics
  usedAsContext: {
    type: Number,
    default: 0
  },
  contextRelevanceScore: Number
  
}, { timestamps: true });

// Indexes for efficient queries
findingSchema.index({ severity: 1, fixApplied: 1 });
findingSchema.index({ embeddingGenerated: 1 });
findingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Finding', findingSchema);
```

**Migration Script:**

```javascript
// scripts/migrate-findings.js (NEW)

// Migrate existing findings from PRRun.findings array to separate collection
const PRRun = require('../shared/models/PRRun');
const Finding = require('../shared/models/Finding');

async function migrateFindingsToCollection() {
  const prRuns = await PRRun.find({ 'findings.0': { $exists: true } });
  
  for (const prRun of prRuns) {
    const findings = prRun.findings.map(f => ({
      prRunId: prRun._id,
      severity: f.severity,
      category: f.category || 'unknown',
      message: f.message,
      file: f.file,
      line: f.line,
      snippet: f.snippet,
      repo: prRun.repo,
      installationId: prRun.installationId,
      fixApplied: f.fixStatus === 'fixed',
      fixCommitSha: f.fixCommitSha,
      fixPrNumber: f.fixPrNumber,
      createdAt: prRun.createdAt
    }));
    
    await Finding.insertMany(findings);
    console.log(`Migrated ${findings.length} findings from PRRun ${prRun._id}`);
  }
  
  console.log('✅ Migration complete');
}
```

**Status:** ❌ New model  
**Estimated effort:** 3-4 hours (including migration)

---

## 🚀 Implementation Approach

### Phase 1: Foundation (Week 1)

**Goal:** Set up core infrastructure for RAG system

**Tasks:**
1. ✅ Sign up for Qdrant Cloud (free 1GB cluster)
2. ✅ Sign up for Voyage AI (200M tokens free)
3. ✅ Install dependencies:
   ```bash
   npm install @qdrant/js-client-rest @langchain/community langchain
   ```
4. 🔨 Create Qdrant collection (`scripts/init-qdrant.js`)
5. 🔨 Create `Finding` model
6. 🔨 Run migration script to populate findings
7. 🔨 Test embedding generation with Voyage AI

**Deliverables:**
- Qdrant collection ready
- Finding collection populated
- Embedding API tested

---

### Phase 2: RAG System (Week 2)

**Goal:** Implement core RAG functionality

**Tasks:**
1. 🔨 Create `shared/rag/ragSystem.js`
2. 🔨 Create embedding worker (`services/embeddings/embeddingWorker.js`)
3. 🔨 Add embedding queue to BullMQ
4. 🔨 Integrate embedding generation into analyzer workflow
5. 🔨 Test end-to-end: Finding → Embedding → Qdrant → Query
6. 🔨 Create `shared/llm/contextRouter.js` for error classification

**Deliverables:**
- RAG system generating embeddings
- Semantic search working
- Context routing implemented

---

### Phase 3: LLM Integration (Week 3)

**Goal:** Enhance autofix with RAG context

**Tasks:**
1. 🔨 Modify `shared/autofix/autofixer.js` to use context router
2. 🔨 Create `shared/analyzer/errorClassifier.js`
3. 🔨 Implement complexity scoring algorithm
4. 🔨 Test: Simple errors bypass RAG, complex errors use RAG
5. 🔨 Measure token savings and fix quality improvement

**Deliverables:**
- Autofix using RAG for complex errors
- Metrics showing improvement

---

### Phase 4: Storage & Scheduling (Week 4)

**Goal:** Polish and maintenance features

**Tasks:**
1. 🔨 Create `shared/storage/storageManager.js`
2. 🔨 Create `shared/scheduler/jobScheduler.js`
3. 🔨 Add cleanup job for old recordings
4. 🔨 Add RAG index optimization job
5. 🔨 Create dashboard widgets for RAG metrics

**Deliverables:**
- Storage management working
- Scheduled jobs running
- Dashboard showing RAG stats

---

### Phase 5: Testing & Deployment (Week 5)

**Goal:** Validate and deploy

**Tasks:**
1. 🧪 Write integration tests for RAG system
2. 🧪 Test with real PRs (simple vs complex)
3. 🧪 Load test Qdrant (ensure within free tier limits)
4. 🧪 Monitor LLM token usage (should decrease with RAG)
5. 📊 Create monitoring dashboard
6. 🚀 Deploy to Render

**Deliverables:**
- All tests passing
- System deployed and monitored
- Documentation updated

---

## 📦 Setup Instructions

### Prerequisites

```bash
Node.js >= 18.x
MongoDB Atlas account (free tier)
Redis Cloud account (free tier)
Qdrant Cloud account (free tier)
Voyage AI account (free tier)
```

### Environment Variables

Create `.env` file:

```env
# ─── EXISTING ────────────────────────────────────────────
NODE_ENV=production
PORT=3001

# MongoDB
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/peer

# Redis
REDIS_URL=redis://default:pass@redis-12345.c1.us-east-1-2.ec2.redns.redis-cloud.com:12345

# GitHub App
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_CLIENT_ID=Iv1.abc123
GITHUB_CLIENT_SECRET=secret123
GITHUB_CALLBACK_URL=https://peer-ui.onrender.com/auth/github/callback

# LLMs (at least one required)
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...

# Session
SESSION_SECRET=random-secret-key-here

# ─── NEW (RAG SYSTEM) ─────────────────────────────────────
# Qdrant Vector Database
QDRANT_URL=https://abc-xyz-12345.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key

# Voyage AI Embeddings
VOYAGE_API_KEY=pa-...voyage-api-key...

# RAG Configuration
RAG_SIMILARITY_THRESHOLD=0.75
RAG_TOP_K=5
COMPLEXITY_THRESHOLD=5
ENABLE_RAG=true

# Storage
STORAGE_PATH=./storage

# Scheduling
ENABLE_SCHEDULER=true
```

### Installation

```bash
# Clone repo
git clone https://github.com/anirbansantra748/peer.git
cd peer

# Install dependencies
npm install

# Install new dependencies for RAG
npm install @qdrant/js-client-rest @langchain/community langchain

# Initialize Qdrant collection
node scripts/init-qdrant.js

# Migrate existing findings (if any)
node scripts/migrate-findings.js

# Start services
npm run dev:api       # Terminal 1
npm run dev:analyzer  # Terminal 2
npm run dev:autofix   # Terminal 3
npm run dev:embeddings # Terminal 4 (NEW)
npm run dev:ui        # Terminal 5
```

### Verification

```bash
# Test Qdrant connection
curl $QDRANT_URL/collections/code-findings \
  -H "api-key: $QDRANT_API_KEY"

# Test Voyage AI
curl https://api.voyageai.com/v1/embeddings \
  -H "Authorization: Bearer $VOYAGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": "test code snippet", "model": "voyage-code-3"}'

# Check health endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api/rag/stats
```

---

## 📊 Expected Outcomes

### Performance Improvements

| Metric | Before RAG | After RAG | Improvement |
|--------|-----------|-----------|-------------|
| **LLM Tokens/Fix** | 2000-5000 | 1000-2500 | **50% reduction** |
| **Fix Quality Score** | 70% | 85% | **+15 points** |
| **Time to Fix** | 15-45s | 10-30s | **30% faster** |
| **Context Relevance** | N/A | 80%+ | **New capability** |

### Cost Savings (Using Free Tiers)

| Service | Free Tier | Usage Estimate | Cost |
|---------|-----------|----------------|------|
| **Qdrant** | 1GB | ~500K findings | $0 |
| **Voyage AI** | 200M tokens | ~100K embeddings | $0 |
| **MongoDB Atlas** | 512 MB | User data | $0 |
| **Redis Cloud** | 30 MB | Queue data | $0 |
| **Render** | 750 hrs/month | 4 services | $0 |
| **Total** | - | - | **$0/month** 🎉 |

---

## 🎯 Success Criteria

- [ ] Qdrant cluster storing embeddings
- [ ] Voyage AI generating code embeddings
- [ ] RAG system returning relevant historical findings
- [ ] Error classifier routing correctly
- [ ] Simple errors bypass RAG (faster)
- [ ] Complex errors use RAG (better context)
- [ ] LLM token usage reduced by 30%+
- [ ] Fix quality improved (measurable)
- [ ] All services running on free tiers
- [ ] No cost incurred

---

## 📚 Additional Resources

### Documentation Links

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Voyage AI API Docs](https://docs.voyageai.com/)
- [LangChain.js Guide](https://js.langchain.com/docs/)
- [BullMQ Guide](https://docs.bullmq.io/)
- [MongoDB Atlas Free Tier](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/)

### Code Examples

All implementation examples are inline in this document under "Module Details".

---

## 🤝 Questions?

If you approve this plan, we can proceed with Phase 1 implementation. Let me know if you want to:
1. Adjust priorities
2. Change tech stack choices
3. Add/remove modules
4. Clarify any implementation details

**Ready to build! 🚀**
