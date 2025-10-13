const path = require('path');
const { execFile } = require('child_process');

function execp(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const child = execFile(cmd, args, { maxBuffer: 10 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) {
        return resolve({ ok: false, error, stdout, stderr });
      }
      resolve({ ok: true, stdout, stderr });
    });
    if (options.timeout) {
      setTimeout(() => {
        try { child.kill(); } catch {}
      }, options.timeout);
    }
  });
}

async function which(cmd, platform = process.platform) {
  const finder = platform === 'win32' ? 'where' : 'which';
  const res = await execp(finder, [cmd], { timeout: 5000 });
  if (res.ok && res.stdout.trim()) return res.stdout.split(/\r?\n/)[0].trim();
  return null;
}

function mapSeverity(level) {
  // Normalize severities to our enum: low, medium, high, critical
  const s = String(level).toLowerCase();
  if (['critical', 'blocker'].includes(s)) return 'critical';
  if (['error', 'high', 'severe'].includes(s)) return 'high';
  if (['warning', 'warn', 'medium'].includes(s)) return 'medium';
  return 'low';
}

function pushFinding(arr, baseDir, item) {
  const file = path.relative(baseDir, item.file || '');
  arr.push({
    analyzer: item.analyzer,
    file,
    line: item.line || 1,
    column: item.column || 1,
    rule: item.rule || 'unknown',
    severity: item.severity || 'low',
    message: item.message || '',
    source: item.source,
    suggestion: item.suggestion,
    example: item.example,
    codeSnippet: item.codeSnippet,
  });
}

async function runESLint(baseDir, files) {
  const findings = [];
  if (files.length === 0) return findings;

  // Prefer local eslint in node_modules/.bin
  const localEslint = process.platform === 'win32' ?
    path.join(baseDir, 'node_modules', '.bin', 'eslint.cmd') :
    path.join(baseDir, 'node_modules', '.bin', 'eslint');

  let eslintCmd = localEslint;
  let eslintExists = false;
  if (await which(localEslint)) eslintExists = true; // unlikely 'where' on full path
  if (!eslintExists) {
    const res = await which('eslint');
    if (res) { eslintCmd = res; eslintExists = true; }
  }
  if (!eslintExists) return findings; // skip if not available

  const args = ['-f', 'json', ...files];
  const res = await execp(eslintCmd, args, { cwd: baseDir, timeout: 60000 });
  // eslint exits non-zero when there are findings; still parse stdout
  const out = (res.stdout || '').trim();
  if (!out) return findings;
  let json;
  try { json = JSON.parse(out); } catch { return findings; }
  for (const fileRes of json) {
    for (const msg of fileRes.messages || []) {
      pushFinding(findings, baseDir, {
        analyzer: 'typescript',
        file: fileRes.filePath,
        line: msg.line || 1,
        column: msg.column || 1,
        rule: msg.ruleId || 'eslint',
        severity: mapSeverity(msg.severity === 2 ? 'high' : 'medium'),
        message: msg.message,
        source: 'eslint',
        codeSnippet: msg.source,
      });
    }
  }
  return findings;
}

async function runPylint(baseDir, files) {
  const findings = [];
  if (files.length === 0) return findings;
  const cmd = await which('pylint');
  if (!cmd) return findings;
  const args = ['-f', 'json', ...files];
  const res = await execp(cmd, args, { cwd: baseDir, timeout: 60000 });
  const out = (res.stdout || '').trim();
  if (!out) return findings;
  let json;
  try { json = JSON.parse(out); } catch { return findings; }
  for (const m of json) {
    pushFinding(findings, baseDir, {
      analyzer: 'python',
      file: m.path,
      line: m.line || 1,
      column: m.column || 1,
      rule: m.symbol || m.message_id,
      severity: mapSeverity(m.type),
      message: m.message,
      source: 'pylint',
    });
  }
  return findings;
}

