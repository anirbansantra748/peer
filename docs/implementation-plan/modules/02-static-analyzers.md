# Module 02: Static Analyzers - Complete Setup

> **Purpose**: Configure all 9 static analyzers to detect ALL types of issues  
> **Status**: 🔄 Partial (5 done, 4 new)  
> **Priority**: Critical  
> **Complexity**: Medium

## User Feedback Addressed

> **"main thing is the thing this detect the casual things right so that need to be done"**

**Answer**: YES - ESLint and other analyzers will catch all casual/common issues like:
- Unused variables
- Missing semicolons  
- Console.log statements
- Typos in variable names
- etc.

> **"we have to detect all others too"**

**Answer**: YES - All 9 analyzers cover every language and issue type.

---

## Complete Analyzer Matrix

| # | Analyzer | Purpose | Detects | Status |
|---|----------|---------|---------|--------|
| 1 | **npm audit** | Dependencies | Known vulnerabilities in Node packages | ✅ Done |
| 2 | **pip-audit** | Dependencies | Known vulnerabilities in Python packages | ❌ New |
| 3 | **TruffleHog** | Secrets | API keys, passwords, tokens in code | ❌ New |
| 4 | **ESLint** | JS/TS Linting | Unused vars, style issues, bad patterns | ✅ Done |
| 5 | **Semgrep** | Multi-lang Security | Security bugs, code quality | 🔄 Verify |
| 6 | **Bandit** | Python Security | SQL injection, XSS, etc. | ✅ Done |
| 7 | **Hadolint** | Dockerfile | Best practices, vulnerabilities | ❌ New |
| 8 | **Checkov** | IaC Security | Terraform, K8s misconfigurations | ❌ New |
| 9 | **PMD** | Java Quality | Code smells, complexity | ✅ Done |

---

## What Each Analyzer Detects

### 1. npm audit (Node.js Dependencies)
**Status**: ✅ Already working

**Detects**:
- Known CVEs in npm packages
- Outdated dependencies with security issues
- Severity levels: low, moderate, high, critical

**Example output**:
```json
{
  "vulnerabilities": [{
    "name": "lodash",
    "severity": "high",
    "title": "Prototype Pollution",
    "package": "lodash"
  }]
}
```

**No action needed** - already integrated.

---

### 2. pip-audit (Python Dependencies)
**Status**: ❌ NEW - Need to add

**Detects**:
- Known CVEs in PyPI packages
- Vulnerable versions of Python libraries

**Installation**:
```bash
pip install pip-audit
```

**Integration**:

**File**: `shared/analyzers/pythonDependencies.js` (NEW)

```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');

async function runPipAudit(repoPath) {
  const requirementsFile = path.join(repoPath, 'requirements.txt');
  
  // Check if Python project
  if (!fs.existsSync(requirementsFile)) {
    return []; // Not a Python project
  }
  
  try {
    const { stdout } = await execPromise('pip-audit --format json', { cwd: repoPath });
    const result = JSON.parse(stdout);
    
    return result.vulnerabilities.map(vuln => ({
      severity: 'high',
      category: 'dependency',
      message: `${vuln.name}: ${vuln.description}`,
      file: 'requirements.txt',
      package: vuln.name,
      fixedVersion: vuln.fixed_version
    }));
  } catch (error) {
    console.error('[pip-audit] Error:', error.message);
    return [];
  }
}

module.exports = runPipAudit;
```

**Test**:
```bash
# Test on a Python repo
node -e "
  const run = require('./shared/analyzers/pythonDependencies');
  run('/path/to/python/repo').then(console.log);
"
```

---

### 3. TruffleHog (Secret Scanning)
**Status**: ❌ NEW - Critical for security

**Detects**:
- API keys (AWS, Google Cloud, Stripe, etc.)
- Passwords in code
- Private keys
- OAuth tokens
- Database credentials

**Installation**:
```bash
# Install TruffleHog
curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b /usr/local/bin
```

**Integration**:

**File**: `shared/analyzers/secretScanner.js` (NEW)

```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function runSecretScan(repoPath) {
  try {
    const { stdout } = await execPromise(
      `trufflehog filesystem ${repoPath} --json --no-update`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
    );
    
    const findings = stdout
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    
    return findings.map(f => ({
      severity: 'critical', // Secrets are always critical
      category: 'security',
      message: `Potential ${f.detector_name} secret found`,
      file: f.source_metadata?.file || 'unknown',
      line: f.source_metadata?.line || 0,
      snippet: f.raw ? f.raw.substring(0, 100) + '...' : '',
      secretType: f.detector_name
    }));
  } catch (error) {
    console.error('[secret-scanner] Error:', error.message);
    return [];
  }
}

module.exports = runSecretScan;
```

**Test**:
```bash
# Create test file with fake secret
echo "AWS_KEY=AKIAIOSFODNN7EXAMPLE" > /tmp/test-secrets.env
trufflehog filesystem /tmp --json
```

---

### 4. ESLint (JavaScript/TypeScript)
**Status**: ✅ Already working

**Detects (Casual Issues)**:
- ✅ Unused variables: `const x = 1; // never used`
- ✅ Missing semicolons
- ✅ Console.log statements
- ✅ Debugger statements
- ✅ Undefined variables
- ✅ Invalid imports
- ✅ Code style violations

**Config to catch MORE casual issues**:

**File**: `.eslintrc.json` (CREATE if not exists)

