const fsp = require('fs').promises;
const path = require('path');

/**
 * Code Improvement Analyzer
 * Suggests: modern JS patterns, better algorithms, readability improvements
 */
async function analyzeImprovements(baseDir, files) {
  const findings = [];
  
  const patterns = [
    {
      id: 'use-arrow-function',
      re: /function\s*\([^)]*\)\s*\{[^}]*return\s+[^;]+;?\s*\}/,
      severity: 'low',
      message: 'Consider using arrow function for simple returns',
      suggestion: 'Convert to arrow function: const name = (args) => expression',
      example: '- function add(a, b) { return a + b; }\n+ const add = (a, b) => a + b;',
    },
    {
      id: 'use-template-literals',
      re: /['"][^'"]*['"]\s*\+\s*[a-zA-Z_$]|[a-zA-Z_$]\s*\+\s*['"][^'"]*['"]/,
      severity: 'low',
      message: 'Use template literals instead of string concatenation',
      suggestion: 'Replace string concatenation with template literals for better readability',
      example: '- const msg = "Hello " + name + "!";\n+ const msg = `Hello ${name}!`;',
    },
    {
      id: 'use-destructuring',
      re: /const\s+(\w+)\s*=\s*(\w+)\.(\w+);\s*const\s+(\w+)\s*=\s*\2\.(\w+)/,
      severity: 'low',
      message: 'Consider using destructuring assignment',
      suggestion: 'Use object destructuring to extract multiple properties',
      example: '- const name = user.name; const age = user.age;\n+ const { name, age } = user;',
    },
    {
      id: 'use-optional-chaining',
      re: /&&\s*\w+\.\w+/,
      severity: 'low',
      message: 'Consider using optional chaining (?.) operator',
      suggestion: 'Replace logical AND chains with optional chaining for cleaner code',
      example: '- if (user && user.address && user.address.city)\n+ if (user?.address?.city)',
    },
    {
      id: 'use-nullish-coalescing',
      re: /\|\|\s*[^|]/,
      severity: 'low',
      message: 'Consider using nullish coalescing (??) for default values',
      suggestion: 'Use ?? instead of || to handle only null/undefined (not 0, false, "")',
      example: '- const count = userCount || 0;\n+ const count = userCount ?? 0;',
    },
    {
      id: 'use-array-methods',
      re: /for\s*\([^)]*\)\s*\{[^}]*push\(/,
      severity: 'low',
      message: 'Consider using array methods (map, filter, reduce) instead of for loops',
      suggestion: 'Replace imperative loops with declarative array methods for clarity',
      example: '- for (let i = 0; i < arr.length; i++) { result.push(arr[i] * 2); }\n+ const result = arr.map(x => x * 2);',
    },
    {
      id: 'use-object-shorthand',
      re: /\{\s*(\w+):\s*\1\s*[,}]/,
      severity: 'low',
      message: 'Use object property shorthand',
      suggestion: 'Remove redundant property assignment when key and variable name match',
      example: '- const obj = { name: name, age: age };\n+ const obj = { name, age };',
    },
    {
      id: 'async-await-instead-of-then',
      re: /\.then\s*\([^)]+\)\s*\.then/,
      severity: 'low',
      message: 'Consider using async/await instead of promise chains',
      suggestion: 'Replace .then() chains with async/await for better readability and error handling',
      example: '- fetch(url).then(r => r.json()).then(data => console.log(data));\n+ const response = await fetch(url); const data = await response.json();',
    },
    {
      id: 'use-includes-not-indexOf',
      re: /\.indexOf\([^)]+\)\s*(!==|>=|>)\s*-?[01]/,
      severity: 'low',
      message: 'Use .includes() instead of .indexOf() for existence checks',
      suggestion: 'Replace indexOf() >= 0 with includes() for clearer intent',
      example: '- if (arr.indexOf(item) >= 0)\n+ if (arr.includes(item))',
    },
    {
      id: 'use-startswith-endswith',
      re: /\.indexOf\([^)]+\)\s*===\s*0|\.slice\(-\d+\)\s*===|\.substring\([^)]+\)\s*===/,
      severity: 'low',
      message: 'Use .startsWith() or .endsWith() for string prefix/suffix checks',
      suggestion: 'Replace indexOf/slice checks with startsWith/endsWith for clarity',
      example: '- if (str.indexOf("http") === 0)\n+ if (str.startsWith("http"))',
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
              analyzer: 'improvement',
              file: path.relative(baseDir, filePath),
              line: idx + 1,
              column: 1,
              rule: pattern.id,
              severity: pattern.severity,
              message: pattern.message,
              source: 'improvement-analyzer',
              suggestion: pattern.suggestion,
              example: pattern.example,
              codeSnippet: line.trim().slice(0, 100),
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

module.exports = { analyzeImprovements };
