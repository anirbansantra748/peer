// Generate an enhanced Markdown review with counts by severity,
// a findings section with quick fixes, and an AI improvement plan.

function sevEmoji(sev) {
  return sev === 'critical' ? '🔴' : sev === 'high' ? '🟠' : sev === 'medium' ? '🔵' : '🟢';
}

function formatCounts(summary) {
  const order = ['critical', 'high', 'medium', 'low'];
  const lines = [];
  const total = order.reduce((acc, k) => acc + (summary[k] || 0), 0);
  lines.push(`Found ${total} issues:`);
  for (const k of order) {
    const v = summary[k] || 0;
    if (v > 0) lines.push(`${sevEmoji(k)} ${v} ${k[0].toUpperCase()}${k.slice(1)}`);
  }
  return lines.join('\n');
}

function formatFindings(findings, limitPerSeverity = 10) {
  const groups = { critical: [], high: [], medium: [], low: [] };
  for (const f of findings) {
    (groups[f.severity] || groups.low).push(f);
  }
  const parts = [];
  for (const sev of ['critical', 'high', 'medium', 'low']) {
    const list = groups[sev];
    if (!list.length) continue;
    parts.push(`\n${sevEmoji(sev)} ${sev.toUpperCase()} findings:`);
    list.slice(0, limitPerSeverity).forEach((f) => {
      parts.push(`- ${f.file}:${f.line} — ${f.rule} — ${f.message}`);
      if (f.suggestion) parts.push(`  • Fix: ${f.suggestion}`);
    });
    if (list.length > limitPerSeverity) {
      parts.push(`  …and ${list.length - limitPerSeverity} more ${sev} findings.`);
    }
  }
  return parts.join('\n');
}

function formatAISuggestions(aiSuggestions) {
  if (!aiSuggestions || !aiSuggestions.length) return 'No AI improvement suggestions available.';
  const out = ['AI Improvement Plan:'];
  aiSuggestions.slice(0, 8).forEach((s, i) => {
    out.push(`${i + 1}. ${s.title}`);
    if (s.why) out.push(`   • Why: ${s.why}`);
    if (s.how) out.push(`   • How: ${s.how}`);
    if (s.example) out.push('   • Example:\n```diff\n' + s.example + '\n```');
  });
  if (aiSuggestions.length > 8) out.push(`…and ${aiSuggestions.length - 8} more.`);
  return out.join('\n');
}

function toMarkdownEnhanced({ repo, prNumber, summary, findings, aiSuggestions, analyzerResults }) {
  const lines = [];
  lines.push(`# 🔍 Peer Review Summary — PR #${prNumber}`);
  lines.push(`**Repository:** ${repo}`);
  lines.push('');
  lines.push('## 📊 Summary');
  lines.push(formatCounts(summary));
  lines.push('');
  
  // Group findings by analyzer
  if (analyzerResults) {
    if (analyzerResults.security?.length > 0) {
      lines.push('## 🔐 Security Issues (CRITICAL)');
      lines.push(formatAnalyzerFindings(analyzerResults.security, 15));
      lines.push('');
    }
    
    if (analyzerResults.logic?.length > 0) {
      lines.push('## ⚠️ Logic Issues');
      lines.push(formatAnalyzerFindings(analyzerResults.logic, 15));
      lines.push('');
    }
    
    if (analyzerResults.style?.length > 0) {
      lines.push('## 🎨 Style Issues');
      lines.push(formatAnalyzerFindings(analyzerResults.style, 10));
      lines.push('');
    }
    
    if (analyzerResults.improvement?.length > 0) {
      lines.push('## 💡 Code Improvements');
      lines.push(formatAnalyzerFindings(analyzerResults.improvement, 10));
      lines.push('');
    }
  } else {
    lines.push('## 📝 All Findings');
    lines.push(formatFindings(findings));
    lines.push('');
  }
  
  lines.push('## 🤖 AI Analysis & Fixes');
  lines.push(formatAISuggestions(aiSuggestions));
  
  return lines.join('\n');
}

function formatAnalyzerFindings(findings, limit = 10) {
  if (!findings || findings.length === 0) return 'No issues found.';
  
  const lines = [];
  findings.slice(0, limit).forEach((f, i) => {
    lines.push(`${i + 1}. **${f.file}:${f.line}** — \`${f.rule}\``);
    lines.push(`   ${sevEmoji(f.severity)} **${f.message}**`);
    if (f.suggestion) lines.push(`   ✅ Fix: ${f.suggestion}`);
    if (f.example) lines.push(`   \`\`\`diff\n   ${f.example}\n   \`\`\``);
    lines.push('');
  });
  
  if (findings.length > limit) {
    lines.push(`_...and ${findings.length - limit} more ${findings[0]?.analyzer || ''} issues._`);
  }
  
  return lines.join('\n');
}

module.exports = { toMarkdownEnhanced };