async function runBandit(baseDir, files) {
  const findings = [];
  const cmd = await which('bandit');
  if (!cmd) return findings;
  const pyFiles = files.filter(f => f.toLowerCase().endsWith('.py'));
  if (pyFiles.length === 0) return findings;
  const args = ['-f', 'json', '-q', ...pyFiles];
  const res = await execp(cmd, args, { cwd: baseDir, timeout: 60000 });
  const out = (res.stdout || '').trim();
  if (!out) return findings;
  let json;
  try { json = JSON.parse(out); } catch { return findings; }
  for (const r of json.results || []) {
    pushFinding(findings, baseDir, {
      analyzer: 'python',
      file: r.filename,
      line: r.line_number || 1,
      rule: r.test_id,
      severity: mapSeverity(r.issue_severity),
      message: r.issue_text,
      source: 'bandit',
    });
  }
  return findings;
}

async function runPMD(baseDir, files) {
  const findings = [];
  const cmd = await which('pmd');
  if (!cmd) return findings;
  const javaFiles = files.filter(f => f.toLowerCase().endsWith('.java'));
  if (javaFiles.length === 0) return findings;
  for (const f of javaFiles) {
    const args = ['-d', f, '-R', 'category/java/bestpractices.xml', '-f', 'json', '-no-cache'];
    const res = await execp(cmd, args, { cwd: baseDir, timeout: 60000 });
    const out = (res.stdout || '').trim();
    if (!out) continue;
    let json;
    try { json = JSON.parse(out); } catch { continue; }
    const filesArr = json.files || [];
    for (const fileObj of filesArr) {
      for (const v of fileObj.violations || []) {
        pushFinding(findings, baseDir, {
          analyzer: 'java',
          file: fileObj.filename,
          line: v.beginline || 1,
          rule: v.rule,
          severity: mapSeverity(v.priority <= 2 ? 'high' : v.priority === 3 ? 'medium' : 'low'),
          message: v.description,
          source: 'pmd',
        });
      }
    }
  }
  return findings;
}

async function runSemgrep(baseDir, files) {
  const findings = [];
  const cmd = await which('semgrep');
  if (!cmd) return findings;
  const args = ['--json', '--quiet', '--config', 'p/ci'];
  // Semgrep scans the directory; include only changed files via include flags
  for (const f of files) { args.push('--include', f); }
  const res = await execp(cmd, args, { cwd: baseDir, timeout: 120000 });
  const out = (res.stdout || '').trim();
  if (!out) return findings;
  let json;
  try { json = JSON.parse(out); } catch { return findings; }
  for (const r of json.results || []) {
    pushFinding(findings, baseDir, {
      analyzer: 'security',
      file: r.path,
      line: r.start?.line || 1,
      rule: r.check_id,
      severity: mapSeverity(r.extra?.severity || 'medium'),
      message: r.extra?.message || r.extra?.metadata?.shortlink || 'Semgrep finding',
      source: 'semgrep',
    });
  }
  return findings;
}

async function runHadolint(baseDir, files) {
  const findings = [];
  const cmd = await which('hadolint');
  if (!cmd) return findings;
  const dockerfiles = files.filter(f => /(^|\\|\/)Dockerfile(\.[^\\/]+)?$/i.test(f));
  if (dockerfiles.length === 0) return findings;
  for (const f of dockerfiles) {
    const res = await execp(cmd, ['--format', 'json', f], { cwd: baseDir, timeout: 60000 });
    const out = (res.stdout || '').trim();
    if (!out) continue;
    let json;
    try { json = JSON.parse(out); } catch { continue; }
    for (const m of json) {
      pushFinding(findings, baseDir, {
        analyzer: 'docker',
        file: f,
        line: m.line || 1,
        rule: m.code,
        severity: mapSeverity(m.level),
        message: m.message,
        source: 'hadolint',
      });
    }
  }
  return findings;
}

