// LLM summarizer for findings. Uses OpenAI if OPENAI_API_KEY is set.
// Returns an array of { title, why, how, example? }

async function aiSummarizeFindings(findings) {
  try {
    if (!process.env.OPENAI_API_KEY) return fallbackSummary(findings);
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';
    const prompt = buildPrompt(findings);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a senior code reviewer. Be precise, realistic, and kind.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) return fallbackSummary(findings);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return fallbackSummary(findings);

    // Try to parse JSON first; else convert bullets.
    try {
      const json = JSON.parse(text);
      if (Array.isArray(json)) return json;
      if (Array.isArray(json?.suggestions)) return json.suggestions;
    } catch {}

    // Fallback: naive parse of dashed bullets -> suggestions
    return fallbackSummary(findings);
  } catch {
    return fallbackSummary(findings);
  }
}

function buildPrompt(findings) {
  const trimmed = findings.slice(0, 200).map((f) => ({
    file: f.file,
    line: f.line,
    column: f.column,
    rule: f.rule,
    severity: f.severity,
    message: f.message,
    suggestion: f.suggestion,
    analyzer: f.analyzer,
    codeSnippet: f.codeSnippet,
  }));
  return (
    'You are a senior code reviewer analyzing static analysis findings from a PR.\n\n' +
    'For each critical/high severity issue, provide specific fixes in this format:\n' +
    '[{"file":"...","line":X,"issue":"...","fix":"Replace X with Y","why":"...","code":"- old\n+ new"}]\n\n' +
    'Group by priority:\n' +
    '1. Security/Critical issues (must fix immediately)\n' +
    '2. Logic bugs (should fix soon)\n' +
    '3. Style/improvements (nice to have)\n\n' +
    'Return JSON with:\n' +
    '{"criticalFixes":[...],"logicFixes":[...],"styleFixes":[...],"summary":"Overall assessment"}\n\n' +
    'Findings:\n' + JSON.stringify(trimmed, null, 2)
  );
}

function fallbackSummary(findings) {
  // Heuristic, grouped suggestions based on rules present.
  const rules = new Set(findings.map((f) => f.rule));
  const out = [];
  if (rules.has('no-eval') || Array.from(rules).some((r) => String(r).includes('eval'))) {
    out.push({
      title: 'Remove eval and dynamic code execution',
      why: 'eval() enables injection and XSS; high security risk.',
      how: 'Refactor to safe parsing or whitelisted operations. Use JSON.parse, dedicated parsers, or table-driven logic.',
      example: '- const out = eval(userInput)\n+ const out = safeParse(userInput)'
    });
  }
  if (Array.from(rules).some((r) => r === 'semi')) {
    out.push({
      title: 'Enforce consistent semicolons',
      why: 'Consistency reduces parse ambiguities and diffs.',
      how: 'Enable ESLint rule "semi": ["error","always"] and run eslint --fix.',
      example: '- const a = 1\n+ const a = 1;'
    });
  }
  if (Array.from(rules).some((r) => r === 'no-unused-vars')) {
    out.push({
      title: 'Remove unused variables',
      why: 'Reduces noise and avoids dead code.',
      how: 'Delete or prefix with _ when intentionally unused.',
      example: '- function f(x) { const y = 1; return x }\n+ function f(x) { return x }'
    });
  }
  if (out.length === 0) {
    out.push({
      title: 'Adopt baseline lint and security checks',
      why: 'Catches small mistakes and common security pitfalls automatically.',
      how: 'Run ESLint with recommended+security rules and Semgrep community security rules on every PR.',
    });
  }
  return out;
}

module.exports = { aiSummarizeFindings };
