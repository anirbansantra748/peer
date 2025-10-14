# Testing Guide: New Issue Selection System

## Overview
This guide will help you test the completely redesigned issue selection page with intelligent categorization (BLOCKING/URGENT/RECOMMENDED/OPTIONAL).

## What Changed

### 1. **Issue Categorization**
Issues are now categorized by **consequence** instead of just severity:
- 🔴 **BLOCKING** - Security vulnerabilities, critical runtime errors (MUST FIX)
- 🟠 **URGENT** - Data integrity issues, deprecated APIs (fix soon)
- 🟡 **RECOMMENDED** - Performance issues, code quality (technical debt)
- 🟢 **OPTIONAL** - Style improvements, minor refactoring (nice to have)

### 2. **New UI Features**
- **Summary Panel** - Shows count of each category and estimated fix time
- **Smart Defaults** - BLOCKING issues are pre-selected
- **Consequence Warnings** - Shows what happens if you skip an issue
- **Effort Estimates** - Each issue shows estimated fix time (3-15 min)
- **Impact Description** - Clear explanation of what breaks if ignored
- **Batch Selection** - "Select BLOCKING", "Select URGENT", "Clear All" buttons
- **Skip Acknowledgment Modal** - Must type "I understand the risks" to skip BLOCKING issues

### 3. **Selection Flow**
- ✅ **CONFIRMED WORKING**: When you select specific issues, ONLY those issues are fixed
- ✅ **BLOCKING issues** auto-selected by default
- ✅ **Skip modal** prevents accidental skipping of critical issues

## Testing Steps

### Step 1: Restart All Servers

**Stop all running Node processes:**
```powershell
# Find node processes
Get-Process node

# Kill them (replace PID with actual process ID)
Stop-Process -Id <PID> -Force
```

**Start servers in separate terminals:**

**Terminal 1 - API Server:**
```bash
npm run dev:api
```

**Terminal 2 - UI Server:**
```bash
npm run dev:ui
```

**Terminal 3 - Autofix Worker:**
```bash
npm run dev:autofix
```

### Step 2: Navigate to Select Page

1. Open browser: `http://localhost:3000`
2. Trigger a PR analysis or use an existing run
3. Click "Select" to go to the selection page

### Step 3: Verify UI Elements

**Check Summary Panel:**
- [ ] Shows colored counts for BLOCKING, URGENT, RECOMMENDED, OPTIONAL
- [ ] Displays total issue count
- [ ] Shows "X require immediate attention"
- [ ] Shows estimated total fix time

**Check Issue Cards:**
- [ ] Each issue has a colored category badge (🔴/🟠/🟡/🟢)
- [ ] File path shown as `📁 path/to/file.js:42`
- [ ] Rule shown in gray box
- [ ] Message displayed clearly
- [ ] Impact shown with 💥 icon (e.g., "Security vulnerability")
- [ ] Effort shown with ⏱️ icon (e.g., "5 min")
- [ ] BLOCKING issues show red consequence box with "⚠️ If you skip: ..."

**Check Toolbar:**
- [ ] Category filter dropdown works
- [ ] Search box filters issues in real-time
- [ ] "Select BLOCKING" button selects all BLOCKING issues
- [ ] "Select URGENT" button selects BLOCKING + URGENT
- [ ] "Clear All" button deselects everything

### Step 4: Test Selection Behavior

**Test 1: Default Selection**
- [ ] BLOCKING issues are checked by default when page loads
- [ ] Other categories are unchecked by default

**Test 2: Batch Selection**
- Click "Clear All"
- [ ] All checkboxes unchecked
- [ ] Selection count shows "0 issues selected"
- Click "Select BLOCKING"
- [ ] Only BLOCKING issues checked
- [ ] Count updated correctly
- Click "Select URGENT"
- [ ] BLOCKING + URGENT issues checked
- [ ] Count updated correctly

**Test 3: Individual Selection**
- Manually check/uncheck individual issues
- [ ] Selection count updates in real-time
- [ ] Can select any combination of issues

**Test 4: Filtering**
- Select "BLOCKING" from category filter
- [ ] Only BLOCKING issues visible
- [ ] Other issues hidden (not removed)
- Clear filter, type in search box (e.g., "security")
- [ ] Issues filtered by search term
- [ ] Filtering works across file path, rule, message

### Step 5: Test Skip Warning Modal

**Test 1: Skip BLOCKING Without Selection**
- Uncheck ALL issues
- Click "Fix Selected Issues"
- [ ] Alert: "Please select at least one issue to fix"

