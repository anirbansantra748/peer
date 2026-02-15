# 🗓️ Module-by-Module Implementation Guide

> **One Module Per Day** - Complete, test, verify before moving to next  
> **AI: Read this + AI_RULES.md + MEMORY.md before starting each module**

---

## Implementation Order

### Week 1: Foundation & Analysis

| Day | Module | Priority | Complexity | Time Est. |
|-----|--------|----------|------------|-----------|
| 1 | Module 02: Static Analyzers | Critical | Medium | 4-6 hrs |
| 2 | Module 03: Import/Export Analysis | High | Medium | 4-6 hrs |
| 3 | Module 07: File Storage | Medium | Low | 2-3 hrs |
| 4 | Test & Fix Week 1 | - | - | 2-3 hrs |
| 5 | Module 01: Razorpay Token System | High | Medium | 4-6 hrs |

### Week 2: RAG System

| Day | Module | Priority | Complexity | Time Est. |
|-----|--------|----------|------------|-----------|
| 6 | Setup Services (Qdrant, Voyage) | Critical | Low | 1-2 hrs |
| 7 | Module 04: Embedding Pipeline | High | Medium | 4-6 hrs |
| 8 | Module 05: RAG System Core | High | High | 6-8 hrs |
| 9 | Module 06: Error Classifier | Medium | Medium | 3-4 hrs |
| 10 | Test & Fix Week 2 | - | - | 3-4 hrs |

### Week 3: Integration & Polish

| Day | Module | Priority | Complexity | Time Est. |
|-----|--------|----------|------------|-----------|
| 11 | Integrate RAG into Autofix | High | Medium | 4-6 hrs |
| 12 | Module 08: Scheduler | Low | Low | 2-3 hrs |
| 13 | End-to-End Testing | Critical | - | 4-6 hrs |
| 14 | Bug Fixes & Polish | - | - | 4-6 hrs |
| 15 | Documentation & Deploy | Medium | - | 2-3 hrs |

---

## Daily Module Template

Each module day follows this structure:

### Morning (Start of Day)

1. **AI reads these files**:
   - `AI_RULES.md`
   - `MEMORY.md`
   - `modules/XX-module-name.md`

2. **AI confirms with user**:
   > "Today we're working on Module X: [Name]. 
   > According to MEMORY.md, [previous status].
   > Ready to start?"

3. **User approves**: "yes" or "let's start"

### Work Phase

4. **For each step in module**:
   - AI reads existing code
   - Shows what will change (diff)
   - Waits for approval
   - Makes ONE change
   - User tests
   - If works → next step
   - If broken → fix immediately

### End of Day

5. **Verify module complete**:
   - All steps done
   - All tests passed
   - No errors

6. **AI asks**:
   > "Module X complete. All tests passed.
   > Should I update MEMORY.md to mark this complete?"

7. **User says**: "approved" or "update memory"

8. **AI updates MEMORY.md**

---

## Module Summaries

### Module 02: Static Analyzers (Day 1)

**What**: Install and configure 4 new analyzers (pip-audit, TruffleHog, Hadolint, Checkov)

**Steps**:
1. Install TruffleHog globally
2. Install Hadolint binary
3. Install Checkov via pip
4. Create `pythonDependencies.js`
5. Create `secretScanner.js`
6. Create `dockerLinter.js`
7. Create `iacScanner.js`
8. Integrate into main analyzer
9. Test each analyzer individually
10. Test all running together

**Success Criteria**:
- All 9 analyzers run without errors
- Each detects issues correctly
- Findings stored in MongoDB
- No performance degradation

**Rollback**: Keep original `analyzer/index.js` as backup

---

### Module 03: Import/Export Analysis (Day 2)

**What**: Build dependency graph from imports/exports

**Steps**:
1. Install `@babel/parser` and `@babel/traverse`
2. Create `codeStructureAnalyzer.js`
3. Implement JS/TS import parsing
4. Implement Python import parsing
5. Build dependency graph
6. Detect circular dependencies
7. Validate import paths
8. Store graph in PRRun model
9. Test with sample repos
10. Verify graph accuracy

**Success Criteria**:
- Dependency graph generated for each PR
- Circular deps detected
- Graph stored in MongoDB
- No false positives

**Rollback**: Skip import analysis, won't break existing flow

---

### Module 01: Razorpay Token System (Day 5)

**What**: Auto-add tokens on payment, implement rollback

**Steps**:
1. Add fields to User model
2. Create `tokenManager.js`
3. Implement `addTokensForPayment()` with transactions
4. Implement `deductTokens()` with rollback
5. Implement `refundTokens()`
6. Update Razorpay webhook
7. Integrate token check into LLM calls
8. Create monthly reset script
9. Test payment → token addition
10. Test rollback scenarios

**Success Criteria**:
- Payment adds tokens automatically
- Rollback works if error occurs
- LLM calls deduct tokens
- Refund works on LLM failure
- All tests pass

**Rollback**: Webhook still logs payments, just doesn't add tokens

---

### Module 04: Embedding Pipeline (Day 7)

**What**: Generate embeddings for findings using Voyage AI

