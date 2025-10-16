# 🚀 Auto-Merge Testing Guide (Mode 0 & Mode 1)

## 📋 What We're Testing

**Mode 0 (Zero Approvals):**
- PR opened → Peer finds issues → Creates fix branch → Creates PR → **Auto-merges immediately**

**Mode 1 (One Approval Required):**
- PR opened → Peer finds issues → Creates fix branch → Creates PR → **Waits for 1 approval** → Auto-merges

---

## ✅ Prerequisites (Do These First!)

### **Step 1: Install Required Package**
```bash
cd C:\Users\anirb\downloads\peer
npm install @octokit/rest
```

### **Step 2: Get GitHub Token with Correct Permissions**
```
1. Go to: https://github.com/settings/tokens
2. Click: "Generate new token (classic)"
3. Name: "Peer Auto-Merge Token"
4. Select these scopes:
   ✅ repo (all checkboxes under it)
   ✅ workflow
5. Click "Generate token"
6. COPY THE TOKEN immediately!
```

### **Step 3: Update .env File**
```bash
# Open C:\Users\anirb\downloads\peer\.env
# Find GITHUB_TOKEN line and replace with your new token:
GITHUB_TOKEN=ghp_YOUR_NEW_TOKEN_WITH_FULL_REPO_ACCESS
```

### **Step 4: Choose Test Repository**
**IMPORTANT:** Use a TEST repository, not production!
```
Recommended: Create a new test repo
Name: peer-test-automerge
Private: Yes
Initialize with: README.md
```

---

## 🎯 Test Mode 0 (Zero Approvals - Fully Automatic)

### **Configuration Steps:**

#### **1. Go to Installation Settings**
```
http://localhost:3000/installations
Click "Configure" button
```

#### **2. Set Configuration:**
```yaml
Processing Mode: ✅ Auto-Merge

Severity Levels:
  ❌ Critical (uncheck - so it will find issues and auto-fix)
  ❌ High (uncheck)
  ❌ Medium (uncheck)
  ✅ Low (check - will fix style issues)

Max Files Per Run: 10

Auto-Merge Settings:
  ✅ Enable Auto-Merge: CHECKED
  ✅ Require Tests to Pass: UNCHECKED (for testing)
  Required Approvals: 0
```

#### **3. Click "Save Configuration"**

---

### **Testing Steps for Mode 0:**

#### **Step 1: Create Test Branch**
```bash
cd C:\path\to\your\test\repo
git checkout -b test-automerge-zero
```

#### **Step 2: Add File with Style Issues**
```bash
# Create test.js with intentional style issues
echo "var x=1;console.log(x)" > test.js
git add test.js
git commit -m "test: file with style issues"
git push origin test-automerge-zero
```

#### **Step 3: Create Pull Request on GitHub**
```
1. Go to your test repo on GitHub
2. Click "Pull requests" → "New pull request"
3. Base: main (or master)
4. Compare: test-automerge-zero
5. Click "Create pull request"
6. Title: "Test auto-merge mode 0"
7. Click "Create pull request"
```

#### **Step 4: Watch What Happens**
```
EXPECTED FLOW:
1. ✅ Peer webhook receives PR
2. ✅ Peer analyzes code
3. ✅ Peer finds style issues
4. ✅ Peer creates fix branch: peer/autofix/...
5. ✅ Peer creates NEW PR with fixes
6. ✅ Peer immediately merges the fix PR (0 approvals needed!)
7. ✅ Original PR now has fixes merged to base branch
```

#### **Step 5: Check Logs**
```bash
# In API server terminal, you should see:
✓ [api] Webhook received
✓ [api] Installation found
✓ [analyzer] Installation config loaded | mode=merge
✓ [autofix] Creating pull request
✓ [githubPR] Pull request created | prNumber=X
✓ [githubPR] Attempting auto-merge
✓ [githubPR] Pull request merged | prNumber=X
```

#### **Step 6: Verify on GitHub**
```
1. Go to Pull Requests tab
2. You should see:
   - Original PR (test-automerge-zero)
   - NEW PR (peer/autofix/...) - MERGED ✅
3. Check Commits tab
   - Should see "peer: autofix X change(s)"
```

---

## 🎯 Test Mode 1 (One Approval Required)

### **Configuration Steps:**

#### **1. Go to Installation Settings**
```
http://localhost:3000/installations
Click "Configure" button
```

#### **2. Set Configuration:**
```yaml
Processing Mode: ✅ Auto-Merge

Severity Levels:
  ❌ Critical (uncheck)
  ❌ High (uncheck)
  ❌ Medium (uncheck)
  ✅ Low (check)

Max Files Per Run: 10

Auto-Merge Settings:
  ✅ Enable Auto-Merge: CHECKED
  ✅ Require Tests to Pass: UNCHECKED (for testing)
  Required Approvals: 1  ← CHANGE THIS TO 1
```

#### **3. Click "Save Configuration"**

---

### **Testing Steps for Mode 1:**

#### **Step 1: Create Test Branch**
```bash
cd C:\path\to\your\test\repo
git checkout main
git pull
git checkout -b test-automerge-one
```

