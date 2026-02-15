# Workflow: First-Time PR Analysis (Complete Flow)

> **Purpose**: Detailed step-by-step flow when PR is opened for the FIRST time  
> **User Feedback**: "only first time", "scan for every this type of thing u get it right?", "make sure the graph has to be accurate"

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    GITHUB PR OPENED EVENT                        │
│                                                                  │
│  Payload: {repo, prNumber, installationId, user}                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1: CLONE REPOSITORY (FIRST TIME ONLY)                      │
│                                                                   │
│  Check: Does /tmp/peer-{repoHash} exist?                         │
│    ❌ NO:  Full clone (git clone)                                │
│    ✅ YES: Skip clone, just fetch PR (git fetch)                 │
│                                                                   │
│  Location: /tmp/peer-{md5(repoUrl)}                              │
│  Checkout: PR branch (pull/{prNumber}/head)                      │
│                                                                   │
│  Duration: 5-30 seconds (first time), 1-5 seconds (updates)      │
└─────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2: DETECT STACK (ALL FILE TYPES)                           │
│                                                                   │
│  Scans for ALL these files:                                      │
│  ✅ package.json      → Node.js                                  │
│  ✅ requirements.txt  → Python                                   │
│  ✅ pom.xml           → Java/Maven                               │
│  ✅ build.gradle      → Java/Gradle                              │
│  ✅ go.mod            → Go                                       │
│  ✅ Cargo.toml        → Rust                                     │
│  ✅ composer.json     → PHP                                      │
│  ✅ Gemfile           → Ruby                                     │
│  ✅ *.csproj          → C#                                       │
│  ✅ Dockerfile        → Docker                                   │
│  ✅ *.tf              → Terraform                                │
│  ✅ *.yaml (K8s)      → Kubernetes                               │
│                                                                   │
│  Output: {                                                       │
│    languages: ['javascript', 'python'],                          │
│    frameworks: ['react', 'nextjs'],                              │
│    tools: ['docker', 'terraform']                                │
│  }                                                               │
│                                                                   │
│  Duration: <1 second                                             │
└─────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3: ANALYZE IMPORTS/EXPORTS (ACCURATE GRAPH)                │
│                                                                   │
│  For each source file:                                           │
│    1. Parse to AST (using Babel for JS/TS)                       │
│    2. Extract imports: ["./utils", "react"]                      │
│    3. Extract exports: ["default", "MyComponent"]                │
│                                                                   │
│  Build dependency graph:                                         │
│    Nodes: [file1, file2, file3, ...]                             │
│    Edges: [                                                      │
│      {from: "file1.js", to: "file2.js", imports: ["util"]},      │
│      {from: "file2.js", to: "file3.js", imports: ["API"]}        │
│    ]                                                             │
│                                                                   │
│  Accuracy Checks:                                                │
│    ✅ Detect circular dependencies                               │
│    ✅ Validate import paths resolve                              │
│    ✅ Check for missing exports                                  │
│                                                                   │
│  Store in: prRun.dependencyGraph                                 │
│                                                                   │
│  Duration: 2-10 seconds                                          │
└─────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 4: RUN ALL 9 STATIC ANALYZERS (PARALLEL)                   │
│                                                                   │
│  ┌─────────────────────────────────────────────────┐             │
│  │  PARALLEL EXECUTION (all run simultaneously)    │             │
│  ├─────────────────────────────────────────────────┤             │
│  │ 1. npm audit       → Node.js dependencies       │             │
│  │ 2. pip-audit       → Python dependencies        │             │
│  │ 3. TruffleHog      → Secret scanning            │             │
│  │ 4. ESLint          → JS/TS linting              │             │
│  │ 5. Semgrep         → Multi-lang security        │             │
│  │ 6. Bandit          → Python security            │             │
│  │ 7. Hadolint        → Dockerfile linting         │             │
│  │ 8. Checkov         → IaC security               │             │
│  │ 9. PMD             → Java quality               │             │
│  └─────────────────────────────────────────────────┘             │
│                                                                   │
│  Each analyzer returns: [                                        │
│    {                                                             │
│      severity: 'high',                                           │
│      category: 'security',                                       │
│      message: 'SQL injection vulnerability',                     │
│      file: 'src/api.js',                                         │
│      line: 42                                                    │
│    },                                                            │
│    ...                                                           │
│  ]                                                                │
│                                                                   │
│  Duration: 10-45 seconds (depends on repo size)                  │
└─────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5: AGGREGATE & DEDUPLICATE FINDINGS                        │
│                                                                   │
│  Combine: merge all analyzer outputs                             │
│  Dedupe: remove duplicates (same file+line+message)              │
│  Normalize: severity levels (low/medium/high/critical)           │
│                                                                   │
│  Create Finding documents:                                       │
│    await Finding.insertMany(findings);                           │
│                                                                   │
│  Link to PRRun:                                                  │
│    prRun.totalFindings = findings.length;                        │
│    await prRun.save();                                           │
│                                                                   │
│  Duration: 1-2 seconds                                           │
└─────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 6: GENERATE EMBEDDINGS (QUEUE)                             │
│                                                                   │
│  For each finding:                                               │
│    embeddingQueue.add('generate', {                              │
│      findingId: finding._id                                      │
│    });                                                           │
│                                                                   │
│  Embedding Worker (async):                                       │
│    1. Format finding: file + severity + message + code snippet   │
│    2. Call Voyage AI: voyage-code-3 model                        │
│    3. Get 1024-dim vector                                        │
│    4. Store in Qdrant: id = emb_{findingId}                      │
│    5. Update Finding: embeddingGenerated = true                  │
│                                                                   │
│  Duration: 5-15 seconds (batched, async)                         │
└─────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 7: CLASSIFY ERROR COMPLEXITY                               │
│                                                                   │
│  For each finding, calculate score (1-10):                       │
│    score = 0                                                     │
│    if severity == 'critical': score += 4                         │
│    if severity == 'high': score += 3                             │
│    if severity == 'medium': score += 2                           │
│    if severity == 'low': score += 1                              │
│    if category == 'security': score += 2                         │
│    if affectedFiles > 1: score += 3                              │
│    if message.length > 200: score += 1                           │
│                                                                   │
│  Classification:                                                 │
│    score < 5: SIMPLE (direct LLM)                                │
│    score ≥ 5: COMPLEX (RAG + LLM)                                │
│                                                                   │
│  Duration: <1 second                                             │
└─────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 8: AUTO-FIX PROCESSING (QUEUE)                             │
│                                                                   │
│  For SIMPLE findings:                                            │
│    Context: {                                                    │
│      file: content,                                              │
│      finding: details                                            │
│    }                                                             │
│    → Send to Groq/Gemini                                         │
│    → Generate fix                                                │
│                                                                   │
│  For COMPLEX findings:                                           │
│    1. FIRST: Query Qdrant for similar findings                   │
│    2. Retrieve top 5 (similarity > 0.75)                         │
│    3. Build enhanced context: {                                  │
│         currentFinding: details,                                 │
│         dependencyGraph: from Step 3,                            │
│         similarIssues: [                                         │
│           {finding: ..., howItWasFixed: ...},                    │
│           ...                                                    │
│         ]                                                        │
│       }                                                          │
│    4. Send to LLM with RAG context                               │
│    5. Generate better fix                                        │
│                                                                   │
│  Duration: 5-20 seconds per finding                              │
└─────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 9: CREATE FIX PR                                           │
│                                                                   │
│  1. Apply fixes to files                                         │
│  2. Create new branch: peer-fixes-{timestamp}                    │
│  3. Commit: "Auto-fixes from Peer analysis"                      │
│  4. Push to GitHub                                               │
│  5. Create PR with detailed description                          │
│                                                                   │
│  Duration: 3-5 seconds                                           │
└─────────────────────┬────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 10: SAVE RECORDING & CLEANUP                               │
│                                                                   │
│  Save analysis recording:                                        │
│    recordingManager.saveRecording(sessionId, {                   │
│      ...allStepsData                                             │
│    });                                                           │
│                                                                   │
│  Cleanup: rm -rf /tmp/peer-{repoHash}                            │
│    ❌ DELETE cloned repo (privacy + disk space)                  │
│    ✅ KEEP recording JSON (debugging)                            │
│    ✅ KEEP findings in MongoDB                                   │
│                                                                   │
│  Duration: 1 second                                              │
└──────────────────────────────────────────────────────────────────┘
```

## Total Duration Breakdown

| Step | Action | Duration |
|------|--------|----------|
| 1 | Clone | 5-30s (first time), 1-5s (updates) |
| 2 | Detect stack | <1s |
| 3 | Analyze imports | 2-10s |
| 4 | Run analyzers | 10-45s |
| 5 | Aggregate | 1-2s |
| 6 | Queue embeddings | <1s (async worker) |
| 7 | Classify | <1s |
| 8 | Auto-fix | 5-20s per finding |
| 9 | Create PR | 3-5s |
| 10 | Cleanup | 1s |
| **TOTAL** | **First time** | **30-90 seconds** |
| **TOTAL** | **Updates** | **15-45 seconds** |

## User Feedback Addressed

### 1. "only first time" (clone)
✅ Implemented incremental cloning - full clone only on first PR, fetch updates after

### 2. "scan for every this type of thing u get it right?"
✅ Stack detection scans for 12 file types (all major languages)

### 3. "make sure the graph has to be accurate"
✅ Dependency graph includes:
- Circular dependency detection
- Import path validation
- Missing export detection
- AST-based parsing (not regex)

**Module: First-Time Workflow Complete!** ✅
