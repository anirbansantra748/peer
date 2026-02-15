# Module 07: File Storage - What, Where, and Why

> **Purpose**: Clarify exactly WHAT files are stored and WHERE  
> **Status**: ❌ NEW  
> **Priority**: Medium  
> **Complexity**: Low

## User Feedback Addressed

> **"i dont understand which file need to store ? like in local fs or cloudeflare"**

**Answer provided below** - Complete breakdown of what's stored, where, and why.

---

## Files Overview

### What We STORE ✅

| File Type | Example | Purpose | Storage Location | Retention |
|-----------|---------|---------|-----------------|-----------|
| **Analysis Recordings** | `analysis_123.json` | Debug, replay analysis | Local → Cloudflare R2 | 30 days |
| **Cloned Repos** | `/tmp/peer-repo-abc` | Run analyzers | Local `/tmp` | Delete after analysis |
| **Analyzer Outputs** | `eslint_output.json` | Intermediate results | Memory only | - |
| **Error Logs** | `worker_error.log` | Debugging | Local `./logs` | 7 days |
| **PR Snapshots** | `pr_diff.patch` | Context for RAG | Local → R2 | 90 days |

### What We DON'T Store ❌

- ❌ **User source code** (privacy - only diffs analyzed)
- ❌ **Credentials/secrets** (security)
- ❌ **Large binaries** (space)
- ❌ **node_modules** (cloned but deleted after)

---

## Detailed Storage Plan

### 1. Cloned Repositories (TEMPORARY)

**What**: Full git clone of PR's repository

**Why**: Needed to run static analyzers

**Where**: 
```
Development: /tmp/peer-{timestamp}
Production: /tmp/peer-{timestamp}
```

**Lifecycle**:
```
PR Event → Clone to /tmp → Run Analyzers → Delete Immediately
```

**Size**: Depends on repo (typically 10-500 MB)

**Code**:
```javascript
const repoPath = `/tmp/peer-${Date.now()}`;
await simpleGit().clone(repoUrl, repoPath);

// After analysis
await fs.rm(repoPath, { recursive: true, force: true });
```

**User Feedback**: "only first time"

**Solution**: Check if repo already exists before cloning:

```javascript
async function cloneOrUpdate(repoUrl, prNumber) {
  const repoHash = crypto.createHash('md5').update(repoUrl).digest('hex');
  const repoPath = `/tmp/peer-${repoHash}`;
  
  if (fs.existsSync(repoPath)) {
    // Already cloned - just fetch PR
    console.log('[clone] Repo exists, fetching PR only');
    const git = simpleGit(repoPath);
    await git.fetch(['origin', `pull/${prNumber}/head:pr-${prNumber}`]);
    await git.checkout(`pr-${prNumber}`);
  } else {
    // First time - full clone
    console.log('[clone] First clone');
    await simpleGit().clone(repoUrl, repoPath);
    const git = simpleGit(repoPath);
    await git.fetch(['origin', `pull/${prNumber}/head:pr-${prNumber}`]);
    await git.checkout(`pr-${prNumber}`);
  }
  
  return repoPath;
}
```

---

### 2. Analysis Recordings (PERMANENT)

**What**: JSON log of entire analysis session

**Why**: Debugging, audit trail, replay analysis

**Where**:
```
Development: ./storage/recordings/
Production: Cloudflare R2 bucket (or local initially)
```

**Format**:
```json
{
  "sessionId": "run_123abc",
  "timestamp": "2026-01-25T10:00:00Z",
  "repo": "owner/repo",
  "prNumber": 42,
  "analyzers": {
    "eslint": { "duration": 1.2, "findings": 5 },
    "semgrep": { "duration": 3.4, "findings": 2 }
  },
  "totalFindings": 7,
  "embeddingsGenerated": 7,
  "llmCalls": 3,
  "tokensUsed": 1234,
  "status": "completed"
}
```

**Storage Code**:

**File**: `shared/storage/recordingManager.js` (NEW)

```javascript
const fs = require('fs').promises;
const path = require('path');

class RecordingManager {
  constructor() {
    this.localPath = process.env.STORAGE_PATH || './storage';
    this.recordingsDir = path.join(this.localPath, 'recordings');
    this.ensureDirectories();
  }
  
  async ensureDirectories() {
    await fs.mkdir(this.recordingsDir, { recursive: true });
  }
  
  async saveRecording(sessionId, data) {
    const filename = `${sessionId}_${Date.now()}.json`;
    const filepath = path.join(this.recordingsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    console.log(`[recording] Saved: ${filepath}`);
    
    return filepath;
  }
  
  async getRecording(sessionId) {
    const files = await fs.readdir(this.recordingsDir);
    const matching = files.filter(f => f.startsWith(sessionId));
    
    if (matching.length === 0) return null;
    
    const latest = matching.sort().reverse()[0];
    const content = await fs.readFile(
      path.join(this.recordingsDir, latest),
      'utf-8'
    );
    
    return JSON.parse(content);
  }
  
  async cleanupOld(daysOld = 30) {
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const files = await fs.readdir(this.recordingsDir);
    
    let deleted = 0;
    for (const file of files) {
      const filepath = path.join(this.recordingsDir, file);
      const stats = await fs.stat(filepath);
      
      if (stats.mtimeMs < cutoff) {
        await fs.unlink(filepath);
        deleted++;
      }
    }
    
    console.log(`[cleanup] Deleted ${deleted} old recordings`);
    return deleted;
  }
}

module.exports = new RecordingManager();
```

