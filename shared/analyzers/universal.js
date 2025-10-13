const fsp = require('fs').promises;
const path = require('path');

/**
 * Universal Analyzer
 * Works across ALL programming languages using pattern matching
 * Detects: security issues, logic errors, code smells that are language-agnostic
 */

// Language detection based on file extension
const LANGUAGE_MAP = {
  '.js': 'JavaScript',
  '.jsx': 'React',
  '.ts': 'TypeScript',
  '.tsx': 'React TypeScript',
  '.py': 'Python',
  '.java': 'Java',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.php': 'PHP',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C',
  '.rs': 'Rust',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.scala': 'Scala',
  '.sh': 'Shell',
  '.sql': 'SQL',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
};

/**
 * Universal Security Patterns - Work across ALL languages
 */
const UNIVERSAL_SECURITY_PATTERNS = [
  // Hardcoded Secrets (Universal)
  {
    id: 'hardcoded-password',
    re: /(password|passwd|pwd)\s*[:=]\s*["'][^"']{6,}["']/i,
    severity: 'critical',
    message: 'Hardcoded password detected',
    suggestion: 'Never hardcode passwords. Use environment variables or secret management.',
    example: `❌ password = "mySecretPass123"
✅ password = os.getenv("DB_PASSWORD")`,
    languages: 'all',
  },
  {
    id: 'hardcoded-api-key',
    re: /(?:api[-_]?key|apikey|access[-_]?key)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/i,
    severity: 'critical',
    message: 'Hardcoded API key detected',
    suggestion: 'Store API keys in environment variables or secret vault.',
    example: `❌ API_KEY = "sk_live_abc123xyz789"
✅ API_KEY = process.env.API_KEY`,
    languages: 'all',
  },
  {
    id: 'hardcoded-token',
    re: /(?:token|auth[-_]?token|bearer)\s*[:=]\s*["'][A-Za-z0-9_\-\.]{30,}["']/i,
    severity: 'critical',
    message: 'Hardcoded authentication token detected',
    suggestion: 'Never commit tokens. Use secure storage or environment variables.',
    example: `❌ token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
✅ token = ENV['AUTH_TOKEN']`,
    languages: 'all',
  },
  {
    id: 'private-key-in-code',
    re: /-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----/,
    severity: 'critical',
    message: 'Private key found in code!',
    suggestion: 'NEVER commit private keys. Store them securely outside the codebase.',
    example: `❌ private_key = "-----BEGIN PRIVATE KEY-----..."
✅ # Store in secure key management system`,
    languages: 'all',
  },

  // SQL Injection (Universal)
  {
    id: 'sql-concatenation',
    re: /(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE).*(?:\+|%|\|\||concat)/i,
    severity: 'critical',
    message: 'Possible SQL injection - string concatenation in query',
    suggestion: 'Use parameterized queries or prepared statements.',
    example: `❌ query = "SELECT * FROM users WHERE id = " + user_id
✅ cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))`,
    languages: 'all',
  },
  {
    id: 'sql-format-injection',
    re: /(?:execute|query|run)\s*\([^)]*(?:%s|%d|\{|\$\{)[^)]*(?:SELECT|INSERT|UPDATE|DELETE)/i,
    severity: 'critical',
    message: 'SQL query using string formatting - injection risk',
    suggestion: 'Use parameterized queries instead of string formatting.',
    example: `❌ db.query(f"SELECT * FROM users WHERE name = '{name}'")
✅ db.query("SELECT * FROM users WHERE name = %s", [name])`,
    languages: 'all',
  },

  // Command Injection (Universal)
  {
    id: 'command-injection',
    re: /(?:exec|system|shell|popen|subprocess|Runtime\.getRuntime|ProcessBuilder|cmd|`)[^;]*(?:\+|\$\{|%s|format)/i,
    severity: 'critical',
    message: 'Command injection risk - executing shell with user input',
    suggestion: 'Avoid shell execution. If necessary, sanitize all inputs and use safe APIs.',
    example: `❌ os.system("rm -rf " + user_path)
✅ subprocess.run(["rm", "-rf", safe_path], check=True)`,
    languages: 'all',
  },

  // XSS (Universal for web)
  {
    id: 'xss-user-input',
    re: /(?:innerHTML|outerHTML|document\.write|dangerouslySetInnerHTML|v-html|@Html\.Raw).*(?:\+|\$\{|%s)/i,
    severity: 'high',
    message: 'XSS risk - inserting user content into HTML',
    suggestion: 'Sanitize user input or use safe methods like textContent.',
    example: `❌ element.innerHTML = userInput
✅ element.textContent = userInput`,
    languages: 'all',
  },

  // Path Traversal (Universal)
  {
    id: 'path-traversal',
    re: /(?:open|read|readFile|File|Path|FileReader).*(?:\.\.\/|\.\.\\)/,
    severity: 'high',
    message: 'Path traversal pattern detected',
    suggestion: 'Validate and sanitize file paths. Use path.join or equivalent.',
    example: `❌ open(user_input + "/file.txt")
✅ safe_path = os.path.join(BASE_DIR, sanitize(user_input))`,
    languages: 'all',
  },

  // Weak Crypto (Universal)
  {
    id: 'weak-hash',
    re: /\b(md5|sha1|MD5|SHA1)\s*\(/,
    severity: 'medium',
    message: 'Weak hashing algorithm (MD5/SHA1)',
    suggestion: 'Use SHA-256 or stronger. For passwords, use bcrypt, scrypt, or argon2.',
    example: `❌ hashlib.md5(password.encode())
✅ hashlib.sha256(password.encode())  # or use bcrypt for passwords`,
    languages: 'all',
  },

  // Insecure Random (Universal)
  {
    id: 'insecure-random',
    re: /\b(?:Math\.random|random\.random|rand\(\)|srand|mt_rand)\s*\(/,
    severity: 'medium',
    message: 'Using insecure random number generator',
    suggestion: 'For security purposes, use cryptographically secure random generators.',
    example: `❌ token = str(random.random())
✅ token = secrets.token_hex(32)`,
    languages: 'all',
  },
];

/**
 * Universal Logic Patterns - Work across ALL languages
 */
const UNIVERSAL_LOGIC_PATTERNS = [
  // Empty Catch/Exception Blocks
  {
    id: 'empty-catch',
    re: /(?:catch|except|rescue)\s*(?:\([^)]*\))?\s*\{\s*\}|:\s*pass\s*$/,
    severity: 'medium',
    message: 'Empty exception handler - errors silently ignored',
    suggestion: 'Handle exceptions properly. At minimum, log the error.',
    example: `❌ try: risky() except: pass
✅ try: risky() except Exception as e: logger.error(f"Error: {e}")`,
    languages: 'all',
  },

  // TODO/FIXME/HACK comments
  {
    id: 'todo-comment',
    re: /(?:TODO|FIXME|HACK|XXX|BUG):/i,
    severity: 'low',
    message: 'TODO/FIXME comment found',
    suggestion: 'Track TODOs in issue tracker. Address before production.',
    example: `❌ // TODO: Fix this later
✅ # Create ticket and track properly`,
    languages: 'all',
  },

  // Magic Numbers
  {
    id: 'magic-number',
    re: /(?:=|return|if|while|for).*\b\d{3,}\b/,
    severity: 'low',
    message: 'Magic number detected - unclear meaning',
    suggestion: 'Use named constants for better readability.',
    example: `❌ if (age > 65)
✅ RETIREMENT_AGE = 65; if (age > RETIREMENT_AGE)`,
    languages: 'all',
  },

  // Dead Code - Commented Out Code
  {
    id: 'commented-code',
    re: /\/\/\s*(?:function|def|class|if|for|while|var|let|const|return|import)/,
    severity: 'low',
    message: 'Commented-out code detected',
    suggestion: 'Remove commented code. Use version control to track history.',
    example: `❌ // function oldFunction() { ... }
✅ # Remove - git history preserves it`,
    languages: 'all',
  },

  // Null/Undefined checks
  {
    id: 'missing-null-check',
    re: /\.\w+\(.*\)\.(?!catch|then|finally)/,
    severity: 'medium',
    message: 'Potential null pointer - chained call without null check',
    suggestion: 'Add null checks or use optional chaining (?.).',
    example: `❌ user.getAddress().getCity()
✅ user?.getAddress()?.getCity()`,
    languages: 'all',
  },

  // Invalid JavaScript syntax
  {
    id: 'invalid-js-types',
    re: /\b(int|float|double|char|boolean|byte|short|long)\s+\w+\s*=/,
    severity: 'high',
    message: 'Invalid JavaScript syntax - using Java/C-style type declarations',
    suggestion: 'JavaScript doesn\'t use type keywords. Use const, let, or var.',
    example: `❌ int a = 1;\r\n✅ const a = 1;`,
    languages: ['JavaScript', 'React', 'TypeScript', 'React TypeScript'],
  },
];

/**
 * Universal Style Patterns - Work across ALL languages
 */
const UNIVERSAL_STYLE_PATTERNS = [
  // Long Lines
  {
    id: 'line-too-long',
    re: /^.{121,}$/,
    severity: 'low',
    message: 'Line exceeds 120 characters',
    suggestion: 'Break long lines for better readability (recommended: 80-120 chars).',
    example: `❌ very_long_line_that_goes_on_and_on...
✅ Split into multiple lines`,
    languages: 'all',
  },

  // Trailing Whitespace
  {
    id: 'trailing-whitespace',
    re: /\s+$/,
    severity: 'low',
    message: 'Trailing whitespace detected',
    suggestion: 'Remove trailing whitespace. Configure editor to trim on save.',
    example: `❌ code here
✅ code here`,
    languages: 'all',
  },

  // Multiple blank lines
  {
    id: 'multiple-blank-lines',
    re: /^\s*$\n\s*$\n\s*$/m,
    severity: 'low',
    message: 'Multiple consecutive blank lines',
    suggestion: 'Use single blank line for separation.',
    example: `❌ code


code
✅ code

code`,
    languages: 'all',
  },

  // Mixed tabs and spaces
  {
    id: 'mixed-indentation',
    re: /^\t+ +|^ +\t+/m,
    severity: 'low',
    message: 'Mixed tabs and spaces for indentation',
    suggestion: 'Use consistent indentation (spaces or tabs, not both).',
    example: `❌ \t    code (mixed)
✅     code (spaces only)`,
    languages: 'all',
  },
];

async function analyzeUniversal(baseDir, files) {
  const findings = [];

  // Analyze ALL file types (not just code)
  const codeFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    // Include all programming language files
    return ext.match(/\.(js|jsx|ts|tsx|py|java|rb|go|php|cs|cpp|c|rs|swift|kt|scala|sh|sql|vue|svelte)$/i);
  });

  if (codeFiles.length === 0) {
    return [];
  }

  for (const file of codeFiles) {
    const filePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
    const ext = path.extname(file).toLowerCase();
    const language = LANGUAGE_MAP[ext] || 'Unknown';

    try {
      const content = await fsp.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);

      // Check each line against all universal patterns
      const allPatterns = [
        ...UNIVERSAL_SECURITY_PATTERNS,
        ...UNIVERSAL_LOGIC_PATTERNS,
        ...UNIVERSAL_STYLE_PATTERNS,
      ];

      for (const pattern of allPatterns) {
        lines.forEach((line, idx) => {
          // Respect language scoping, if provided
          const allowed = !pattern.languages || pattern.languages === 'all' || (Array.isArray(pattern.languages) && pattern.languages.includes(language));
          if (!allowed) return;
          if (pattern.re.test(line)) {
            findings.push({
              analyzer: 'universal',
              file: path.relative(baseDir, filePath),
              line: idx + 1,
              column: 1,
              rule: pattern.id,
              severity: pattern.severity,
              message: `${pattern.message} [${language}]`,
              source: 'universal-analyzer',
              suggestion: pattern.suggestion,
              example: pattern.example,
              codeSnippet: line.trim().slice(0, 120),
              language,
            });
          }
        });
      }
    } catch (e) {
      // Skip files that can't be read
    }
  }

  return findings;
}

module.exports = {
  analyzeUniversal,
  LANGUAGE_MAP,
};
