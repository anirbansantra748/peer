const fsp = require('fs').promises;
const path = require('path');
const { ESLint } = require('eslint');

/**
 * Deep Logic Analyzer
 * Checks: unused vars, unreachable code, complexity, dead code, error handling, logic bugs
 */
async function analyzeLogic(baseDir, files) {
  const findings = [];
  
  try {
    const configFile = path.resolve(__dirname, '..', '..', 'eslint.config.js');
    const eslint = new ESLint({
      cwd: baseDir,
      overrideConfigFile: configFile,
      errorOnUnmatchedPattern: false,
      overrideConfig: {
        rules: {
          // Unused code detection
          'no-unused-vars': ['error', { 
            vars: 'all', 
            args: 'after-used', 
            ignoreRestSiblings: true 
          }],
          'no-unused-expressions': 'error',
          
          // Unreachable/dead code
          'no-unreachable': 'error',
          'no-unreachable-loop': 'error',
          'no-constant-condition': 'error',
          
          // Logic bugs
          'eqeqeq': ['error', 'always'],
          'no-compare-neg-zero': 'error',
          'no-cond-assign': 'error',
          'no-dupe-else-if': 'error',
          'no-duplicate-case': 'error',
          'no-empty': 'error',
          'no-ex-assign': 'error',
          'no-fallthrough': 'error',
          'no-irregular-whitespace': 'error',
          'no-loss-of-precision': 'error',
          'no-self-assign': 'error',
          'no-self-compare': 'error',
          'use-isnan': 'error',
          'valid-typeof': 'error',
          
          // Error handling
          'no-async-promise-executor': 'error',
          'no-await-in-loop': 'warn',
          'no-promise-executor-return': 'error',
          'require-atomic-updates': 'error',
          
          // Complexity
          'complexity': ['warn', { max: 15 }],
          'max-depth': ['warn', { max: 4 }],
          'max-nested-callbacks': ['warn', { max: 3 }],
          
          // Best practices
          'no-var': 'error',
          'prefer-const': 'error',
          'no-implicit-globals': 'error',
          'no-return-await': 'error',
          'no-undef': 'error',
        }
      }
    });
    
    const targets = files.map((f) => (path.isAbsolute(f) ? f : path.join(baseDir, f)));
    const results = await eslint.lintFiles(targets);
    
    // Read file contents for code snippets
    const fileContents = {};
    for (const target of targets) {
      try {
        fileContents[target] = (await fsp.readFile(target, 'utf8')).split(/\r?\n/);
      } catch (e) {
        fileContents[target] = [];
      }
    }
    
    for (const res of results) {
      const lines = fileContents[res.filePath] || [];
      
      for (const m of res.messages || []) {
        const severity = determineLogicSeverity(m.ruleId, m.severity);
        const lineIdx = (m.line || 1) - 1;
        const codeSnippet = lines[lineIdx]?.trim().slice(0, 120) || '';
        const { suggestion, example } = getLogicSuggestion(m.ruleId, m.message, codeSnippet);
        
        findings.push({
          analyzer: 'logic',
          file: path.relative(baseDir, res.filePath),
          line: m.line || 1,
          column: m.column || 1,
          rule: m.ruleId || 'logic-issue',
          severity,
          message: m.message,
          source: 'logic-analyzer',
          suggestion,
          example,
          codeSnippet,
          reason: mapReason(m.ruleId, m.message),
          cwe: [],
          owasp: [],
          severityWeight: severity === 'high' ? 3 : severity === 'medium' ? 2 : 1,
        });
      }

      // Heuristic: missing await on common async calls (fetch/axios)
      const asyncCallRe = /(fetch\s*\(|axios\.(get|post|put|delete|patch)\s*\()/i;
      lines.forEach((l, idx) => {
        if (asyncCallRe.test(l) && !/^\s*await\s+/i.test(l) && !/\.then\s*\(/i.test(l)) {
          findings.push({
            analyzer: 'logic', source: 'logic-analyzer', file: path.relative(baseDir, res.filePath), line: idx + 1, column: 1,
            rule: 'missing-await-async-call', severity: 'medium',
            message: 'Likely missing await on async call; promise may be unused.',
            suggestion: 'Await the promise or handle it via .then/.catch. In loops, collect and Promise.all.',
            example: 'diff\n- const data = fetch(url)\n+ const data = await fetch(url)',
            codeSnippet: l.trim().slice(0, 120),
            reason: 'Unawaited promises can cause race conditions and unhandled rejections.',
            cwe: [], owasp: [], severityWeight: 2,
          });
        }
      });

      // Heuristic: async function passed to forEach (awaits ignored)
      lines.forEach((l, idx) => {
        if (/\.forEach\s*\(\s*async\s*\(/.test(l)) {
          findings.push({
            analyzer: 'logic', source: 'logic-analyzer', file: path.relative(baseDir, res.filePath), line: idx + 1, column: 1,
            rule: 'async-foreach-misuse', severity: 'medium',
            message: 'Async callback in forEach does not await; promises run unsequenced.',
            suggestion: 'Use for..of with await, or map to promises and await Promise.all.',
            example: 'diff\n- arr.forEach(async (x) => await doThing(x))\n+ for (const x of arr) { await doThing(x); }',
            codeSnippet: l.trim().slice(0, 120),
            reason: 'Array.forEach ignores returned promises; control flow continues.',
            cwe: [], owasp: [], severityWeight: 2,
          });
        }
      });

      // Heuristic: inconsistent return types within function (rough)
      findings.push(...detectInconsistentReturns(lines, path.relative(baseDir, res.filePath)));
    }
  } catch (e) {
    // Silent fail - other analyzers will still run
  }
  
  return findings;
}

function determineLogicSeverity(ruleId, eslintSeverity) {
  const highSeverityRules = [
    'no-unreachable', 'no-dupe-else-if', 'no-duplicate-case',
    'no-compare-neg-zero', 'no-cond-assign', 'eqeqeq',
    'use-isnan', 'valid-typeof', 'no-self-compare'
  ];
  
  const mediumSeverityRules = [
    'no-unused-vars', 'no-fallthrough', 'no-empty',
    'no-await-in-loop', 'complexity', 'max-depth'
  ];
  
  if (highSeverityRules.includes(ruleId)) return 'high';
  if (mediumSeverityRules.includes(ruleId)) return 'medium';
  return eslintSeverity === 2 ? 'medium' : 'low';
}

function getLogicSuggestion(ruleId, message, codeSnippet) {
  const suggestionMap = {
    'no-unused-vars': {
      suggestion: 'Remove unused variable or prefix with underscore (_) if intentionally unused.',
      example: `❌ const unused = 5; // never used\n✅ const _unused = 5; // or remove it`,
    },
    'no-unreachable': {
      suggestion: 'Remove unreachable code after return/throw/break/continue.',
      example: `❌ return x; console.log('never runs');\n✅ return x;`,
    },
    'no-unreachable-loop': {
      suggestion: 'Fix loop that only executes once or has unreachable iterations.',
      example: `❌ for (let i = 0; i < 10; i++) { return; }\n✅ for (let i = 0; i < 10; i++) { process(i); }`,
    },
    'eqeqeq': {
      suggestion: 'Use strict equality (=== or !==) instead of == or != to avoid type coercion bugs.',
      example: `❌ if (x == 5) // may match "5"\n✅ if (x === 5) // only matches number 5`,
    },
    'no-constant-condition': {
      suggestion: 'Remove condition that is always true/false. Check loop logic.',
      example: `❌ if (true) { code }\n✅ if (condition) { code }`,
    },
    'no-fallthrough': {
      suggestion: 'Add break statement or /* falls through */ comment in switch case.',
      example: `❌ case 'a': doA();\ncase 'b': doB();\n✅ case 'a': doA(); break;\ncase 'b': doB();`,
    },
    'no-unused-expressions': {
      suggestion: 'Remove expression that has no effect. Assign to variable or call function.',
      example: `❌ x + 5; // does nothing\n✅ result = x + 5;`,
    },
    'complexity': {
      suggestion: 'Reduce cyclomatic complexity by extracting methods or simplifying conditions.',
      example: `❌ if (a && b && c && d) { ... }\n✅ const isValid = checkConditions(a, b, c, d); if (isValid) { ... }`,
    },
    'max-depth': {
      suggestion: 'Reduce nesting depth by extracting functions or using early returns.',
      example: `❌ if (a) { if (b) { if (c) { ... } } }\n✅ if (!a) return; if (!b) return; if (c) { ... }`,
    },
    'no-await-in-loop': {
      suggestion: 'Use Promise.all() to await promises in parallel instead of sequential awaits in loop.',
      example: `❌ for (const id of ids) { await fetch(id); }\n✅ await Promise.all(ids.map(id => fetch(id)));`,
    },
    'no-var': {
      suggestion: 'Replace var with let or const (prefer const for non-reassigned variables).',
      example: `❌ var x = 5;\n✅ const x = 5; // or let if reassigned`,
    },
    'prefer-const': {
      suggestion: 'Use const instead of let for variables that are never reassigned.',
      example: `❌ let x = 5; // never reassigned\n✅ const x = 5;`,
    },
    'no-compare-neg-zero': {
      suggestion: 'Use Object.is(x, -0) to check for negative zero.',
      example: `❌ if (x === -0)\n✅ if (Object.is(x, -0))`,
    },
    'use-isnan': {
      suggestion: 'Use Number.isNaN() instead of comparing with NaN.',
      example: `❌ if (x === NaN)\n✅ if (Number.isNaN(x))`,
    },
    'no-self-compare': {
      suggestion: 'Remove comparison of variable with itself.',
      example: `❌ if (x === x)\n✅ // Remove or check for NaN: if (!Number.isNaN(x))`,
    },
    'no-empty': {
      suggestion: 'Add code to empty block or remove it.',
      example: `❌ if (condition) {}\n✅ if (condition) { handleCondition(); }`,
    },
  };
  
  const result = suggestionMap[ruleId] || {
    suggestion: `Fix logic issue: ${message}`,
    example: codeSnippet ? `Current: ${codeSnippet}` : '',
  };
  
  return result;
}

function mapReason(ruleId, message) {
  const map = {
    'no-unused-vars': 'Dead code increases noise and hides real issues.',
    'no-unreachable': 'Unreachable code is never executed and indicates logical errors.',
    'no-undef': 'Using undefined variables leads to runtime ReferenceError.',
    'no-await-in-loop': 'Sequential awaits reduce throughput and increase latency.',
  };
  return map[ruleId] || message;
}

function detectInconsistentReturns(lines, fileRel) {
  const results = [];
  // naive scan: track when inside function braces and collect categories of return expressions
  const funcStart = /\bfunction\b|=>\s*\{/;
  let i = 0;
  while (i < lines.length) {
    if (funcStart.test(lines[i])) {
      // find block end by braces
      let depth = 0; let started = false; let j = i;
      const categories = new Set();
      while (j < lines.length) {
        const l = lines[j];
        for (const ch of l) { if (ch === '{') { depth++; started = true; } else if (ch === '}') depth--; }
        const m = l.match(/\breturn\b\s*(.*)/);
        if (m) {
          const expr = m[1] || '';
          categories.add(classifyExpr(expr));
        }
        if (started && depth === 0) break;
        j++;
      }
      if (categories.size > 1) {
        results.push({
          analyzer: 'logic', source: 'logic-analyzer', file: fileRel, line: i + 1, column: 1,
          rule: 'inconsistent-return-types', severity: 'medium',
          message: `Function returns multiple value shapes: ${Array.from(categories).join(', ')}`,
          suggestion: 'Unify return types or throw consistently. Consider returning objects with consistent shape.',
          example: 'diff\n- if (err) return null;\n- return { ok: true }\n+ return { ok: !err }',
          reason: 'Inconsistent returns complicate callers and increase bugs.',
          cwe: [], owasp: [], severityWeight: 2,
        });
      }
      i = j;
    }
    i++;
  }
  return results;
}

function classifyExpr(expr) {
  const s = String(expr || '').trim();
  if (!s || /^;/.test(s)) return 'empty';
  if (/^\{/.test(s)) return 'object';
  if (/^\[/.test(s)) return 'array';
  if (/^['"`]/.test(s)) return 'string';
  if (/^(true|false)$/i.test(s)) return 'boolean';
  if (/^(null|undefined)$/i.test(s)) return 'nil';
  if (/^[0-9.]/.test(s)) return 'number';
  return 'value';
}

module.exports = { analyzeLogic };
