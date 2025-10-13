const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const simpleGit = require('simple-git');
const { ESLint } = require('eslint');
const logger = require('../utils/prettyLogger');

function safeRepoUrl(repo) {
  const token = process.env.GITHUB_TOKEN;
  if (token) return `https://x-access-token:${token}@github.com/${repo}.git`;
  return `https://github.com/${repo}.git`;
}

async function getChangedFiles(baseDir, baseSha, headSha) {
  const git = simpleGit({ baseDir });
  try {
    if (baseSha) {
      const out = await git.diff(['--name-only', `${baseSha}..${headSha}`]);
      return out.split(/\r?\n/).filter(Boolean);
    }
    const out = await git.diff(['--name-only', `${headSha}~1..${headSha}`]);
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

async function runESLintOnFiles(baseDir, files) {
  const targets = files.map((f) => (path.isAbsolute(f) ? f : path.join(baseDir, f)));
  const findings = [];
  try {
    // Use bundled flat config so ESLint works even if target repo has no config
    const configFile = path.resolve(__dirname, '..', '..', 'eslint.config.js');
    const eslint = new ESLint({
      cwd: baseDir,
      overrideConfigFile: configFile,
      errorOnUnmatchedPattern: false,
    });
    const { mapRuleToSuggestion } = require('../suggestions/map');
    const results = await eslint.lintFiles(targets);
    for (const res of results) {
      for (const m of res.messages || []) {
        const sev = m.severity === 2 ? 'high' : 'medium';
        const ruleId = m.ruleId || 'eslint-issue';
        const suggestion = mapRuleToSuggestion(ruleId, 'Follow ESLint rule; run eslint --fix when possible');
        findings.push({
          file: path.relative(baseDir, res.filePath),
          line: m.line || 1,
          rule: ruleId,
          severity: sev,
          message: m.message,
          source: 'static-analysis',
          suggestion,
        });
      }
    }
  } catch (e) {
    logger.warn('analyzer', 'ESLint unavailable or config error; skipping ESLint', { error: String(e && e.message ? e.message : e) });
    return [];
  }
  return findings;
}

async function scanCodeHeuristics(baseDir, files) {
  const patterns = [
    { id: 'no-eval', re: /\beval\s*\(/, severity: 'high', message: 'Avoid eval() – security risk' },
    { id: 'child-process-exec', re: /child_process\.(exec|execSync)/, severity: 'medium', message: 'Avoid shelling out without sanitization' },
    { id: 'console-log-secret', re: /(secret|api[-_]?key|token)/i, severity: 'low', message: 'Possible secret referenced in logs' },
  ];
  const findings = [];
  for (const f of files) {
    const full = path.isAbsolute(f) ? f : path.join(baseDir, f);
    try {
      const text = await fsp.readFile(full, 'utf8');
      const lines = text.split(/\r?\n/);
      for (const p of patterns) {
        lines.forEach((l, idx) => {
          if (p.re.test(l)) {
            findings.push({
              file: path.relative(baseDir, full),
              line: idx + 1,
              rule: p.id,
              severity: p.severity,
              message: p.message,
              source: 'static-analysis',
              suggestion: 'Refactor to safer alternative',
            });
          }
        });
      }
    } catch {}
  }
  return findings;
}

async function scanIaCMatches(filePath) {
  const text = await fsp.readFile(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const findings = [];
  const rules = [
    { id: 'iac-open-cidr', re: /0\.0\.0\.0\/0/, severity: 'high', message: 'Open CIDR found (0.0.0.0/0)' },
    { id: 'iac-plaintext-aws-key', re: /(aws_access_key_id|aws_secret_access_key)\s*[:=]/i, severity: 'high', message: 'Possible AWS credential in config' },
    { id: 'iac-public-read', re: /(public-read|public-read-write)/i, severity: 'medium', message: 'Public access setting detected' },
  ];
  rules.forEach((rule) => {
    lines.forEach((l, idx) => {
      if (rule.re.test(l)) {
        findings.push({ line: idx + 1, rule: rule.id, severity: rule.severity, message: rule.message });
      }
    });
  });
  return findings;
}

async function tryNpmAudit(cwd, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npm, ['audit', '--json', '--no-audit=false'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const t = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ ok: false, reason: 'timeout' });
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('close', () => {
      clearTimeout(t);
      try {
        const json = JSON.parse(out || '{}');
        const audit = json.vulnerabilities || {};
        const summary = {
          info: audit.info?.count || audit.info || 0,
          low: audit.low?.count || audit.low || 0,
          moderate: audit.moderate?.count || audit.moderate || 0,
          high: audit.high?.count || audit.high || 0,
          critical: audit.critical?.count || audit.critical || 0,
        };
        resolve({ ok: true, summary });
      } catch (e) {
        resolve({ ok: false, reason: 'parse', out: out.slice(0, 1000), err: err.slice(0, 1000) });
      }
    });
  });
}

function severityFromCounts(counts) {
  if ((counts.critical || 0) > 0) return 'critical';
  if ((counts.high || 0) > 0) return 'high';
  if ((counts.moderate || 0) > 0 || (counts.medium || 0) > 0) return 'medium';
  if ((counts.low || 0) > 0) return 'low';
  return 'low';
}

async function trySemgrep(baseDir, files, timeoutMs = 30000) {
  if (process.env.PEER_DISABLE_SEMGREP === '1') return [];
  // Only analyze JS/TS for now
  const targets = files.filter((f) => /\.(js|jsx|ts|tsx)$/.test(f));
  if (!targets.length) return [];
  const absTargets = targets.map((f) => (path.isAbsolute(f) ? f : path.join(baseDir, f)));

  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'semgrep.exe' : 'semgrep';
    let child;
    try {
      child = spawn(cmd, ['--json', '--config', 'p/javascript', '--config', 'p/security-audit', ...absTargets], { cwd: baseDir, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      logger.warn('analyzer', 'Semgrep not available (spawn threw)', { error: String(e) });
      return resolve([]);
    }
    let out = '';
    let err = '';
    const t = setTimeout(() => {
      try { child.kill(); } catch {}
      resolve([]);
    }, timeoutMs);

    child.on('error', (e) => {
      logger.warn('analyzer', 'Semgrep not available (spawn error)', { error: String(e) });
      clearTimeout(t);
      resolve([]);
    });

    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (err += d.toString()))
    child.on('close', () => {
      clearTimeout(t);
      try {
        const json = JSON.parse(out || '{}');
        const results = json.results || [];
        const findings = results.map((r) => ({
          file: path.relative(baseDir, r.path),
          line: r.start?.line || 1,
          rule: r.check_id || 'semgrep-issue',
          severity: r.severity && r.severity.toLowerCase() === 'error' ? 'high' : r.severity && r.severity.toLowerCase() === 'warning' ? 'medium' : 'low',
          message: r.extra?.message || 'Semgrep finding',
          source: 'static-analysis',
          suggestion: r.extra?.metadata?.fix || 'Follow rule remediation guidance',
        }));
        resolve(findings);
      } catch (e) {
        logger.warn('analyzer', 'Failed to parse Semgrep output', { error: String(e), err: err.slice(0, 500) });
        resolve([]);
      }
    });
  });
}

