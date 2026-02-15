# 🎯 START HERE - Quick Reference

> **For AI**: Read this FIRST, then read the 3 core files below  
> **For User**: This is your command center

---

## 📚 Core Files (AI Reads These Every Time)

### 1. AI_RULES.md ⚠️ CRITICAL
**AI must read this BEFORE every code change**
- Rules to prevent hallucination
- Step-by-step workflow
- What to check before coding
- How to handle errors

### 2. MEMORY.md 🧠 TRACK PROGRESS
**AI reads this to know what's already done**
- Completed modules
- Known working code
- Bugs fixed
- Don't break what works!

### 3. IMPLEMENTATION_GUIDE.md 📅 DAILY PLAN
**One module per day guide**
- Module order (Day 1-15)
- What to build each day
- Testing checklist
- Success criteria

---

## 🚀 Before Starting Implementation

### Step 1: Get API Keys (Required)

Read: **SERVICES_SETUP.md**

**Required services** (must get before Day 1):
- [ ] Qdrant Cloud (vector database)
- [ ] Voyage AI (embeddings)
- [ ] Groq API (LLM)
- [ ] Google Gemini (LLM backup) - optional but recommended

**Time**: ~30 minutes to sign up and get all keys

---

### Step 2: Add Keys to .env

Copy template from `SERVICES_SETUP.md` to your `.env` file

**Verify** existing keys still work:
```bash
# Test MongoDB
mongosh "$MONGO_URI" --eval "db.runCommand({ ping: 1 })"

# Test Redis
redis-cli -u "$REDIS_URL" ping
```

---

### Step 3: Choose Starting Module

**Recommended order**:
1. **Day 1**: Module 02 - Static Analyzers (adds missing tools)
2. **Day 2**: Module 03 - Import/Export Analysis  
3. **Day 3**: Module 07 - File Storage
4. **Day 4**: Testing & bug fixes
5. **Day 5**: Module 01 - Razorpay Token System

Or user can choose different order based on priority.

---

## 🤖 How AI Should Work Each Day

### Morning Routine

1. **AI automatically reads**:
   ```
   ✅ AI_RULES.md
   ✅ MEMORY.md  
   ✅ IMPLEMENTATION_GUIDE.md (today's module)
   ✅ modules/XX-module-name.md (detailed steps)
   ```

2. **AI confirms with user**:
   ```
   "Today: Module X - [Name]
   According to MEMORY.md: [status]
   Ready to start? (yes/no)"
   ```

3. **User says**: "yes" or "start"

---

### During Work

For EACH step in module:

1. **Check existing code** (view_file)
2. **Show what will change** (diff)
3. **Wait for approval**
4. **Make ONE change**
5. **Ask user to test**
6. **If works → next step**
7. **If broken → fix immediately**

**Never skip testing!**

---

### End of Day

1. **AI confirms all done**:
   ```
   "Module X complete!
   ✅ All steps done
   ✅ All tests passed
   Should I update MEMORY.md? (yes/no)"
   ```

2. **User says**: "approved" or "yes"

3. **AI updates MEMORY.md**

---

## 📁 Folder Structure

```
docs/implementation-plan/
├── START_HERE.md (this file)
├── AI_RULES.md (AI reads every time)
├── MEMORY.md (what's done)
├── IMPLEMENTATION_GUIDE.md (day-by-day plan)
├── SERVICES_SETUP.md (API keys needed)
├── 01-DECISIONS.md (tech stack finalized)
├── 02-MODULE-MATRIX.md (all 35 modules)
│
├── modules/
│   ├── 01-razorpay-token-system.md
│   ├── 02-static-analyzers.md
│   ├── 03-import-export-analysis.md
│   ├── 04-embedding-pipeline.md
│   ├── 05-rag-system.md
│   ├── 06-error-classifier.md
│   ├── 07-file-storage.md
│   └── 08-scheduler.md
│
└── workflows/
    ├── first-time-pr-analysis.md
    ├── incremental-pr-updates.md
    └── payment-to-tokens.md
```

---

## ✅ Pre-Implementation Checklist

**Before starting Day 1:**

- [ ] Read all core docs (AI_RULES, MEMORY, IMPLEMENTATION_GUIDE)
- [ ] Get all required API keys (SERVICES_SETUP.md)
- [ ] Add keys to `.env` file
- [ ] Test API keys work (commands in SERVICES_SETUP.md)
- [ ] Verify MongoDB + Redis still working
- [ ] Choose starting module
- [ ] Create backup of existing code (`git commit`)

---

## 📊 Module Progress Tracking

**Use MEMORY.md to track**:

| Day | Module | Status | Date |
|-----|--------|--------|------|
| 1 | Static Analyzers | ⏸️ Pending | - |
| 2 | Import/Export | ⏸️ Pending | - |
| 3 | File Storage | ⏸️ Pending | - |
| 4 | Testing | ⏸️ Pending | - |
| 5 | Token System | ⏸️ Pending | - |
| ... | ... | ... | ... |

**Updated by AI when you say**: "approved" or "update memory"

---

## 🐛 If Something Breaks

1. **User says**: "error" or "broken"
2. **AI stops immediately**
3. **AI asks**: "What's the error message?"
4. **User pastes error**
5. **AI reads** error + checks MEMORY.md
6. **AI proposes fix** (doesn't apply yet)
7. **User approves** fix
8. **AI applies fix**
9. **User tests again**

**AI keeps original code** in case rollback needed.

---

## 💡 Tips for Success

**For User**:
- ✅ Do one module per day (don't rush)
- ✅ Test after every change
- ✅ Say "approved" when it works
- ✅ Say "broken" immediately if error
- ✅ Keep backups (`git commit` after each module)

**For AI**:
- ✅ Always read AI_RULES + MEMORY first
- ✅ Check existing code before changing
- ✅ Show diffs before applying
- ✅ Wait for user approval
- ✅ Never assume - always verify
- ✅ Update MEMORY only when user approves

---

## 🎬 Ready to Start?

**User, tell AI**:
1. "I have all API keys ready" (if you got them)
   - OR -
2. "I need to get API keys first" (read SERVICES_SETUP.md)

**Then say which module to start**:
- "Let's start Module 02" (Static Analyzers)
- OR choose different module

**AI will read the rules and begin! 🚀**

---

## 📞 Quick Command Reference

**Check what's done**:
```bash
cat docs/implementation-plan/MEMORY.md
```

**See today's plan**:
```bash
cat docs/implementation-plan/IMPLEMENTATION_GUIDE.md
```

**Review module details**:
```bash
cat docs/implementation-plan/modules/02-static-analyzers.md
```

**Test services**:
```bash
# See SERVICES_SETUP.md for test commands
```

---

**Everything is ready. You're in control. Let's build! 🎯**
