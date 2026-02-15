# 🤖 AI RULES - READ THIS EVERY TIME

> **CRITICAL**: AI must read and follow these rules before ANY code changes

## Rule 1: Always Read First

Before making ANY changes:
1. ✅ Read `AI_RULES.md` (this file)
2. ✅ Read `MEMORY.md` to see what's already done
3. ✅ Read the specific module guide for today's work
4. ❌ NEVER assume what's done - always check MEMORY.md

---

## Rule 2: One Module Per Session

- Work on ONLY ONE module at a time
- Complete all steps in that module before moving to next
- Update MEMORY.md ONLY when user approves with "approved" or "done"

---

## Rule 3: No Hallucination - Verify Everything

Before writing code:
- ✅ Check if file already exists (use view_file)
- ✅ Check current implementation (read existing code)
- ✅ Verify dependencies are installed
- ❌ NEVER assume a function/file exists without checking

---

## Rule 4: Test After Every Change

After modifying code:
1. Explain what was changed
2. Provide test command
3. Wait for user to run and confirm
4. If broken → fix immediately
5. Only proceed when user says "works"

---

## Rule 5: Memory Updates

Update `MEMORY.md` ONLY when:
- ✅ User says: "approved", "done", "works", "correct", "good"
- ❌ NEVER update if user says: "broken", "error", "not working", "fix this"

Update format:
```markdown
### [Date] - Module X: [Name]
- ✅ Step 1: [What was done]
- ✅ Step 2: [What was done]
- Status: Complete
```

---

## Rule 6: Error Handling

If error occurs:
1. Read the error message completely
2. Check MEMORY.md - was this working before?
3. Identify what changed
4. Propose fix with explanation
5. Wait for user approval before applying fix
6. ❌ NEVER apply multiple fixes at once

---

## Rule 7: File Modifications

Before modifying a file:
1. Use `view_file` to see current content
2. Show user the EXACT changes (diff format)
3. Explain WHY the change is needed
4. Wait for approval
5. Make the change
6. Ask user to test

---

## Rule 8: Dependencies

Before installing packages:
1. Check `package.json` if already installed
2. List ALL packages that will be installed
3. Wait for user approval
4. Use exact versions (no wildcards)

---

## Rule 9: Environment Variables

When adding new env vars:
1. Update `.env.example`
2. Tell user to add to actual `.env`
3. List the exact value format needed
4. Provide example

---

## Rule 10: Rollback Plan

Every change must have rollback:
- Keep track of original code
- If user says "revert", restore original
- Never lose working code

---

## Daily Workflow

```
START OF DAY:
1. Read AI_RULES.md (this file)
2. Read MEMORY.md (what's done)
3. Read IMPLEMENTATION_GUIDE.md (today's module)
4. Confirm with user: "Today we're working on Module X: [Name]. Ready?"

DURING WORK:
5. For each step in module:
   a. Read existing code
   b. Make ONE change
   c. Show diff
   d. Wait for approval
   e. User tests
   f. If works → next step
   g. If broken → fix

END OF DAY:
6. Ask user: "Module X complete. Should I update MEMORY.md?"
7. If user approves → update MEMORY.md
8. Commit changes (if user wants)
```

---

## Commands AI Must Use

### Before ANY code change:
```bash
# Check file exists
view_file [path]

# Check what's installed
view_file package.json
```

### After code change:
```bash
# User should run this
npm run dev:api  # or relevant service
# or
node scripts/test-[module].js
```

---

## Forbidden Actions

❌ NEVER do these:
1. Change multiple files without user seeing each one
2. Install packages without approval
3. Delete files without confirmation
4. Update MEMORY.md without "approved"
5. Skip testing
6. Assume previous sessions' work is still there
7. Make changes in planning mode

---

## Communication Style

✅ DO:
- Explain every change clearly
- Show diffs before applying
- Ask for confirmation
- Admit when you don't know
- Suggest rollback if unsure

❌ DON'T:
- Say "this should work" without testing
- Make assumptions
- Skip steps
- Rush to next module

---

## Error Phrases to Watch For

If user says these, STOP and fix:
- "error"
- "broken"
- "not working"
- "doesn't work"
- "failed"
- "revert"
- "undo"

If user says these, update MEMORY:
- "approved"
- "done"
- "works"
- "correct"
- "good"
- "perfect"
- "next"

---

**READ THESE RULES EVERY SINGLE TIME BEFORE MAKING CHANGES**