**Steps**:
1. Verify Voyage AI API key works
2. Create `voyageEmbedder.js`
3. Create Finding model
4. Migrate existing findings to new collection
5. Create embedding worker
6. Add embedding queue to BullMQ
7. Integrate into analyzer workflow
8. Test embedding generation
9. Verify batch processing
10. Check Voyage AI usage

**Success Criteria**:
- Embeddings generated for all findings
- Batching works (100/request)
- Worker processes queue
- Voyage AI free tier sufficient
- No errors in generation

**Rollback**: Skip embeddings, won't break analysis

---

### Module 05: RAG System (Day 8)

**What**: Store embeddings in Qdrant, implement similarity search

**Steps**:
1. Verify Qdrant cluster ready
2. Create collection via `init-qdrant.js`
3. Create `ragSystem.js`
4. Implement `storeFinding()`
5. Implement `querySimilarFindings()`
6. Test embedding storage
7. Test similarity search
8. Verify filtering works
9. Test with real findings
10. Measure query performance

**Success Criteria**:
- Findings stored in Qdrant
- Similarity search returns relevant results
- Queries fast (<100ms)
- Free tier sufficient
- No errors

**Rollback**: Don't query Qdrant, use direct LLM

---

### Module 06: Error Classifier (Day 9)

**What**: Classify findings as simple vs complex

**Steps**:
1. Create `errorClassifier.js`
2. Implement complexity scoring
3. Test with various finding types
4. Tune threshold (default: 5)
5. Integrate into autofix workflow
6. Verify simple errors bypass RAG
7. Verify complex errors use RAG
8. Measure classification accuracy
9. Add logging
10. Document edge cases

**Success Criteria**:
- Classification works correctly
- Simple errors fast (no RAG)
- Complex errors get RAG context
- Threshold tunable
- No misclassification

**Rollback**: All errors use RAG (slower but works)

---

### Module 07: File Storage (Day 3)

**What**: Organize storage for recordings and temp files

**Steps**:
1. Create `./storage/recordings` directory
2. Create `recordingManager.js`
3. Implement `saveRecording()`
4. Implement `getRecording()`
5. Implement `cleanupOld()`
6. Integrate into analyzer
7. Test recording storage
8. Test retrieval
9. Test cleanup
10. Check disk usage

**Success Criteria**:
- Recordings saved as JSON
- Old recordings deleted (30 days)
- Temp repos deleted after analysis
- Disk usage reasonable
- No privacy issues

**Rollback**: Skip recording, logs already exist

---

### Module 08: Scheduler (Day 12)

**What**: Cron jobs for cleanup and maintenance

**Steps**:
1. Create `jobScheduler.js`
2. Add cleanup job (daily 2 AM)
3. Add token reset job (monthly)
4. Add RAG index optimization (weekly)
5. Integrate into API server
6. Test scheduler starts
7. Test jobs run
8. Add logging
9. Handle errors in jobs
10. Document schedule

**Success Criteria**:
- Scheduler runs on server start
- Jobs execute on schedule
- Errors don't crash server
- Logs show job execution
- Graceful shutdown

**Rollback**: Manual cleanup via scripts

---

## Daily Checklist

**AI must check before starting:**
- [ ] Read `AI_RULES.md`
- [ ] Read `MEMORY.md`
- [ ] Read today's module guide
- [ ] Confirm with user which module today
- [ ] Check existing code first
- [ ] Show diffs before applying
- [ ] Wait for user test results
- [ ] Update MEMORY.md when approved

---

## Testing Days (Day 4, 10, 13-14)

**Purpose**: Catch bugs before they compound

**Activities**:
1. Run full analysis on test repo
2. Check all analyzers work
3. Verify embeddings generated
4. Test RAG queries
5. Test autofix with RAG
6. Check token system
7. Review logs
8. Fix any bugs found
9. Update MEMORY.md with bugs fixed
10. Prepare for next week

---

## Communication Protocol

**Start of Module**:
```
AI: "Starting Module X: [Name]. Steps to complete:
1. [Step 1]
2. [Step 2]
...
Ready to proceed?"

User: "yes" or "start"
```

**During Work**:
```
AI: "Step X: [Description]
Will modify: [file]
Changes: [show diff]
Approve?"

User: "yes" → AI makes change
User: "no" → AI asks for clarification
```

**After Change**:
```
AI: "Change applied. Please run:
npm run dev:api
[or other test command]
Let me know if it works."

User: "works" → Next step
User: "error: ..." → AI fixes
```

**End of Module**:
```
AI: "Module X complete!
✅ All X steps done
✅ All tests passed
Should I update MEMORY.md?"

User: "approved" → AI updates MEMORY.md
User: "not yet" → AI waits
```

---

## Progress Tracking

**Update in MEMORY.md after each module**:
```markdown
### 2026-01-26 - Module 02: Static Analyzers
- ✅ Installed TruffleHog, Hadolint, Checkov
- ✅ Created 4 new analyzer files
- ✅ Integrated into main analyzer
- ✅ Tested: All 9 analyzers run successfully
- Status: Complete
```

---

**Ready to start? User picks which day/module and we begin! 🚀**
