const fsp = require('fs').promises;
const path = require('path');

/**
 * Maintainability Analyzer (language-agnostic heuristics with JS/TS/Python focus)
 * - Circular dependencies (JS/TS)
 * - Large functions/classes (JS/TS/Python)
 * - Missing tests for changed files (JS/TS/Python/Go/Java)
 */
async function analyzeMaintainability(baseDir, files) {
  const findings = [];

  const codeFiles = files.filter((f) => /\.(js|jsx|ts|tsx|py|java|go)$/i.test(f));
  if (!codeFiles.length) return findings;

  // 1) Circular dependencies (JS/TS only, heuristic on changed files)
  try {
    const jsFiles = codeFiles.filter((f) => /\.(js|jsx|ts|tsx)$/i.test(f));
    const graph = await buildImportGraph(baseDir, jsFiles);
    const cycles = findCycles(graph);
    for (const cycle of cycles) {
      const cyclePath = cycle.join(' -> ');
      const head = cycle[0];
      findings.push({
        analyzer: 'maintainability',
        source: 'maintainability-analyzer',
        file: head,
        line: 1,
        column: 1,
        rule: 'circular-dependency',
        severity: 'medium',
        message: `Circular dependency detected: ${cyclePath}`,
        suggestion: 'Break the cycle by inverting dependencies, extracting interfaces, or moving shared code to a utility module.',
        example: `diff\n- A imports B, B imports A\n+ Extract shared types/functions into module C; A->C and B->C`,
        reason: 'Circular imports complicate initialization order and increase coupling.',
        cwe: [],
        owasp: [],
        severityWeight: 2,
      });
    }
  } catch (_) {}

  // 2) Large functions/classes (JS/TS/Python heuristics)
  for (const file of codeFiles) {
    const full = path.isAbsolute(file) ? file : path.join(baseDir, file);
    let content;
    try { content = await fsp.readFile(full, 'utf8'); } catch { continue; }
    const lines = content.split(/\r?\n/);

    const ext = path.extname(file).toLowerCase();
    if (/(\.js|\.jsx|\.ts|\.tsx)$/i.test(file)) {
      // Large function: count brace-matched blocks after function/=> with block
      const largeFuncThreshold = 80;
      const largeClassThreshold = 200;
      const funcRegex = /(function\s+\w+\s*\(|\w+\s*[:=]\s*\([^)]*\)\s*=>\s*\{|\([^)]*\)\s*=>\s*\{|\w+\s*\([^)]*\)\s*\{)/;
      const classRegex = /\bclass\s+\w+\s*\{/;
      scanBracedBlocks(lines, funcRegex, largeFuncThreshold).forEach((b) => {
        findings.push({
          analyzer: 'maintainability',
          source: 'maintainability-analyzer',
          file: path.relative(baseDir, full),
          line: b.start + 1,
          column: 1,
          rule: 'large-function',
          severity: b.length >= largeFuncThreshold * 2 ? 'high' : 'medium',
          message: `Function is ${b.length} lines long (threshold ${largeFuncThreshold}).`,
          suggestion: 'Refactor into smaller, focused functions. Apply the Single Responsibility Principle.',
          example: 'diff\n- longFunction(...) { /* 200+ lines */ }\n+ extractStep1(...); extractStep2(...);',
          reason: 'Large functions hurt readability, testability, and maintainability.',
          cwe: [], owasp: [], severityWeight: b.length >= largeFuncThreshold * 2 ? 3 : 2,
        });
      });
      scanBracedBlocks(lines, classRegex, largeClassThreshold).forEach((b) => {
        findings.push({
          analyzer: 'maintainability',
          source: 'maintainability-analyzer',
          file: path.relative(baseDir, full),
          line: b.start + 1,
          column: 1,
          rule: 'large-class',
          severity: b.length >= largeClassThreshold * 2 ? 'high' : 'medium',
          message: `Class is ${b.length} lines long (threshold ${largeClassThreshold}).`,
          suggestion: 'Split class into cohesive components or services; apply composition over inheritance if suitable.',
          example: 'diff\n- class HugeClass { /* 400+ lines */ }\n+ class SmallerRoleA { }\n+ class SmallerRoleB { }',
          reason: 'Large classes indicate low cohesion and high complexity.',
          cwe: [], owasp: [], severityWeight: b.length >= largeClassThreshold * 2 ? 3 : 2,
        });
      });
    } else if (ext === '.py') {
      // Python: def ...: block ends when indentation dedents
      const largeFuncThreshold = 80;
      const defIndices = lines
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => /^\s*def\s+\w+\s*\(/.test(l));
      for (const { i } of defIndices) {
        const indent = (lines[i].match(/^(\s*)/) || [,''])[1].length;
        let j = i + 1;
        while (j < lines.length) {
          const curIndent = (lines[j].match(/^(\s*)/) || [,''])[1].length;
          if (lines[j].trim() && curIndent <= indent) break;
          j++;
        }
        const length = j - i;
        if (length >= largeFuncThreshold) {
          findings.push({
            analyzer: 'maintainability',
            source: 'maintainability-analyzer',
            file: path.relative(baseDir, full),
            line: i + 1,
            column: 1,
            rule: 'large-function',
            severity: length >= largeFuncThreshold * 2 ? 'high' : 'medium',
            message: `Function is ${length} lines long (threshold ${largeFuncThreshold}).`,
            suggestion: 'Refactor into smaller functions and add unit tests for extracted logic.',
            example: 'diff\n- def big():\n-    # 200+ lines\n+ def step1(...): ...\n+ def step2(...): ...',
            reason: 'Large functions reduce readability and increase defect rates.',
            cwe: [], owasp: [], severityWeight: length >= largeFuncThreshold * 2 ? 3 : 2,
          });
        }
      }
    }

    // 3) Missing tests for changed files (heuristic)
    const testHints = [/__tests__\//, /\btest\b/i, /\bspec\b/i];
    const isTestFile = testHints.some((re) => re.test(file));
    if (!isTestFile) {
      const bn = path.basename(file).replace(/\.(js|jsx|ts|tsx|py|java|go)$/i, '');
      const candidates = [
        path.join(path.dirname(file), `${bn}.test.js`),
        path.join(path.dirname(file), `${bn}.spec.js`),
        `__tests__/${bn}.test.js`,
        `__tests__/${bn}.spec.js`,
        `tests/${bn}.py`,
      ];
      const exists = await anyExists(baseDir, candidates);
      if (!exists) {
        findings.push({
          analyzer: 'maintainability',
          source: 'maintainability-analyzer',
          file,
          line: 1,
          column: 1,
          rule: 'missing-tests',
          severity: 'low',
          message: 'No obvious test file found for this module.',
          suggestion: 'Add unit tests to cover critical paths and edge cases.',
          example: '',
          reason: 'Test coverage improves confidence and reduces regressions.',
          cwe: [], owasp: [], severityWeight: 1,
        });
      }
    }
  }

  return findings;
}

async function anyExists(baseDir, relPaths) {
  for (const p of relPaths) {
    try { await fsp.access(path.isAbsolute(p) ? p : path.join(baseDir, p)); return true; } catch {}
  }
  return false;
}

async function buildImportGraph(baseDir, jsFiles) {
  const graph = new Map(); // file -> set(deps)
  for (const file of jsFiles) {
    const full = path.isAbsolute(file) ? file : path.join(baseDir, file);
    let content; try { content = await fsp.readFile(full, 'utf8'); } catch { continue; }
    const dir = path.dirname(full);
    const imports = new Set();
    const re = /(import\s+[^'";]+from\s*['"]([^'"]+)['"])|(require\(\s*['"]([^'"]+)['"]\s*\))/g;
    let m;
    while ((m = re.exec(content))) {
      const spec = m[2] || m[4];
      if (!spec) continue;
      if (spec.startsWith('.') || spec.startsWith('/')) {
        // Resolve relative to file
        const resolved = resolveModule(dir, spec);
        if (resolved) imports.add(path.relative(baseDir, resolved));
      }
    }
    graph.set(path.relative(baseDir, full), imports);
  }
  return graph;
}

function resolveModule(fromDir, spec) {
  const candidates = [
    path.resolve(fromDir, spec),
    path.resolve(fromDir, `${spec}.js`),
    path.resolve(fromDir, `${spec}.ts`),
    path.resolve(fromDir, `${spec}.tsx`),
    path.resolve(fromDir, `${spec}/index.js`),
    path.resolve(fromDir, `${spec}/index.ts`),
    path.resolve(fromDir, `${spec}/index.tsx`),
  ];
  for (const c of candidates) {
    if (c.endsWith('.js') || c.endsWith('.ts') || c.endsWith('.tsx')) {
      // Rely on existence
    }
    // We don't require the file to exist; keep graph within changed set
  }
  return candidates[0];
}

function findCycles(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const parent = new Map();
  for (const v of graph.keys()) color.set(v, WHITE);
  const cycles = [];

  function dfs(u) {
    color.set(u, GRAY);
    for (const v of (graph.get(u) || [])) {
      if (!graph.has(v)) continue; // only within scope
      if (color.get(v) === WHITE) { parent.set(v, u); dfs(v); }
      else if (color.get(v) === GRAY) {
        // found cycle: backtrack from u to v
        const cycle = [v];
        let x = u;
        while (x && x !== v) { cycle.push(x); x = parent.get(x); }
        cycle.reverse();
        cycles.push(cycle);
      }
    }
    color.set(u, BLACK);
  }

  for (const u of graph.keys()) {
    if (color.get(u) === WHITE) dfs(u);
  }
  // Deduplicate simple cycles by string signature
  const sig = new Set();
  return cycles.filter((c) => {
    const s = c.join('->');
    if (sig.has(s)) return false;
    sig.add(s); return true;
  });
}

function scanBracedBlocks(lines, startRegex, minLength) {
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    if (startRegex.test(lines[i])) {
      let depth = 0; let started = false; let j = i;
      while (j < lines.length) {
        const l = lines[j];
        for (const ch of l) {
          if (ch === '{') { depth++; started = true; }
          else if (ch === '}') { depth--; }
        }
        if (started && depth === 0) break;
        j++;
      }
      const length = j - i + 1;
      if (started && length >= minLength) results.push({ start: i, end: j, length });
      i = j; // jump ahead
    }
  }
  return results;
}

module.exports = { analyzeMaintainability };