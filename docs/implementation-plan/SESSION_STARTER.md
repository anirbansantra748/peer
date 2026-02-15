# 🔄 AI Session Starter

**Use this every time you start working with AI on implementation**

---

## Copy-Paste Command for AI

```
Read AI_RULES.md, MEMORY.md, and IMPLEMENTATION_GUIDE.md.
Tell me:
1. What module we're working on today
2. What's already completed (from MEMORY.md)
3. What we'll do in this session
```

---

## What AI Will Do

After reading, AI will respond with:

```
✅ Read AI_RULES.md - Following all 10 rules
✅ Read MEMORY.md - [X] modules complete, currently on Module [Y]
✅ Read IMPLEMENTATION_GUIDE.md - Today is Module [Y]: [Name]

According to MEMORY:
- Completed: [list]
- Working: [none/module name]
- Next: Module [Y]: [description]

Shall we start Module [Y]? (yes/no)
```

---

## Daily Workflow

### Morning Start

**YOU say:**
```
Read AI_RULES.md, MEMORY.md, and IMPLEMENTATION_GUIDE.md.
What are we working on today?
```

**AI reads files and confirms**

**YOU say:**
```
Yes, let's start
```

---

### During Work

AI follows AI_RULES.md automatically:
- Shows diffs before changes
- Waits for approval
- One change at a time
- Asks you to test
- Fixes if broken

---

### End of Day

**AI asks:**
```
Module [X] complete. All tests passed.
Should I update MEMORY.md?
```

**YOU say:**
```
approved
```
(or "update memory" or "yes" or "done")

**AI updates MEMORY.md** with completion

---

## If AI Forgets the Rules

**Red flags:**
- AI changes multiple files without asking
- AI doesn't show diffs
- AI updates MEMORY without approval
- AI makes assumptions

**What to do:**
```
STOP. Re-read AI_RULES.md and follow them.
Show me what you're about to change first.
```

---

## Enforce the Flow

**If AI skips reading:**

YOU say:
```
❌ Stop. Read AI_RULES.md first.
```

**If AI doesn't check MEMORY:**

YOU say:
```
❌ What does MEMORY.md say is already done?
```

**If AI updates MEMORY without approval:**

YOU say:
```
❌ Revert MEMORY.md. 
I didn't say "approved" yet.
Rule 5: Only update when I approve.
```

---

## Bookmark This Command

**Save this in a text file for easy copy-paste:**

```
Read AI_RULES.md, MEMORY.md, and IMPLEMENTATION_GUIDE.md before starting. Tell me what module we're working on and what's completed.
```

---

**This ensures AI ALWAYS follows the flow! 🎯**