**Test 2: Skip Some BLOCKING Issues**
- Select some BLOCKING issues but NOT all
- Click "Fix Selected Issues"
- [ ] Modal appears: "⚠️ Warning: Skipping BLOCKING Issues"
- [ ] Shows count of skipped BLOCKING issues
- [ ] Lists each skipped issue with file and message
- [ ] Warning text: "These issues can compromise security..."
- [ ] Confirmation input box shown
- Try clicking "Skip Anyway" without typing
- [ ] Button is disabled
- Type "I understand the risks"
- [ ] Button becomes enabled
- [ ] Can click "Skip Anyway" to proceed

**Test 3: Skip No BLOCKING Issues**
- Select ALL BLOCKING issues + some others
- Click "Fix Selected Issues"
- [ ] Modal does NOT appear
- [ ] Form submits directly to preview

**Test 4: Modal Cancel**
- Trigger modal (skip some BLOCKING)
- Click "Go Back & Fix Them"
- [ ] Modal closes
- [ ] Returns to selection page
- [ ] Previous selections preserved

### Step 6: Test End-to-End Fix Flow

**Test: Select Specific Issues**
1. Clear all selections
2. Manually select exactly 5 specific issues (note which ones)
3. Click "Fix Selected Issues"
4. [ ] Redirects to preview page
5. [ ] Preview shows ONLY the 5 issues you selected
6. [ ] No other issues included

**Test: Fix Only BLOCKING**
1. Click "Select BLOCKING"
2. Note the count (e.g., "8 issues selected")
3. Click "Fix Selected Issues"
4. [ ] Preview shows exactly 8 files (one per BLOCKING issue)
5. [ ] Verify all files correspond to BLOCKING issues

### Step 7: Verify Categorization Logic

Check that issues are categorized correctly:

**BLOCKING should include:**
- [ ] Security issues (SQL injection, XSS, CSRF, auth bypass)
- [ ] Critical runtime errors (null pointer, crashes, memory leaks)

**URGENT should include:**
- [ ] Data integrity issues (data loss, corruption)
- [ ] Deprecated API usage
- [ ] Severity: "critical" from scanner

**RECOMMENDED should include:**
- [ ] Performance issues
- [ ] Severity: "high" from scanner
- [ ] Code quality problems

**OPTIONAL should include:**
- [ ] Style/formatting issues
- [ ] Unused variables
- [ ] Documentation issues
- [ ] Severity: "low" from scanner

## Expected Results

✅ **Selection works correctly** - Only selected issues are processed
✅ **BLOCKING issues protected** - Cannot skip without acknowledgment
✅ **Batch actions work** - All selection buttons function correctly
✅ **Filtering works** - Category and search filters work in real-time
✅ **Modal prevents accidents** - Must type confirmation to skip BLOCKING
✅ **UI is responsive** - Modern, clean design with good UX
✅ **Categorization accurate** - Issues categorized by consequence, not just severity

## Troubleshooting

### Issue: Summary panel shows 0 for all categories
**Cause:** UI server not restarted after changes
**Fix:** Kill UI server and restart with `npm run dev:ui`

### Issue: Modal not appearing when skipping BLOCKING
**Cause:** Browser cache showing old UI
**Fix:** Hard refresh (Ctrl+Shift+R) or clear browser cache

### Issue: Selection not working (all issues fixed)
**Cause:** This should NOT happen - backend already respects selection
**Fix:** Check browser console for JavaScript errors

### Issue: Categorization seems wrong
**Cause:** Issue patterns may need adjustment
**Fix:** Edit `shared/utils/issueCategorizer.js` and adjust regex patterns

## Success Criteria

- ✅ All BLOCKING issues are pre-selected by default
- ✅ Can select/deselect any issues individually
- ✅ Batch selection buttons work correctly
- ✅ Cannot skip BLOCKING without typing confirmation
- ✅ Only selected issues are sent to fix worker
- ✅ UI looks modern and professional
- ✅ Selection count updates in real-time
- ✅ Filtering and search work correctly
- ✅ Consequence warnings are clear and helpful

## Next Steps After Testing

If everything works:
1. Consider adding more issue patterns to categorizer
2. Add user preference to remember default selections
3. Add "Mark as false positive" feature
4. Add issue history ("You skipped this 3 times")
5. Add effort tracking and analytics

If issues found:
1. Document the issue in GitHub
2. Check browser console for errors
3. Verify server logs for backend issues
4. Test with different types of PRs/codebases