#### **Step 2: Add File with Issues**
```bash
echo "var y=2;console.log(y)" > test2.js
git add test2.js
git commit -m "test: another file with issues"
git push origin test-automerge-one
```

#### **Step 3: Create Pull Request**
```
1. Go to GitHub
2. Create PR from test-automerge-one to main
3. Title: "Test auto-merge mode 1"
```

#### **Step 4: Watch First Part**
```
EXPECTED:
1. ✅ Peer analyzes
2. ✅ Peer creates fix branch
3. ✅ Peer creates NEW PR
4. ⏸️ PR WAITS (not merged yet - needs 1 approval)
```

#### **Step 5: Approve the PR**
```
1. Go to the NEW PR created by Peer (peer/autofix/...)
2. Click "Files changed"
3. Click "Review changes"
4. Select: "Approve"
5. Click "Submit review"
```

#### **Step 6: Watch Auto-Merge Happen**
```
EXPECTED:
1. ✅ GitHub sends "pull_request_review" webhook
2. ✅ Peer receives approval event
3. ✅ Peer checks: 1 approval ≥ 1 required ✓
4. ✅ Peer merges PR automatically!
```

#### **Step 7: Verify**
```
- Fix PR should now show: "Merged" 🟣
- Check commits - should see Peer's auto-merge commit
```

---

## 🐛 Troubleshooting

### **Problem: No PR Created**
```
Check:
1. GITHUB_TOKEN has "repo" scope
2. API server logs show "Creating pull request"
3. Token has access to the repository
```

### **Problem: PR Created But Not Merged (Mode 0)**
```
Check:
1. Installation config: autoMerge.enabled = true
2. Installation config: requireReviews = 0
3. Installation config: requireTests = false (for testing)
4. Logs show "Attempting auto-merge"
```

### **Problem: Not Merging After Approval (Mode 1)**
```
Check:
1. Webhook for "pull_request_review" is configured
2. API server receiving approval webhooks
3. requireReviews = 1 in config
```

### **Problem: "mergeable: null"**
```
This is normal - wait 2-3 seconds and try again
GitHub needs time to compute mergeable status
```

---

## 📊 Expected Logs for Mode 0

```
16:00:01 ✓ [api] Webhook received | repo=test-repo, prNumber=1
16:00:01 ✓ [api] Installation found | mode=merge
16:00:02 ✓ [analyzer] Analysis started
16:00:05 ✓ [analyzer] Found 3 issues
16:00:06 ✓ [autofix] Creating fixes
16:00:10 ✓ [autofix] Branch created | branch=peer/autofix/...
16:00:11 ✓ [githubPR] Creating pull request
16:00:12 ✓ [githubPR] Pull request created | prNumber=2
16:00:12 ✓ [githubPR] Attempting auto-merge | prNumber=2
16:00:13 ✓ [githubPR] All conditions met
16:00:14 ✓ [githubPR] Pull request merged | prNumber=2
```

---

## 📊 Expected Logs for Mode 1

**Part 1 - PR Creation:**
```
16:05:01 ✓ [githubPR] Pull request created | prNumber=3
16:05:02 ✓ [githubPR] Attempting auto-merge | prNumber=3
16:05:02 ℹ [githubPR] Insufficient approvals | required=1, actual=0
```

**Part 2 - After Approval:**
```
16:06:30 ✓ [api] Webhook received | event=pull_request_review
16:06:30 ✓ [githubPR] Attempting auto-merge | prNumber=3
16:06:31 ✓ [githubPR] Approvals check passed | required=1, actual=1
16:06:32 ✓ [githubPR] Pull request merged | prNumber=3
```

---

## ✅ Success Criteria

### **Mode 0 Success:**
- [x] PR opened
- [x] Peer analyzes
- [x] Peer creates fix branch
- [x] Peer creates PR
- [x] **PR merges automatically within 30 seconds**
- [x] No human interaction needed

### **Mode 1 Success:**
- [x] PR opened
- [x] Peer analyzes
- [x] Peer creates fix branch
- [x] Peer creates PR
- [x] **PR waits for approval**
- [x] After approval, **PR merges automatically**
- [x] Works within 30 seconds of approval

---

## 🎓 Next Steps After Testing

Once both modes work:

1. **Test with "Require Tests" enabled**
   - Set up GitHub Actions
   - Enable "Require Tests to Pass"
   - Verify it waits for CI before merging

2. **Test Mode 2 (Two Approvals)**
   - Set requireReviews: 2
   - Verify it needs 2 approvals

3. **Test in Production**
   - Start with Mode: "analyze" (safest)
   - After confidence, switch to "commit"
   - Finally enable "merge" with approvals

---

## 📝 Summary

**You need to:**
1. ✅ Install @octokit/rest package
2. ✅ Update GITHUB_TOKEN in .env
3. ✅ Configure installation settings
4. ✅ Create test PRs
5. ✅ Watch logs and GitHub

**Expected Result:**
- Mode 0: Fully automatic merge (instant)
- Mode 1: Waits for 1 approval, then merges
