#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { analyzeRepoDeep } = require('../shared/analyzers');
const { orchestrate } = require('../shared/orchestrator');
const { aiSummarizeFindings } = require('../shared/llm/summarize');
const { toMarkdownEnhanced } = require('../shared/report/format');
const logger = require('../shared/utils/logger');

async function loadGitHubEvent() {
  try {
    const p = process.env.GITHUB_EVENT_PATH;
    if (!p || !fs.existsSync(p)) return null;
    const txt = fs.readFileSync(p, 'utf8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function sevEmoji(sev) {
  return sev === 'critical' ? '🔴' : sev === 'high' ? '🟠' : sev === 'medium' ? '🔵' : '🟢';
}

function toMarkdown(repo, prNumber, summary, findings) {
  const counts = [
    { k: 'critical', label: 'Critical' },
    { k: 'high', label: 'High' },
    { k: 'medium', label: 'Medium' },
    { k: 'low', label: 'Low' },
  ];
  const total = (summary.low||0) + (summary.medium||0) + (summary.high||0) + (summary.critical||0);
  let md = `Peer Review Summary — PR #${prNumber} (repo: ${repo})\n\n`;
  md += `Found ${total} issues:` + '\n';
  for (const c of counts) {
    const v = summary[c.k] || 0;
    if (v) md += `${sevEmoji(c.k)} ${v} ${c.label}` + '\n';
  }
  md += '\nSuggestions:' + '\n';
  const top = findings.slice(0, 10);
  for (const f of top) {
    md += `- ${sevEmoji(f.severity)} ${f.file}:${f.line} — ${f.rule}: ${f.message}` + (f.suggestion ? `\n  • ${f.suggestion}` : '') + '\n';
  }
  if (findings.length > top.length) {
    md += `\n…and ${findings.length - top.length} more.`;
  }
  return md;
}

async function main() {
  const event = await loadGitHubEvent();
  const repo = process.env.GITHUB_REPOSITORY || event?.repository?.full_name;
  const prNumber = event?.pull_request?.number;
  const sha = event?.pull_request?.head?.sha || process.env.GITHUB_SHA;
  const baseSha = event?.pull_request?.base?.sha || process.env.GITHUB_BASE_SHA;

  if (!repo || !prNumber || !sha) {
    console.error('[peer] Missing repo/prNumber/sha from GitHub context');
    process.exit(2);
  }

  logger.info('gha', 'Starting analysis', { repo, prNumber, sha, baseSha });

  const { findings, analyzerResults } = await analyzeRepoDeep({ repo, sha, baseSha });
  const { findings: finalFindings, summary } = orchestrate(findings);

  // Get AI improvement plan (uses OPENAI_API_KEY if set; safe fallback otherwise)
  const aiSuggestions = await aiSummarizeFindings(finalFindings);

  const outDir = process.env.GITHUB_WORKSPACE || process.cwd();
  const jsonPath = path.join(outDir, 'peer-report.json');
  const mdPath = path.join(outDir, 'peer-summary.md');
  fs.writeFileSync(jsonPath, JSON.stringify({ repo, prNumber, sha, baseSha, summary, findings: finalFindings, analyzerResults, aiSuggestions }, null, 2));
  const md = toMarkdownEnhanced({ repo, prNumber, summary, findings: finalFindings, aiSuggestions, analyzerResults });
  fs.writeFileSync(mdPath, md, 'utf8');

  logger.info('gha', 'Analysis completed', { repo, prNumber, summary });

  // Post PR comment if token available
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    try {
      const { Octokit } = require('@octokit/rest');
      const [owner, repoName] = repo.split('/');
      const octokit = new Octokit({ auth: token });
      await octokit.rest.issues.createComment({ owner, repo: repoName, issue_number: prNumber, body: md });
      logger.info('gha', 'Posted PR comment', { prNumber });
    } catch (e) {
      logger.warn('gha', 'Failed to post PR comment', { error: String(e) });
    }
  } else {
    logger.warn('gha', 'GITHUB_TOKEN not set; skipping PR comment');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
