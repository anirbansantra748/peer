# Scripts

## View Findings

Display detailed analysis results with actionable suggestions and code examples.

### Usage

```bash
node scripts/view-findings.js <runId>
```

### Example

```bash
# View the latest analysis from your logs
node scripts/view-findings.js 68e216ff49ef037826d7bcf4
```

### Output Features

The script displays:

✅ **Run Summary** - Repo, PR#, Status, SHA
📊 **Issue Counts** - By severity (Critical, High, Medium, Low)
📍 **Exact Locations** - File path, line number, column
💡 **Fix Suggestions** - Specific actionable advice
🔄 **Code Examples** - Before/After comparisons with ❌ and ✅
📝 **Code Snippets** - The actual problematic code

### Color Coding

- 🔴 **Critical** - White text on red background (urgent security issues)
- 🔴 **High** - Red text (major bugs or security risks)
- 🟡 **Medium** - Yellow text (notable issues to address)
- 🔵 **Low** - Cyan text (style/improvement suggestions)

### Sample Output

```
═══════════════════════════════════════════════════════
PR Analysis Results
═══════════════════════════════════════════════════════
Run ID: 68e216ff49ef037826d7bcf4
Repo: anirbansantra748/Guess_Country
PR: #1
Status: completed

Summary:
  Critical: 0
  High:     1
  Medium:   1
  Low:      4
  Total:    6

─────────────────────────────────────────────────────
HIGH Issues (1)
─────────────────────────────────────────────────────

1. [HIGH] dangerous-innerHTML
   app.js:608:15
   Setting innerHTML can lead to XSS vulnerabilities
   Code: element.innerHTML = userInput
   💡 Use textContent for plain text, or sanitize HTML with DOMPurify.
   Example:
      ❌ element.innerHTML = userInput
      ✅ element.textContent = userInput // or DOMPurify.sanitize()
```

### Tips

1. **Run after each analysis** to see the latest findings
2. **Look for HIGH and CRITICAL issues first** - these are security/bug risks
3. **Use the code examples** to quickly understand how to fix issues
4. **Check the code snippets** to see the exact problematic line

### Getting the Run ID

The run ID is shown in the analyzer worker logs:

```
12:28:12 ✓ [analyzer] Run completed | runId=68e216ff49ef037826d7bcf4
```

Or get it from the API response when triggering analysis:

```bash
curl -X POST http://localhost:3001/webhook/github \
  -H "Content-Type: application/json" \
  -d '{"repo":"user/repo","prNumber":1,"sha":"abc123"}'
```

Response:
```json
{
  "ok": true,
  "runId": "68e216ff49ef037826d7bcf4"
}
```
