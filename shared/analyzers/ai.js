const fsp = require('fs').promises;
const path = require('path');

function clampSeverity(s) {
  const m = String(s || '').toLowerCase();
  if (['critical','high','medium','low'].includes(m)) return m;
  if (m.includes('crit')) return 'critical';
  if (m.includes('high') || m.includes('error')) return 'high';
  if (m.includes('med') || m.includes('warn')) return 'medium';
  return 'low';
}

function buildAIPrompt(filesPayload) {
  return (
`You are a senior code reviewer AI. Analyze the following changed files and return precise findings.

Return STRICT JSON array of objects with keys exactly:
[{
  "file": "relative/path",
  "line": 1,
  "column": 1,
  "rule": "short-rule-id",
  "severity": "critical|high|medium|low",
  "message": "short message",
  "suggestion": "how to fix concisely",
  "example": "one-line example change or before/after if needed",
  "codeSnippet": "relevant snippet"
}]

Guidelines:
- Only report real issues. Prefer fewer, higher-quality findings.
- Classify severity into: critical, high, medium, low.
- Security issues (injection, secrets, command exec) are critical/high.
- Logic bugs are high/medium.
- Style is low.
- Use conservative line numbers if unsure.
- Do not include any text outside raw JSON.

FILES:
` + JSON.stringify(filesPayload, null, 2))
}

async function callOpenAI(messages, model) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2 })
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  return text || '';
}

async function analyzeAI(baseDir, changed) {
  const findings = [];
  if (!process.env.OPENAI_API_KEY) return findings; // disabled if no key
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  // Select up to 10 files, max ~1500 chars each to stay in token limits
  const candidates = changed.slice(0, 10);
  const filesPayload = [];

  for (const file of candidates) {
    try {
      const filePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
      const content = await fsp.readFile(filePath, 'utf8');
      filesPayload.push({ file, content: content.slice(0, 5000) });
    } catch {}
  }
  if (filesPayload.length === 0) return findings;

  const prompt = buildAIPrompt(filesPayload);
  try {
    const text = await callOpenAI([
      { role: 'system', content: 'You are a precise code analysis assistant.' },
      { role: 'user', content: prompt },
    ], model);

    let json;
    try { json = JSON.parse(text); } catch { json = []; }
    if (Array.isArray(json)) {
      for (const f of json) {
        if (!f || !f.file || !f.rule || !f.message) continue;
        findings.push({
          analyzer: 'ai',
          file: f.file,
          line: Number.isInteger(f.line) ? f.line : 1,
          column: Number.isInteger(f.column) ? f.column : 1,
          rule: String(f.rule).slice(0, 120),
          severity: clampSeverity(f.severity),
          message: String(f.message).slice(0, 500),
          source: 'llm-analysis',
          suggestion: f.suggestion ? String(f.suggestion).slice(0, 500) : undefined,
          example: f.example ? String(f.example).slice(0, 1000) : undefined,
          codeSnippet: f.codeSnippet ? String(f.codeSnippet).slice(0, 300) : undefined,
        });
      }
    }
  } catch (e) {
    // Silent fail -> no AI findings
  }

  return findings;
}

module.exports = { analyzeAI };