async function runCheckov(baseDir) {
  const findings = [];
  const cmd = await which('checkov');
  if (!cmd) return findings;
  const res = await execp(cmd, ['-d', '.', '-o', 'json'], { cwd: baseDir, timeout: 180000 });
  const out = (res.stdout || '').trim();
  if (!out) return findings;
  let json;
  try { json = JSON.parse(out); } catch { return findings; }
  const checks = json?.results?.failed_checks || [];
  for (const c of checks) {
    pushFinding(findings, baseDir, {
      analyzer: 'security',
      file: c.file_path || '',
      line: c.file_line_range ? c.file_line_range[0] : 1,
      rule: c.check_id,
      severity: mapSeverity(c.severity || 'medium'),
      message: c.check_name,
      source: 'checkov',
    });
  }
  return findings;
}

async function runNpmAudit(baseDir) {
  const findings = [];
  // Only run if package.json present
  const pkg = require('fs');
  if (!pkg.existsSync(path.join(baseDir, 'package.json'))) return findings;
  const npmCmd = await which('npm');
  if (!npmCmd) return findings;
  const res = await execp(npmCmd, ['audit', '--json', '--audit-level=low'], { cwd: baseDir, timeout: 60000 });
  const out = (res.stdout || '').trim();
  if (!out) return findings;
  let json; try { json = JSON.parse(out); } catch { return findings; }
  const advisories = json?.advisories || json?.vulnerabilities || {};
  // Newer npm returns vulnerabilities as object keyed by severity categories
  if (json?.vulnerabilities) {
    for (const [name, meta] of Object.entries(json.vulnerabilities)) {
      const via = meta.via || [];
      for (const v of via) {
        if (typeof v === 'string') continue;
        findings.push({
          analyzer: 'security',
          file: 'package-lock.json',
          line: 1,
          rule: v.title || v.name || 'npm-audit',
          severity: (v.severity || 'medium').toLowerCase(),
          message: `${name}@${meta.effects?.[0] || ''} - ${v.title || ''}`.trim(),
          source: 'npm-audit',
          suggestion: v.url || 'Run npm audit fix or update the dependency.',
        });
      }
    }
  } else if (advisories && typeof advisories === 'object') {
    for (const adv of Object.values(advisories)) {
      findings.push({
        analyzer: 'security',
        file: 'package-lock.json',
        line: 1,
        rule: adv.module_name || adv.title || 'npm-audit',
        severity: (adv.severity || 'medium').toLowerCase(),
        message: `${adv.module_name} ${adv.findings?.[0]?.version || ''} ${adv.title || ''}`.trim(),
        source: 'npm-audit',
        suggestion: adv.url || 'Run npm audit fix or update the dependency.',
      });
    }
  }
  return findings;
}

async function runPipAuditDeps(baseDir) {
  const findings = [];
  const cmd = await which('pip-audit');
  if (!cmd) return findings;
  const res = await execp(cmd, ['-f', 'json'], { cwd: baseDir, timeout: 60000 });
  const out = (res.stdout || '').trim();
  if (!out) return findings;
  let json; try { json = JSON.parse(out); } catch { return findings; }
  for (const v of json || []) {
    findings.push({
      analyzer: 'security',
      file: 'requirements.txt',
      line: 1,
      rule: v.advisory?.id || 'pip-audit',
      severity: (v.advisory?.severity || 'medium').toLowerCase(),
      message: `${v.name} ${v.version} - ${v.advisory?.summary || ''}`.trim(),
      source: 'pip-audit',
      suggestion: v.fix_versions?.length ? `Update to ${v.fix_versions.join(', ')}` : 'Update dependency to a fixed version.',
    });
  }
  return findings;
}

async function runSafety(baseDir) {
  const findings = [];
  const cmd = await which('safety');
  if (!cmd) return findings;
  const res = await execp(cmd, ['check', '--json'], { cwd: baseDir, timeout: 60000 });
  const out = (res.stdout || '').trim();
  if (!out) return findings;
  let json; try { json = JSON.parse(out); } catch { return findings; }
  const vulns = json?.vulnerabilities || [];
  for (const v of vulns) {
    findings.push({
      analyzer: 'security',
      file: 'requirements.txt',
      line: 1,
      rule: v.vulnerability_id || 'safety',
      severity: (v.severity || 'medium').toLowerCase(),
      message: `${v.package_name} ${v.affected_versions} - ${v.description || ''}`.trim(),
      source: 'safety',
      suggestion: v.fixed_versions?.length ? `Update to ${v.fixed_versions.join(', ')}` : 'Update dependency.',
    });
  }
  return findings;
}

