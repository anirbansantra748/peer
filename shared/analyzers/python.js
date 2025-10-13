const fsp = require('fs').promises;
const path = require('path');

/**
 * Python Analyzer
 * Detects: syntax errors, PEP 8 violations, Django/Flask issues, logic errors
 */

const PYTHON_PATTERNS = [
  // Invalid non-Python syntax (Java/C-style declarations inside .py)
  {
    id: 'invalid-python-syntax-declaration',
    re: /^\s*(int|float|double|char|boolean|byte|short|long)\s+\w+\s*=/,
    severity: 'high',
    message: 'Invalid Python syntax - Java/C-style variable declaration',
    suggestion: 'Remove the type keyword. Use plain assignment in Python.',
    example: `❌ int a = 5\n✅ a = 5`,
    category: 'syntax',
  },
  // Syntax & Simple Errors
  {
    id: 'indentation-error',
    re: /^\s*\t+ +|^\s* +\t+/,
    severity: 'critical',
    message: 'Mixed tabs and spaces - IndentationError',
    suggestion: 'Use either spaces (4 recommended) or tabs consistently.',
    example: `❌ Mixed indentation\n✅ Use 4 spaces for indentation`,
    category: 'syntax',
  },
  {
    id: 'missing-colon',
    re: /^(def|class|if|elif|else|for|while|try|except|finally|with)\s+[^:]*$/,
    severity: 'critical',
    message: 'Missing colon at end of statement',
    suggestion: 'Add colon after def, class, if, for, etc.',
    example: `❌ def func()\n✅ def func():`,
    category: 'syntax',
  },
  {
    id: 'undefined-variable',
    re: /NameError|UnboundLocalError/,
    severity: 'high',
    message: 'Potential undefined variable reference',
    suggestion: 'Ensure variable is defined before use.',
    example: `❌ print(x) # x not defined\n✅ x = 5; print(x)`,
    category: 'logic',
  },
  
  // Logic Errors
  {
    id: 'division-by-zero',
    re: /\/\s*0\b/,
    severity: 'critical',
    message: 'Division by zero - ZeroDivisionError',
    suggestion: 'Add zero check before division.',
    example: `❌ result = x / 0\n✅ if y != 0: result = x / y`,
    category: 'logic',
  },
  {
    id: 'bare-except',
    re: /except\s*:\s*$/,
    severity: 'high',
    message: 'Bare except clause - catches all exceptions including SystemExit',
    suggestion: 'Catch specific exceptions or use Exception.',
    example: `❌ except:\n✅ except (ValueError, TypeError):`,
    category: 'exception',
  },
  {
    id: 'empty-except',
    re: /except[^:]*:\s*pass\s*$/,
    severity: 'medium',
    message: 'Empty except block - errors silently ignored',
    suggestion: 'At minimum, log the exception.',
    example: `❌ except: pass\n✅ except Exception as e: logger.error(e)`,
    category: 'exception',
  },
  {
    id: 'mutable-default-argument',
    re: /def\s+\w+\([^)]*=\s*(\[\]|\{\})/,
    severity: 'high',
    message: 'Mutable default argument - shared between calls',
    suggestion: 'Use None as default and create list/dict in function.',
    example: `❌ def func(data=[]):\n✅ def func(data=None): data = data or []`,
    category: 'logic',
  },
  {
    id: 'comparison-to-none',
    re: /\w+\s*==\s*None|None\s*==\s*\w+/,
    severity: 'medium',
    message: 'Using == to compare with None',
    suggestion: 'Use "is None" or "is not None" for None comparisons.',
    example: `❌ if x == None:\n✅ if x is None:`,
    category: 'style',
  },
  {
    id: 'comparison-to-boolean',
    re: /\w+\s*==\s*(True|False)/,
    severity: 'medium',
    message: 'Comparing to True/False explicitly',
    suggestion: 'Use boolean value directly in condition.',
    example: `❌ if flag == True:\n✅ if flag:`,
    category: 'style',
  },
  
  // Security
  {
    id: 'sql-injection',
    re: /(execute|cursor\.execute).*[%f].*format|execute.*\+/,
    severity: 'critical',
    message: 'SQL injection risk - string formatting in query',
    suggestion: 'Use parameterized queries.',
    example: `❌ cursor.execute(f\"SELECT * FROM users WHERE id = {id}\")\n✅ cursor.execute(\"SELECT * FROM users WHERE id = %s\", (id,))`,
    category: 'security',
  },
  {
    id: 'eval-usage',
    re: /\beval\s*\(/,
    severity: 'critical',
    message: 'Using eval() - code injection risk',
    suggestion: 'Avoid eval(). Use ast.literal_eval() for safe evaluation.',
    example: `❌ eval(user_input)\n✅ ast.literal_eval(user_input)`,
    category: 'security',
  },
  {
    id: 'exec-usage',
    re: /\bexec\s*\(/,
    severity: 'critical',
    message: 'Using exec() - code execution risk',
    suggestion: 'Avoid exec() with user input.',
    example: `❌ exec(user_code)\n✅ Use safer alternatives`,
    category: 'security',
  },
  {
    id: 'pickle-load',
    re: /pickle\.loads?\s*\(/,
    severity: 'high',
    message: 'pickle.load() with untrusted data - code execution risk',
    suggestion: 'Use JSON for untrusted data serialization.',
    example: `❌ pickle.load(user_file)\n✅ json.load(user_file)`,
    category: 'security',
  },
  {
    id: 'shell-injection',
    re: /subprocess\.(call|run|Popen).*shell\s*=\s*True/,
    severity: 'critical',
    message: 'Shell injection risk - shell=True with user input',
    suggestion: 'Use shell=False and pass command as list.',
    example: `❌ subprocess.run(cmd, shell=True)\n✅ subprocess.run([\"cmd\", arg], shell=False)`,
    category: 'security',
  },
  {
    id: 'assert-usage',
    re: /^\s*assert\s+/,
    severity: 'medium',
    message: 'Using assert for validation - can be disabled with -O',
    suggestion: 'Use proper exceptions for validation.',
    example: `❌ assert user is not None\n✅ if user is None: raise ValueError()`,
    category: 'logic',
  },
  
  // Style & Best Practices (PEP 8)
  {
    id: 'line-too-long',
    re: /^.{80,}$/,
    severity: 'low',
    message: 'Line exceeds 79 characters (PEP 8)',
    suggestion: 'Break long lines for readability.',
    example: `❌ very_long_line...\n✅ Split into multiple lines`,
    category: 'style',
  },
  {
    id: 'trailing-whitespace',
    re: /\s+$/,
    severity: 'low',
    message: 'Trailing whitespace',
    suggestion: 'Remove trailing whitespace.',
    example: `✅ No trailing spaces`,
    category: 'style',
  },
  {
    id: 'print-statement',
    re: /^\s*print\s+[^(]/,
    severity: 'medium',
    message: 'Print statement (Python 2 syntax)',
    suggestion: 'Use print() function (Python 3).',
    example: `❌ print \"hello\"\n✅ print(\"hello\")`,
    category: 'syntax',
  },
  {
    id: 'multiple-statements',
    re: /;\s*\w+/,
    severity: 'low',
    message: 'Multiple statements on one line',
    suggestion: 'Use separate lines for each statement (PEP 8).',
    example: `❌ x = 5; y = 10\n✅ x = 5\\ny = 10`,
    category: 'style',
  },
  {
    id: 'import-star',
    re: /from\s+\w+\s+import\s+\*/,
    severity: 'medium',
    message: 'Using wildcard import (from x import *)',
    suggestion: 'Import specific names or module.',
    example: `❌ from os import *\n✅ from os import path, environ`,
    category: 'style',
  },
  {
    id: 'todo-comment',
    re: /#\s*TODO|#\s*FIXME|#\s*XXX/i,
    severity: 'low',
    message: 'TODO comment found',
    suggestion: 'Track TODOs in issue tracker.',
    example: `❌ # TODO: fix later\n✅ Track in issues`,
    category: 'style',
  },
  
  // Django Specific
  {
    id: 'django-raw-sql',
    re: /\.raw\(.*[%f].*format/,
    severity: 'critical',
    message: 'Django raw SQL with string formatting - SQL injection risk',
    suggestion: 'Use parameterized queries with %s placeholders.',
    example: `❌ Model.objects.raw(f\"SELECT * WHERE id = {id}\")\n✅ Model.objects.raw(\"SELECT * WHERE id = %s\", [id])`,
    category: 'security',
  },
  {
    id: 'django-safestring',
    re: /mark_safe\(/,
    severity: 'high',
    message: 'Using mark_safe() - XSS risk if not properly escaped',
    suggestion: 'Ensure content is properly escaped before mark_safe.',
    example: `⚠️ mark_safe(user_input) # Dangerous\n✅ Use template escaping`,
    category: 'security',
  },
  
  // Flask Specific
  {
    id: 'flask-debug-mode',
    re: /app\.run\(.*debug\s*=\s*True/,
    severity: 'high',
    message: 'Flask debug mode enabled - security risk in production',
    suggestion: 'Never enable debug mode in production.',
    example: `❌ app.run(debug=True)\n✅ app.run() # debug=False in prod`,
    category: 'security',
  },
  {
    id: 'flask-render-template-string',
    re: /render_template_string\(/,
    severity: 'high',
    message: 'Using render_template_string with user input - SSTI risk',
    suggestion: 'Use render_template with separate template files.',
    example: `❌ render_template_string(user_input)\n✅ render_template('template.html', data=data)`,
    category: 'security',
  },
];

async function analyzePython(baseDir, files) {
  const findings = [];
  
  const pythonFiles = files.filter(f => /\.py$/i.test(f));
  
  if (pythonFiles.length === 0) {
    return [];
  }
  
  for (const file of pythonFiles) {
    const filePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
    
    try {
      const content = await fsp.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      
      for (const pattern of PYTHON_PATTERNS) {
        lines.forEach((line, idx) => {
          // Skip comments for most patterns
          const trimmed = line.trim();
          if (trimmed.startsWith('#')) {
            if (pattern.id !== 'todo-comment') {
              return;
            }
          }
          
          if (pattern.re.test(line)) {
            findings.push({
              analyzer: 'python',
              file: path.relative(baseDir, filePath),
              line: idx + 1,
              column: 1,
              rule: pattern.id,
              severity: pattern.severity,
              message: pattern.message,
              source: 'python-analyzer',
              suggestion: pattern.suggestion,
              example: pattern.example,
              codeSnippet: line.trim().slice(0, 120),
              category: pattern.category,
              language: 'Python',
            });
          }
        });
      }
      
      // Check for unbalanced parentheses/brackets
      const openParen = (content.match(/\(/g) || []).length;
      const closeParen = (content.match(/\)/g) || []).length;
      const openBracket = (content.match(/\[/g) || []).length;
      const closeBracket = (content.match(/\]/g) || []).length;
      
      if (openParen !== closeParen) {
        findings.push({
          analyzer: 'python',
          file: path.relative(baseDir, filePath),
          line: 1,
          severity: 'critical',
          message: `Unbalanced parentheses: ${openParen} opening, ${closeParen} closing`,
          suggestion: 'Balance all parentheses.',
          category: 'syntax',
          language: 'Python',
        });
      }
      
      if (openBracket !== closeBracket) {
        findings.push({
          analyzer: 'python',
          file: path.relative(baseDir, filePath),
          line: 1,
          severity: 'critical',
          message: `Unbalanced brackets: ${openBracket} opening, ${closeBracket} closing`,
          suggestion: 'Balance all brackets.',
          category: 'syntax',
          language: 'Python',
        });
      }
      
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  return findings;
}

module.exports = { analyzePython };
