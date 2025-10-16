# ⚡ Quick Auto-Merge Test Steps

## ✅ What I Just Added:

1. **Analyzer Worker** now auto-triggers autofix when mode is "commit" or "merge"
2. **Autofix Engine** now creates PR and auto-merges after applying fixes
3. **GitHub PR Service** handles creating and merging PRs

---

## 🚀 How to Test (5 Minutes)

### **Step 1: Restart Services**

**Stop everything (Ctrl+C) and restart:**

**Terminal 1 - API:**
```bash
node services/api/server.js
```

**Terminal 2 - Analyzer:**
```bash
node services/analyzer/worker.js
```

**Terminal 3 - Autofix:**
```bash
node services/autofix/worker.js
```

---

### **Step 2: Your Config is Already Set!**

You already have:
- ✅ Mode: MERGE
- ✅ Severities: critical, high, medium  
- ✅ Auto-Merge Enabled
- ✅ Required Approvals: 0 (I assume, since you want Mode 0)

**Just verify in:** `http://localhost:3000/installations`

If "Required Approvals" is not 0, change it to 0 and save.

---

### **Step 3: Create New Test PR**

In your test repo:

```bash
git checkout main
git pull
git checkout -b test-automerge-final

# Add file with issues
echo "var test = 1; console.log(test);" > testfile.js

git add testfile.js
git commit -m "test: add file with style issues"
git push origin test-automerge-final
```

Then create PR on GitHub.

---

### **Step 4: Watch the Magic! ✨**

**Expected Logs (in order):**

**API Server:**
```
✓ [api] Webhook received
✓ [api] Installation found | mode=merge
✓ [api] Job enqueued
```

**Analyzer Worker:**
```
✓ [analyzer] Job received
✓ [analyzer] Installation config loaded | mode=merge
✓ [analyzer] Analysis complete
✓ [analyzer] Auto-triggering autofix
✓ [analyzer] PatchRequest created for auto-fix
✓ [analyzer] Auto-fix preview job enqueued
```

**Autofix Worker:**
```
✓ [autofix] Job received | type=preview
✓ [autofix] Preview built
✓ [autofix] Job received | type=apply
✓ [autofix] Branch created | branch=peer/autofix/...
✓ [autofix] Creating pull request for fixes
✓ [githubPR] Pull request created | prNumber=X
✓ [autofix] Attempting auto-merge
✓ [githubPR] Pull request auto-merged successfully
```

---

### **Step 5: Check GitHub**

Within 1-2 minutes you should see:

1. **New PR created** by Peer (peer/autofix/...)
2. **PR automatically merged** (purple "Merged" badge)
3. **Commit in base branch** with fixes

---

## 🐛 If It Doesn't Work:

### **Check 1: Are all workers running?**
```bash
# Should see 3 terminals with:
# - node services/api/server.js
# - node services/analyzer/worker.js
# - node services/autofix/worker.js
```

### **Check 2: GitHub Token has permissions?**
```bash
# In .env:
GITHUB_TOKEN=ghp_...
# Token needs "repo" scope (all checkboxes)
```

### **Check 3: Config is correct?**
```
Mode: MERGE (not analyze or commit)
Auto-Merge Enabled: YES
Required Approvals: 0
```

### **Check 4: Installation matches repo?**
Check that your test repo (`anirbansantra748/Guess_Country`) is in the installation's repository list.

---

## 📊 What Should Happen (Timeline):

```
00:00 - PR created on GitHub
00:01 - Peer receives webhook
00:02 - Analysis starts
00:05 - Analysis completes, autofix triggered
00:06 - Preview generated
00:08 - Fixes applied, branch pushed
00:09 - PR created by Peer
00:10 - PR AUTO-MERGED ✅
```

**Total time: ~10 seconds**

---

## ✅ Success Criteria:

- [ ] Webhook received
- [ ] Analyzer runs
- [ ] Autofix automatically triggered
- [ ] Branch created with fixes
- [ ] **PR created automatically**
- [ ] **PR merged automatically (Mode 0)**

---

## 🎯 Next: Test Mode 1 (One Approval)

After Mode 0 works, change config:
- Required Approvals: **1**
- Save
- Create new PR
- Should create fix PR but NOT merge
- Approve the fix PR manually
- Should auto-merge after approval

---

## 💡 Key Difference from Before:

**Before:** Only created branch, no PR, no merge
**Now:** Creates branch → Creates PR → Auto-merges (if mode=merge)

That's it! Try it now! 🚀
