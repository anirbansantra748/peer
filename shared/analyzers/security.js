const fsp = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

/**
 * Security & Major Errors Analyzer
 * Checks: SQL injection, XSS, eval, unsafe regex, hardcoded secrets, crypto issues
 */
async function analyzeSecurity(baseDir, files) {
  const findings = [];
  
  // 1. Pattern-based security checks
  const patternFindings = await scanSecurityPatterns(baseDir, files);
  findings.push(...patternFindings);

  // 1b. Config files (.env/.yaml/.yml/.json) secret scanning
  findings.push(...(await scanConfigForSecrets(baseDir, files)));

  // 1c. Express app hardening (helmet/CSRF)
  findings.push(...(await scanExpressHardening(baseDir, files)));
  
  // 2. Semgrep security rules (if available)
  if (process.env.PEER_DISABLE_SEMGREP !== '1') {
    const semgrepFindings = await runSemgrepSecurity(baseDir, files);
    findings.push(...semgrepFindings);
  }
  
  return findings;
}

async function scanSecurityPatterns(baseDir, files) {
  const findings = [];
  
  const patterns = [
    // Secrets & credentials (CWE-798)
    {
      id: 'secret-aws-access-key',
      re: /(?<![A-Z0-9])[A-Z0-9]{20}(?![A-Z0-9])|AKIA[0-9A-Z]{16}/,
      severity: 'critical',
      message: 'Possible AWS Access Key detected',
      suggestion: 'Revoke and rotate the key. Use IAM roles or env vars managed by secret stores.',
      example: '❌ AKIA...\n✅ Use IAM role or secrets manager',
      reason: 'Hardcoded cloud credentials can be exfiltrated and abused.',
      cwe: ['CWE-798'], owasp: ['OWASP-A02:2021'],
    },
    {
      id: 'secret-aws-secret-key',
      re: /aws.{0,20}(?:secret|sk)[^\n"'=]{0,5}["'][A-Za-z0-9\/+]{40}["']/i,
      severity: 'critical',
      message: 'Possible AWS Secret Access Key detected',
      suggestion: 'Revoke and rotate the key. Use secrets manager. Never commit secrets.',
      example: '❌ aws_secret=...\n✅ Use secret manager',
      reason: 'Hardcoded cloud credentials can be exfiltrated and abused.',
      cwe: ['CWE-798'], owasp: ['OWASP-A02:2021'],
    },
    {
      id: 'secret-gcp-service-account',
      re: /"type"\s*:\s*"service_account"\s*,\s*"project_id"\s*:\s*"[^"]+"/,
      severity: 'critical',
      message: 'Google Cloud service account JSON detected in repo',
      suggestion: 'Remove and rotate. Store in secret manager, not VCS.',
      example: '❌ service account JSON committed\n✅ Use secret manager file mounts',
      reason: 'Service account keys grant broad access when leaked.',
      cwe: ['CWE-798'], owasp: ['OWASP-A02:2021'],
    },
    // Unsafe deserialization (CWE-502)
    {
      id: 'unsafe-deserialization-java (CWE-502)',
      re: /ObjectInputStream\s*\(\s*new\s*FileInputStream|readObject\s*\(/,
      severity: 'high',
      message: 'Java unsafe deserialization pattern',
      suggestion: 'Avoid native Java serialization. Use safe formats (JSON) or validate classes via ObjectInputFilter.',
      example: '✅ ObjectInputFilter and whitelisting',
    },
    {
      id: 'unsafe-deserialization-py (CWE-502)',
      re: /pickle\.(loads?|load)\s*\(/i,
      severity: 'high',
      message: 'Python pickle load on untrusted data',
      suggestion: 'Do not unpickle untrusted data. Use JSON or safer formats.',
      example: '❌ pickle.load(f)\n✅ json.load(f)',
    },
    // SSRF (CWE-918)
    {
      id: 'ssrf-user-controlled-url',
      re: /(fetch|axios\.(get|post)|http\.(get|request)|requests\.(get|post)|urllib\.(request|urlopen))\s*\(\s*\w+\s*\)/i,
      severity: 'high',
      message: 'Potential SSRF: HTTP call with user-controlled URL',
      suggestion: 'Validate URL against allowlist, block private IPs/hosts, and enforce protocols (https).',
      example: '✅ Validate and proxy outbound requests',
      reason: 'Unsanitized user-controlled URLs can access internal resources.',
      cwe: ['CWE-918'], owasp: ['OWASP-A10:2021'],
    },
    // Path traversal (CWE-22)
    {
      id: 'path-traversal',
      re: /(\.\.[\\\/] )|\b(?:path|os|fs)\.(?:join|open|readFile(?:Sync)?|createReadStream)\([^)]*\w[^)]*\)/i,
      severity: 'high',
      message: 'Path traversal pattern or dynamic path usage detected',
      suggestion: 'Normalize and validate paths; restrict to allowed base directories.',
      example: '✅ path.join(BASE, sanitize(userInput))',
      reason: 'Unvalidated relative paths can escape intended directories.',
      cwe: ['CWE-22'], owasp: ['OWASP-A01:2021'],
    },
    // Existing rules
    {
      id: 'no-eval',
      re: /\beval\s*\(/,
      severity: 'critical',
      message: 'Use of eval() detected - major security risk (code injection)',
      suggestion: 'Remove eval(). Use JSON.parse for data, or refactor to safe alternatives.',
      example: `❌ eval(userInput) // Can execute arbitrary code\n✅ JSON.parse(userInput) // Safe for JSON data`,
      reason: 'Eval executes arbitrary code in the current scope.',
      cwe: ['CWE-94'], owasp: ['OWASP-A03:2021'],
    },
    {
      id: 'dangerous-innerHTML',
      re: /\.innerHTML\s*=/,
      severity: 'high',
      message: 'Setting innerHTML can lead to XSS vulnerabilities',
      suggestion: 'Use textContent for plain text, or sanitize HTML with DOMPurify before setting innerHTML.',
      example: `❌ element.innerHTML = userInput\n✅ element.textContent = userInput // or DOMPurify.sanitize(userInput)`,
      reason: 'Injecting HTML without sanitization can execute scripts.',
      cwe: ['CWE-79'], owasp: ['OWASP-A03:2021'],
    },
    {
      id: 'sql-injection-risk',
      re: /(query|execute)\s*\(\s*[`'\"]\s*SELECT.*\+|query\s*\(\s*.*\$\{/i,
      severity: 'critical',
      message: 'Possible SQL injection - string concatenation in SQL query',
      suggestion: 'Use parameterized queries or prepared statements. Never concatenate user input into SQL.',
      example: `❌ db.query('SELECT * FROM users WHERE id = ' + userId)\n✅ db.query('SELECT * FROM users WHERE id = ?', [userId])`,
      reason: 'Concatenating untrusted input into SQL enables injection.',
      cwe: ['CWE-89'], owasp: ['OWASP-A03:2021'],
    },
    {
      id: 'hardcoded-secret',
      re: /(api[-_]?key|password|secret|token)\s*[:=]\s*['\"][a-zA-Z0-9]{16,}/i,
      severity: 'critical',
      message: 'Possible hardcoded secret/API key detected',
      suggestion: 'Move secrets to environment variables or secret manager. Never commit secrets to version control.',
      example: `❌ const apiKey = \"sk_live_abc123def456\"\n✅ const apiKey = process.env.API_KEY`,
      reason: 'Secrets in code are easily leaked via VCS and logs.',
      cwe: ['CWE-798'], owasp: ['OWASP-A02:2021'],
    },
    {
      id: 'unsafe-regex',
      re: /new\s+RegExp\s*\(\s*[^)]*\+/,
      severity: 'high',
      message: 'Dynamically constructed regex can lead to ReDoS',
      suggestion: 'Use static regex patterns. If dynamic regex is needed, validate and sanitize input carefully.',
      example: `❌ new RegExp(userInput + '*')\n✅ const pattern = /^[a-zA-Z0-9]+$/; pattern.test(userInput)`,
      reason: 'Unbounded backtracking on crafted input can cause DoS.',
      cwe: ['CWE-1333'], owasp: ['OWASP-A06:2021'],
    },
    {
      id: 'child-process-injection',
      re: /exec(?:Sync)?\s*\([^)]*\$\{|exec(?:Sync)?\s*\([^)]*\+/,
      severity: 'critical',
      message: 'Command injection risk - exec with user input',
      suggestion: 'Use execFile with array arguments, or validate/sanitize all inputs. Never pass raw user input to shell commands.',
      example: `❌ exec('ls ' + userPath)\n✅ execFile('ls', [userPath])`,
      reason: 'Unsanitized shell arguments allow arbitrary command execution.',
      cwe: ['CWE-78'], owasp: ['OWASP-A03:2021'],
    },
    {
      id: 'weak-crypto',
      re: /(md5|sha1)\s*\(/i,
      severity: 'medium',
      message: 'Weak cryptographic algorithm (MD5/SHA1)',
      suggestion: 'Use SHA-256 or stronger. For passwords, use bcrypt, scrypt, or argon2.',
      example: `❌ crypto.createHash('md5')\n✅ crypto.createHash('sha256') // or bcrypt for passwords`,
      reason: 'MD5/SHA1 are broken and unsuitable for security-sensitive uses.',
      cwe: ['CWE-327'], owasp: ['OWASP-A02:2021'],
    },
    {
      id: 'http-not-https',
      re: /['\"]http:\/\//,
      severity: 'medium',
      message: 'HTTP URL detected (should use HTTPS)',
      suggestion: 'Replace http:// with https:// to ensure encrypted communication.',
      example: `❌ fetch('http://api.example.com')\n✅ fetch('https://api.example.com')`,
      reason: 'Plain HTTP allows eavesdropping and tampering.',
      cwe: ['CWE-319'], owasp: ['OWASP-A02:2021'],
    },
    {
      id: 'console-log-in-prod',
      re: /console\.(log|debug|info|warn|error|trace)\(/,
      severity: 'low',
      message: 'Console statement detected - should be removed in production',
      suggestion: 'Remove console statements or use proper logging library for production.',
      example: `❌ console.log('debug:', data)\n✅ logger.debug('data:', data) // or remove`,
    },
    {
      id: 'debugger-statement',
      re: /\bdebugger\b/,
      severity: 'medium',
      message: 'Debugger statement detected - must be removed before production',
      suggestion: 'Remove debugger statements. They halt execution in production.',
      example: `❌ debugger;\n✅ // Remove this line`,
    },
    {
      id: 'alert-prompt-confirm',
      re: /\b(alert|prompt|confirm)\s*\(/,
      severity: 'medium',
      message: 'Browser alert/prompt/confirm detected - poor UX',
      suggestion: 'Use custom modal dialogs or toast notifications for better user experience.',
      example: `❌ alert('Error occurred')\n✅ showToast('Error occurred', 'error')`,
    },
    {
      id: 'localstorage-sensitive-data',
      re: /(localStorage|sessionStorage)\.(setItem|set).*(?:password|token|secret|key)/i,
      severity: 'critical',
      message: 'Storing sensitive data in localStorage - security risk',
      suggestion: 'Never store sensitive data in localStorage. Use secure httpOnly cookies or memory only.',
      example: `❌ localStorage.setItem('token', authToken)\n✅ // Store in httpOnly cookie or memory`,
      reason: 'Data in web storage is accessible to JS and subject to XSS exfiltration.',
      cwe: ['CWE-922'], owasp: ['OWASP-A02:2021'],
    },
    {
      id: 'setTimeout-with-string',
      re: /setTimeout\s*\(\s*['"`]/,
      severity: 'high',
      message: 'setTimeout with string argument - code injection risk',
      suggestion: 'Pass function reference instead of string to setTimeout/setInterval.',
      example: `❌ setTimeout('doSomething()', 1000)\n✅ setTimeout(doSomething, 1000)`,
      reason: 'String argument is evaluated in global scope similar to eval.',
      cwe: ['CWE-94'], owasp: ['OWASP-A03:2021'],
    },
    {
      id: 'function-constructor',
      re: /new\s+Function\s*\(/,
      severity: 'critical',
      message: 'Function constructor detected - code injection risk like eval',
      suggestion: 'Avoid Function constructor. Refactor to use regular functions.',
      example: `❌ new Function('return x + y')\n✅ (x, y) => x + y`,
      reason: 'Dynamically constructed functions execute arbitrary code.',
      cwe: ['CWE-94'], owasp: ['OWASP-A03:2021'],
    },
    {
      id: 'document-write',
      re: /document\.write\(/,
      severity: 'medium',
      message: 'document.write() detected - blocks page rendering and security risk',
      suggestion: 'Use DOM manipulation methods like appendChild, innerHTML (sanitized), or modern frameworks.',
      example: `❌ document.write('<p>Text</p>')\n✅ document.body.appendChild(element)`,
      reason: 'document.write can inject untrusted HTML and block rendering.',
      cwe: ['CWE-79'], owasp: ['OWASP-A03:2021'],
    },
  ];
  
  for (const file of files) {
    const filePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
    try {
      const content = await fsp.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      
      for (const pattern of patterns) {
        lines.forEach((line, idx) => {
          if (pattern.re.test(line)) {
            findings.push({
              analyzer: 'security',
              file: path.relative(baseDir, filePath),
              line: idx + 1,
              column: 1,
              rule: pattern.id,
              severity: pattern.severity,
              message: pattern.message,
              source: 'security-analyzer',
              suggestion: pattern.suggestion,
              example: pattern.example,
              codeSnippet: line.trim().slice(0, 100),
              reason: pattern.reason,
              cwe: pattern.cwe || [],
              owasp: pattern.owasp || [],
              severityWeight: mapSeverityWeight(pattern.severity),
            });
          }
        });
      }

      // JWT misuse patterns (decode without verify)
      if (/jsonwebtoken|jwt-simple|atob\(.*\.(split\(|\[1\])/.test(content) || /jwt\.decode\(/i.test(content)) {
        const hasVerify = /jwt\.verify\(/i.test(content);
        if (!hasVerify) {
          findings.push({
            analyzer: 'security', source: 'security-analyzer', file: path.relative(baseDir, filePath), line: 1, column: 1,
            rule: 'jwt-decode-without-verify', severity: 'high',
            message: 'JWT decoded without signature verification.',
            suggestion: 'Use jwt.verify(token, secret/publicKey, { algorithms: ["RS256", "HS256"] }).',
            example: 'diff\n- const payload = jwt.decode(token)\n+ const payload = jwt.verify(token, key, { algorithms: ["RS256"] })',
            reason: 'Decoding without verifying allows forged tokens.',
            cwe: ['CWE-347'], owasp: ['OWASP-A07:2021'], severityWeight: 3,
          });
        }
      }
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  return findings;
}

async function runSemgrepSecurity(baseDir, files, timeoutMs = 30000) {
  // Let Semgrep scan any changed files; it supports many languages.
  if (!files.length) return [];
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'semgrep.exe' : 'semgrep';
    const absTargets = files.map((f) => (path.isAbsolute(f) ? f : path.join(baseDir, f)));
    
    let child;
    try {
      child = spawn(cmd, [
        '--json',
        '--config', 'p/security-audit',
        '--config', 'p/owasp-top-ten',
        '--severity', 'ERROR',
        '--severity', 'WARNING',
        ...absTargets
      ], { cwd: baseDir, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      return resolve([]);
    }
    
    let out = '';
    const t = setTimeout(() => {
      try { child.kill(); } catch {}
      resolve([]);
    }, timeoutMs);
    
    child.on('error', () => {
      clearTimeout(t);
      resolve([]);
    });
    
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('close', () => {
      clearTimeout(t);
      try {
        const json = JSON.parse(out || '{}');
        const results = json.results || [];
        const findings = results.map((r) => ({
          analyzer: 'security',
          file: path.relative(baseDir, r.path),
          line: r.start?.line || 1,
          column: r.start?.col || 1,
          rule: r.check_id || 'semgrep-security',
          severity: mapSemgrepSeverity(r.extra?.severity),
          message: r.extra?.message || 'Security issue detected',
          source: 'security-analyzer',
          suggestion: r.extra?.metadata?.fix || 'Review and fix security vulnerability.',
          codeSnippet: r.extra?.lines?.slice(0, 100),
        }));
        resolve(findings);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

function mapSemgrepSeverity(semgrepSev) {
  const sev = String(semgrepSev || '').toLowerCase();
  if (sev === 'error') return 'critical';
  if (sev === 'warning') return 'high';
  return 'medium';
}

function mapSeverityWeight(sev) {
  switch (sev) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 1;
  }
}

async function scanConfigForSecrets(baseDir, files) {
  const findings = [];
  const configFiles = files.filter((f) => /\.(ya?ml|json)$/.test(f) || path.basename(f).toLowerCase().startsWith('.env'));
  const secretKeyRe = /(password|passwd|secret|api[-_]?key|access[-_]?key|token|client[_-]?secret)\s*[:=]\s*["']?[A-Za-z0-9_\-\.]{12,}["']?/i;
  for (const f of configFiles) {
    const fp = path.isAbsolute(f) ? f : path.join(baseDir, f);
    try {
      const text = await fsp.readFile(fp, 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (secretKeyRe.test(line)) {
          findings.push({
            analyzer: 'security', source: 'security-analyzer', file: path.relative(baseDir, fp), line: idx + 1, column: 1,
            rule: 'hardcoded-config-secret', severity: 'critical',
            message: 'Possible credential in configuration file (.env/YAML/JSON).',
            suggestion: 'Move secrets to a secret manager and load via environment at runtime. Remove from VCS.',
            example: 'diff\n- API_KEY=sk_live_...\n+ # load from secret manager at runtime',
            reason: 'Credentials in config files are often leaked and hard to rotate.',
            cwe: ['CWE-798'], owasp: ['OWASP-A02:2021'], severityWeight: 4,
          });
        }
      });
    } catch {}
  }
  return findings;
}

async function scanExpressHardening(baseDir, files) {
  const findings = [];
  const jsFiles = files.filter((f) => /\.(js|jsx|ts|tsx)$/i.test(f));
  for (const f of jsFiles) {
    const fp = path.isAbsolute(f) ? f : path.join(baseDir, f);
    let text; try { text = await fsp.readFile(fp, 'utf8'); } catch { continue; }
    const isExpress = /require\(['"]express['"]\)|from\s+['"]express['"]/i.test(text);
    if (!isExpress) continue;
    // Helmet
    const hasHelmet = /helmet\s*\(/i.test(text) || /from\s+['"]helmet['"]/i.test(text) || /require\(['"]helmet['"]\)/i.test(text);
    if (!hasHelmet) {
      findings.push({
        analyzer: 'security', source: 'security-analyzer', file: path.relative(baseDir, fp), line: 1, column: 1,
        rule: 'missing-helmet', severity: 'medium',
        message: 'Express app without Helmet; missing common security headers.',
        suggestion: 'Install and use Helmet: app.use(require("helmet")());',
        example: 'diff\n+ const helmet = require("helmet");\n+ app.use(helmet());',
        reason: 'Security headers (HSTS, X-Frame-Options, etc.) mitigate common attacks.',
        cwe: ['CWE-16'], owasp: ['OWASP-A05:2021'], severityWeight: 2,
      });
    }
    // CSRF
    const hasSession = /express-session|cookie-session/i.test(text);
    const hasCsurf = /csurf/i.test(text);
    const hasPostRoutes = /\.post\(|\.put\(|\.patch\(/i.test(text);
    if ((hasSession || hasPostRoutes) && !hasCsurf) {
      findings.push({
        analyzer: 'security', source: 'security-analyzer', file: path.relative(baseDir, fp), line: 1, column: 1,
        rule: 'missing-csrf-protection', severity: 'high',
        message: 'State-changing routes without CSRF protection detected.',
        suggestion: 'Use csurf middleware or stateless double-submit CSRF tokens.',
        example: 'diff\n+ const csurf = require("csurf");\n+ app.use(csurf());',
        reason: 'CSRF enables attackers to trigger authenticated actions without user consent.',
        cwe: ['CWE-352'], owasp: ['OWASP-A01:2021'], severityWeight: 3,
      });
    }
  }
  return findings;
}

module.exports = { analyzeSecurity };
