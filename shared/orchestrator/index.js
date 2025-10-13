function severityWeight(sev) {
  switch (sev) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 1;
  }
}

function dedupe(findings) {
  // Prefer language-specific analyzers over universal when the same rule hits the same file/line.
  const map = new Map();
  for (const f of findings) {
    const key = `${f.file}|${f.line}|${f.rule}`; // canonical key (drop message differences)
    if (!map.has(key)) {
      map.set(key, { ...f, count: 1 });
      continue;
    }
    const prev = map.get(key);

    // Prefer non-universal sources over universal-analyzer
    const isUniversal = (x) => x.analyzer === 'universal' || x.source === 'universal-analyzer';
    const preferF = !isUniversal(f) && isUniversal(prev);
    const preferPrev = isUniversal(f) && !isUniversal(prev);

    if (preferF) {
      map.set(key, { ...f, count: prev.count + 1 });
      continue;
    }
    if (preferPrev) {
      prev.count += 1;
      map.set(key, prev);
      continue;
    }

    // Otherwise, keep highest severity and prefer richer suggestion/example/codeSnippet
    const winner = { ...prev };
    const fWeight = typeof f.severityWeight === 'number' ? f.severityWeight : severityWeight(f.severity);
    const pWeight = typeof prev.severityWeight === 'number' ? prev.severityWeight : severityWeight(prev.severity);
    if (fWeight > pWeight) {
      winner.severity = f.severity;
      winner.severityWeight = f.severityWeight;
      winner.message = f.message;
      winner.source = f.source;
      winner.analyzer = f.analyzer;
    }
    // Merge helpful fields if missing
    if (!winner.suggestion && f.suggestion) winner.suggestion = f.suggestion;
    if (!winner.example && f.example) winner.example = f.example;
    if (!winner.exampleDiff && f.exampleDiff) winner.exampleDiff = f.exampleDiff;
    if (!winner.codeSnippet && f.codeSnippet) winner.codeSnippet = f.codeSnippet;
    if (!winner.reason && f.reason) winner.reason = f.reason;
    if ((!winner.cwe || !winner.cwe.length) && f.cwe) winner.cwe = f.cwe;
    if ((!winner.owasp || !winner.owasp.length) && f.owasp) winner.owasp = f.owasp;
    winner.count = (prev.count || 1) + 1;
    map.set(key, winner);
  }
  return Array.from(map.values());
}

function summarize(findings) {
  const sum = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const f of findings) {
    if (sum[f.severity] !== undefined) sum[f.severity]++;
  }
  return sum;
}

function sourceWeight(src) {
  const s = String(src || '').toLowerCase();
  // Higher is more important
  const table = {
    'bandit': 9,
    'semgrep': 9,
    'checkov': 9,
    'trivy': 8,
    'snyk': 8,
    'pmd': 7,
    'npm-audit': 7,
    'pip-audit': 7,
    'safety': 7,
    'security-analyzer': 7,
    'java-analyzer': 6,
    'python-analyzer': 6,
    'typescript-analyzer': 6,
    'docker-analyzer': 6,
    'sql-analyzer': 6,
    'logic-analyzer': 5,
    'performance-analyzer': 5,
    'style-analyzer': 3,
    'improvement-analyzer': 2,
    'universal-analyzer': 1,
    'llm-analysis': 6,
  };
  return table[s] || 4;
}

function sortBySeverity(findings) {
  return findings.slice().sort((a, b) => {
    const aw = typeof a.severityWeight === 'number' ? a.severityWeight : severityWeight(a.severity);
    const bw = typeof b.severityWeight === 'number' ? b.severityWeight : severityWeight(b.severity);
    const bySev = bw - aw;
    if (bySev !== 0) return bySev;
    // Prefer higher source weight
    const bySrc = sourceWeight(b.source) - sourceWeight(a.source);
    if (bySrc !== 0) return bySrc;
    // Stable-ish fallback by file/line
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return (a.line || 0) - (b.line || 0);
  });
}

function orchestrate(findings) {
  const deduped = dedupe(findings);
  const sorted = sortBySeverity(deduped);
  const summary = summarize(sorted);
  return { findings: sorted, summary };
}

module.exports = { orchestrate, dedupe, summarize, sortBySeverity };