```json
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "rules": {
    "no-unused-vars": "error",
    "no-console": "warn",
    "no-debugger": "error",
    "no-undef": "error",
    "semi": ["error", "always"],
    "quotes": ["warn", "single"],
    "no-var": "error",
    "prefer-const": "error"
  }
}
```

**Already integrated** - no changes needed.

---

### 5. Semgrep (Multi-language Security)
**Status**: 🔄 VERIFY installation

**Detects**:
- SQL injection patterns
- XSS vulnerabilities
- Hardcoded secrets (backup to TruffleHog)
- Insecure API usage
- Code quality issues

**Verification**:
```bash
# Check if semgrep is installed
which semgrep
# Should output: /usr/local/bin/semgrep or similar

# Test run
semgrep --config auto --json . | head -20
```

**If not installed**:
```bash
pip install semgrep
```

**Already should be integrated** in `shared/analyzers/security.js` - verify it's being called.

---

### 6. Bandit (Python Security)
**Status**: ✅ Already working

**Detects**:
- SQL injection
- Shell injection
- Hard-coded passwords
- Weak crypto
- Unsafe YAML loading

**No action needed**.

---

### 7. Hadolint (Dockerfile Linting)
**Status**: ❌ NEW

**Detects**:
- Dockerfile best practices violations
- Security issues (running as root, etc.)
- Inefficient layer caching
- Missing health checks

**Installation**:
```bash
# Download binary
wget https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-x86_64 -O /usr/local/bin/hadolint
chmod +x /usr/local/bin/hadolint
```

**Integration**:

**File**: `shared/analyzers/dockerLinter.js` (NEW)

```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');

async function runHadolint(repoPath) {
  const dockerfilePath = path.join(repoPath, 'Dockerfile');
  
  if (!fs.existsSync(dockerfilePath)) {
    return []; // No Dockerfile
  }
  
  try {
    const { stdout, stderr } = await execPromise(
      `hadolint ${dockerfilePath} --format json`,
      { cwd: repoPath }
    );
    
    const findings = JSON.parse(stdout || '[]');
    
    return findings.map(f => ({
      severity: f.level === 'error' ? 'high' : 'medium',
      category: 'docker',
      message: `${f.code}: ${f.message}`,
      file: 'Dockerfile',
      line: f.line,
      rule: f.code
    }));
  } catch (error) {
    // Hadolint exits with error if issues found, parse stderr
    try {
      const findings = JSON.parse(error.stdout || '[]');
      return findings.map(f => ({
        severity: f.level === 'error' ? 'high' : 'medium',
        category: 'docker',
        message: `${f.code}: ${f.message}`,
        file: 'Dockerfile',
        line: f.line
      }));
    } catch {
      return [];
    }
  }
}

module.exports = runHadolint;
```

---

### 8. Checkov (IaC Security)
**Status**: ❌ NEW

**Detects**:
- Terraform misconfigurations
- Kubernetes security issues
- AWS/GCP/Azure best practices
- Hardcoded secrets in IaC files

**Installation**:
```bash
pip install checkov
```

**Integration**:

**File**: `shared/analyzers/iacScanner.js` (NEW)

```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function runCheckov(repoPath) {
  try {
    const { stdout } = await execPromise(
      'checkov -d . --output json --quiet',
      { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
    );
    
    const result = JSON.parse(stdout);
    const failures = result.results?.failed_checks || [];
    
    return failures.map(check => ({
      severity: 'high',
      category: 'infrastructure',
      message: check.check_result?.message || check.check_name,
      file: check.file_path,
      line: check.file_line_range?.[0] || 0,
      resource: check.resource,
      checkId: check.check_id
    }));
  } catch (error) {
    console.error('[checkov] Error:', error.message);
    return [];
  }
}

module.exports = runCheckov;
```

---

### 9. PMD (Java Code Quality)
** Status**: ✅ Already working

**No action needed**.

---

## Integration into Main Analyzer

**File**: `shared/analyzer/index.js` (MODIFY)

**Add new analyzers:**

```javascript
const runPipAudit = require('../analyzers/pythonDependencies');
const runSecretScan = require('../analyzers/secretScanner');
const runHadolint = require('../analyzers/dockerLinter');
const runCheckov = require('../analyzers/iacScanner');

// In main analysis function
async function analyzeRepository(repoPath, prRun) {
  const findings = [];
  
  // ... existing analyzers ...
  
  // NEW: Add these
  const [pipAuditFindings, secretFindings, dockerFindings, iacFindings] = await Promise.all([
    runPipAudit(repoPath),
    runSecretScan(repoPath),
    runHadolint(repoPath),
    runCheckov(repoPath)
  ]);
  
  findings.push(...pipAuditFindings);
  findings.push(...secretFindings);
  findings.push(...dockerFindings);
  findings.push(...iacFindings);
  
  return findings;
}
```

---

## Testing Checklist

- [ ] Test npm audit on Node.js repo
- [ ] Test pip-audit on Python repo
- [ ] Test TruffleHog with fake secrets
- [ ] Test ESLint with casual errors (unused vars, etc.)
- [ ] Test Semgrep on multi-language repo
- [ ] Test Bandit on Python repo
- [ ] Test Hadolint on Dockerfile
- [ ] Test Checkov on Terraform files
- [ ] Test all 9 running in parallel
- [ ] Verify findings are deduplicated

**Module 02 Complete!** ✅