async function analyzeRepo({ repo, sha, baseSha }) {
  let tempDir;
  const cleanup = async () => {
    if (tempDir) {
      try { await fsp.rm(tempDir, { recursive: true, force: true }); } catch {}
    }
  };
  try {
    tempDir = path.join(os.tmpdir(), `peer-analyze-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsp.mkdir(tempDir, { recursive: true });

    const cloneUrl = safeRepoUrl(repo);
    const git = simpleGit();
    await git.clone(cloneUrl, tempDir);
    const git2 = simpleGit({ baseDir: tempDir });
    await git2.checkout(sha);

    const changed = await getChangedFiles(tempDir, baseSha, sha);

    // Dependency summary + audit
    let pkgInfo = null;
    const pkgPath = path.join(tempDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(await fsp.readFile(pkgPath, 'utf8'));
      pkgInfo = { deps: Object.keys(pkg.dependencies || {}).length, devDeps: Object.keys(pkg.devDependencies || {}).length };
    }
    let auditSummary = null;
    if (pkgInfo) {
      const audit = await tryNpmAudit(tempDir).catch(() => null);
      if (audit && audit.ok) auditSummary = audit.summary;
    }

    // ESLint + heuristics + Semgrep on changed code files
    const codeChanged = changed.filter((f) => /\.(js|jsx|ts|tsx)$/.test(f));
    const findings = [];
    if (codeChanged.length) {
      try { findings.push(...(await runESLintOnFiles(tempDir, codeChanged))); } catch {}
      findings.push(...(await scanCodeHeuristics(tempDir, codeChanged)));
      findings.push(...(await trySemgrep(tempDir, codeChanged)));
    }

    // IaC matches on changed YAML/Terraform
    const changedIaC = changed.filter((f) => ['.tf', '.yaml', '.yml'].includes(path.extname(f).toLowerCase()));
    for (const file of changedIaC) {
      const matches = await scanIaCMatches(path.isAbsolute(file) ? file : path.join(tempDir, file));
      matches.forEach((m) => findings.push({ file: path.relative(tempDir, file), ...m, source: 'iac-scan', suggestion: 'Harden configuration' }));
    }

    if (pkgInfo) {
      findings.push({ file: 'package.json', line: 1, rule: 'dependency-summary', severity: 'low', message: `Dependencies: ${pkgInfo.deps} deps, ${pkgInfo.devDeps} devDeps`, source: 'dependency-scan', suggestion: 'Review dependency updates regularly' });
    }
    if (auditSummary) {
      findings.push({ file: 'package.json', line: 1, rule: 'npm-audit-summary', severity: severityFromCounts(auditSummary), message: `Vulns - low:${auditSummary.low||0} moderate:${auditSummary.moderate||0} high:${auditSummary.high||0} critical:${auditSummary.critical||0}` , source: 'dependency-scan', suggestion: 'Run `npm audit fix` or update affected packages' });
    }

    return { tempDir, findings, changed };
  } catch (e) {
    await cleanup();
    throw e;
  }
}

module.exports = {
  analyzeRepo,
  safeRepoUrl,
  getChangedFiles,
  runESLintOnFiles,
  scanCodeHeuristics,
  scanIaCMatches,
  tryNpmAudit,
  severityFromCounts,
  trySemgrep,
};
