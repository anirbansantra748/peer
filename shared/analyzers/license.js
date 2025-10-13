const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

async function analyzeLicense(baseDir, files) {
  const findings = [];

  // 1) LICENSE file presence
  const licenseFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING'];
  const hasLicense = await anyExists(baseDir, licenseFiles.map((f) => path.join(baseDir, f)));
  if (!hasLicense) {
    findings.push({
      analyzer: 'license',
      source: 'license-analyzer',
      file: 'LICENSE',
      line: 1,
      column: 1,
      rule: 'missing-license-file',
      severity: 'low',
      message: 'Repository is missing a LICENSE file.',
      suggestion: 'Add a standard LICENSE (MIT/Apache-2.0/BSD-3-Clause) at the repository root.',
      example: 'diff\n+ Add LICENSE file with appropriate text',
      reason: 'Explicit licensing is required for compliance and distribution.',
      cwe: [], owasp: [], severityWeight: 1,
    });
  }

  // 2) package.json license field
  const pkgPath = path.join(baseDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await fsp.readFile(pkgPath, 'utf8'));
      if (!pkg.license) {
        findings.push({
          analyzer: 'license',
          source: 'license-analyzer',
          file: 'package.json',
          line: 1,
          column: 1,
          rule: 'missing-package-license',
          severity: 'low',
          message: 'package.json missing "license" field.',
          suggestion: 'Add a valid SPDX license identifier in package.json (e.g., "MIT").',
          example: 'diff\n  "license": "MIT"',
          reason: 'Dependency consumers rely on SPDX license for compliance.',
          cwe: [], owasp: [], severityWeight: 1,
        });
      }
    } catch {}
  }

  // 3) Dependency freshness (npm outdated) — optional best-effort
  const outdated = await tryNpmOutdated(baseDir).catch(() => null);
  if (outdated && outdated.ok) {
    for (const pkg of outdated.packages) {
      const sev = pkg.bump === 'major' ? 'medium' : 'low';
      findings.push({
        analyzer: 'license',
        source: 'license-analyzer',
        file: 'package.json',
        line: 1,
        column: 1,
        rule: 'dependency-outdated',
        severity: sev,
        message: `${pkg.name} is outdated (current ${pkg.current}, wanted ${pkg.wanted}, latest ${pkg.latest}).`,
        suggestion: `Upgrade ${pkg.name} to ^${pkg.latest} (bump: ${pkg.bump}).`,
        example: `diff\n- "${pkg.name}": "${pkg.spec}"\n+ "${pkg.name}": "^${pkg.latest}"`,
        reason: 'Staying current reduces security and compatibility risks.',
        cwe: [], owasp: [], severityWeight: sev === 'medium' ? 2 : 1,
      });
    }
  }

  return findings;
}

async function anyExists(baseDir, absPaths) {
  for (const p of absPaths) {
    try { await fsp.access(p); return true; } catch {}
  }
  return false;
}

async function tryNpmOutdated(cwd, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    let child;
    try {
      child = spawn(npm, ['outdated', '--json'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      return resolve({ ok: false, reason: 'spawn-error' });
    }
    let out = '';
    let err = '';
    const t = setTimeout(() => { try { child.kill(); } catch {} resolve({ ok: false, reason: 'timeout' }); }, timeoutMs);
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('close', () => {
      clearTimeout(t);
      try {
        const json = JSON.parse(out || '{}');
        const packages = Object.keys(json).map((name) => ({
          name,
          current: json[name].current,
          wanted: json[name].wanted,
          latest: json[name].latest,
          location: json[name].location,
          spec: json[name].wanted || json[name].current,
          bump: classifyBump(json[name].current, json[name].latest),
        }));
        resolve({ ok: true, packages });
      } catch (e) {
        resolve({ ok: false, reason: 'parse', out: out.slice(0, 1000), err: err.slice(0, 1000) });
      }
    });
  });
}

function classifyBump(current, latest) {
  const parse = (v) => String(v || '').replace(/^v/, '').split('-')[0].split('.').map((x) => parseInt(x, 10) || 0);
  const [cM, cMnr] = parse(current);
  const [lM, lMnr] = parse(latest);
  if (lM > cM) return 'major';
  if (lM === cM && lMnr > cMnr) return 'minor';
  return 'patch';
}

module.exports = { analyzeLicense };