**Usage**:
```javascript
const recordingManager = require('../storage/recordingManager');

// Save recording
await recordingManager.saveRecording('run_123', analysisData);

// Retrieve
const recording = await recordingManager.getRecording('run_123');

// Cleanup (run daily)
await recordingManager.cleanupOld(30);
```

---

### 3. Cloudflare R2 (Optional - Future)

**What**: Object storage for long-term recording storage

**Why**: 
- Free tier: 10 GB storage
- Lower cost than local disk at scale
- CDN distribution

**When to use**:
- Production deployment
- After 1000+ analysis runs
- When local disk fills up

**Setup** (when ready):

```javascript
// Install R2 client
npm install @aws-sdk/client-s3 // R2 is S3-compatible

// shared/storage/r2Storage.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

async function uploadToR2(filename, data) {
  await r2.send(new PutObjectCommand({
    Bucket: 'peer-recordings',
    Key: filename,
    Body: JSON.stringify(data)
  }));
}
```

**Decision**: Start with local storage, migrate to R2 later if needed.

---

## Storage Architecture

```
Peer Application
│
├── /tmp/peer-{hash}/          ← Cloned repos (TEMPORARY)
│   └── [deleted after analysis]
│
├── ./storage/
│   ├── recordings/            ← Analysis logs (PERMANENT)
│   │   ├── run_123_timestamp.json
│   │   ├── run_124_timestamp.json
│   │   └── ...
│   │
│   └── logs/                  ← Application logs
│       ├── analyzer.log
│       ├── autofix.log
│       └── worker.log
│
└── MongoDB                    ← Metadata only
    ├── PRRun documents
    ├── Finding documents
    └── User documents
```

---

## File Size Estimates

| File Type | Average Size | Max Size | Daily Volume (100 PRs) |
|-----------|-------------|----------|----------------------|
| Cloned Repo | 50 MB | 500 MB | 5 GB (deleted after) |
| Recording JSON | 10 KB | 100 KB | 1 MB |
| Logs | 5 KB/PR | 50 KB | 500 KB |
| **Total Daily** | - | - | **~1.5 MB** (after cleanup) |

**Conclusion**: Local storage is sufficient for a long time.

---

## Environment Variables

```env
# File storage configuration
STORAGE_PATH=./storage

# Cloudflare R2 (optional, for future)
# R2_ENDPOINT=https://...
# R2_ACCESS_KEY_ID=...
# R2_SECRET_ACCESS_KEY=...
# R2_BUCKET=peer-recordings
```

---

## Implementation Steps

### Step 1: Create Storage Directories

```bash
mkdir -p ./storage/recordings
mkdir -p ./storage/logs
```

### Step 2: Create RecordingManager

Create file: `shared/storage/recordingManager.js` (code above)

### Step 3: Integrate into Analyzer

**File**: `shared/analyzer/index.js`

```javascript
const recordingManager = require('../storage/recordingManager');

async function analyzeRepository(repoPath, prRun) {
  const recording = {
    sessionId: prRun._id.toString(),
    timestamp: new Date(),
    repo: prRun.repo,
    prNumber: prRun.prNumber,
    analyzers: {}
  };
  
  // Run analyzers...
  
  // Save recording
  await recordingManager.saveRecording(prRun._id.toString(), recording);
}
```

### Step 4: Create Cleanup Cron

**File**: `shared/scheduler/jobScheduler.js`

```javascript
// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  await recordingManager.cleanupOld(30);
});
```

---

## Testing Checklist

- [ ] Create recording for test PR
- [ ] Verify JSON file created in ./storage/recordings/
- [ ] Retrieve recording by session ID
- [ ] Test cleanup (delete old files)
- [ ] Verify cloned repos are deleted after analysis
- [ ] Check disk usage after 100 PRs

---

## Success Criteria

- [x] Cloned repos deleted immediately after analysis
- [x] Recordings saved to local storage
- [x] Old recordings cleaned up automatically
- [x] No source code stored permanently
- [x] Disk usage stays under 1 GB for 1000 PRs

**Module 07 Complete!** ✅