async function runSnyk(baseDir) {
  const findings = [];
  const cmd = await which('snyk');
  if (!cmd) return findings;
  const res = await execp(cmd, ['test', '--json'], { cwd: baseDir, timeout: 90000 });
  const out = (res.stdout || '').trim();
  if (!out) return findings;
  let json; try { json = JSON.parse(out); } catch { return findings; }
  const issues = json.vulnerabilities || json.issues?.vulnerabilities || [];
  for (const v of issues) {
    findings.push({
      analyzer: 'security',
      file: v.from?.[0] || '',
      line: 1,
      rule: v.id || 'snyk',
      severity: (v.severity || 'medium').toLowerCase(),
      message: `${v.packageName}@${v.version} - ${v.title}`,
      source: 'snyk',
      suggestion: v.documentation || v.semver || 'Update dependency',
    });
  }
  return findings;
}

async function runTrivy(baseDir) {
  const findings = [];
  const cmd = await which('trivy');
  if (!cmd) return findings;
  const res = await execp(cmd, ['fs', '-q', '-f', 'json', '.'], { cwd: baseDir, timeout: 120000 });
  const out = (res.stdout || '').trim();
  if (!out) return findings;
  let json; try { json = JSON.parse(out); } catch { return findings; }
  for (const r of json.Results || []) {
    for (const v of r.Vulnerabilities || []) {
      findings.push({
        analyzer: 'security',
        file: r.Target || '',
        line: 1,
        rule: v.VulnerabilityID || 'trivy',
        severity: (v.Severity || 'MEDIUM').toLowerCase(),
        message: `${v.PkgName} ${v.InstalledVersion} - ${v.Title}`,
        source: 'trivy',
        suggestion: v.PrimaryURL || 'Update dependency or apply vendor advisory.',
      });
    }
  }
  return findings;
}

async function analyzeExternal(baseDir, changed) {
  const jsTsFiles = changed.filter(f => /\.(js|jsx|ts|tsx)$/i.test(f));
  const pyFiles = changed.filter(f => /\.(py)$/i.test(f));
  const javaFiles = changed.filter(f => /\.(java)$/i.test(f));
  const allFindings = [];

  const [eslintF, pylintF, banditF, pmdF, semgrepF, hadolintF, checkovF, npmAuditF, pipAuditF, safetyF, snykF, trivyF] = await Promise.all([
    runESLint(baseDir, jsTsFiles).catch(() => []),
    runPylint(baseDir, pyFiles).catch(() => []),
    runBandit(baseDir, pyFiles).catch(() => []),
    runPMD(baseDir, javaFiles).catch(() => []),
    runSemgrep(baseDir, changed).catch(() => []),
    runHadolint(baseDir, changed).catch(() => []),
    runCheckov(baseDir).catch(() => []),
    runNpmAudit(baseDir).catch(() => []),
    runPipAuditDeps(baseDir).catch(() => []),
    runSafety(baseDir).catch(() => []),
    runSnyk(baseDir).catch(() => []),
    runTrivy(baseDir).catch(() => []),
  ]);

  allFindings.push(
    ...eslintF,
    ...pylintF,
    ...banditF,
    ...pmdF,
    ...semgrepF,
    ...hadolintF,
    ...checkovF,
    ...npmAuditF,
    ...pipAuditF,
    ...safetyF,
    ...snykF,
    ...trivyF,
  );

  return {
    findings: allFindings,
    breakdown: {
      eslint: eslintF.length,
      pylint: pylintF.length,
      bandit: banditF.length,
      pmd: pmdF.length,
      semgrep: semgrepF.length,
      hadolint: hadolintF.length,
      checkov: checkovF.length,
      "npm-audit": npmAuditF.length,
      "pip-audit": pipAuditF.length,
      safety: safetyF.length,
      snyk: snykF.length,
      trivy: trivyF.length,
    }
  };
}

module.exports = { analyzeExternal };