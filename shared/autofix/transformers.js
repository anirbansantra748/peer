const fsp = require('fs').promises;
const path = require('path');

// Simple rule-based transformers. Each returns { insertedLine } or null if not applicable.
function transformMissingAwait(line) {
  if (/^(\s*)(?:(?!await).)*(fetch\s*\(|axios\.(get|post|put|delete|patch)\s*\()/i.test(line) && !/\.then\s*\(/i.test(line)) {
    const m = line.match(/^(\s*)/);
    const indent = m ? m[1] : '';
    const trimmed = line.trim();
    if (/^await\b/.test(trimmed)) return null;
    return { insertedLine: `${indent}await ${trimmed}` };
  }
  return null;
}

function transformHttpToHttps(line) {
  if (/(^|[^\w])http:\/\//.test(line)) {
    return { insertedLine: line.replace(/http:\/\//g, 'https://') };
  }
  return null;
}

function transformInnerHTML(line) {
  if (/\.innerHTML\s*=/.test(line)) {
    return { insertedLine: line.replace(/\.innerHTML\s*=/, '.textContent =') };
  }
  return null;
}

function transformSyncFs(line) {
  if (/fs\.(readFileSync|writeFileSync|readdirSync|statSync)\s*\(/.test(line)) {
    // Heuristic replacement: convert readFileSync(x) -> await fs.promises.readFile(x)
    const replaced = line
      .replace('fs.readFileSync', 'await fs.promises.readFile')
      .replace('fs.writeFileSync', 'await fs.promises.writeFile')
      .replace('fs.readdirSync', 'await fs.promises.readdir')
      .replace('fs.statSync', 'await fs.promises.stat');
    return { insertedLine: replaced, requiresAsync: true, reason: 'Fixed blocking I/O by using async fs.promises API and marking handler async.' };
  }
  return null;
}

function ensureAsyncAroundLine(file, lines, idx){
  // Only for JS/TS
  const ext = path.extname(file).toLowerCase();
  if (!/\.(js|jsx|ts|tsx)$/.test(ext)) return { lines, changed: false };
  const start = Math.max(0, idx - 8);
  const end = Math.max(0, idx);
  for (let i = end; i >= start; i--){
    const l = lines[i];
    // Arrow handler: (req, res) => { ... }
    if (/=>\s*\{/.test(l)){
      if (/async\s+\([^)]*\)\s*=>\s*\{/.test(l)) return { lines, changed: false };
      const newL = l.replace(/^(\s*)(\([^)]*\)\s*=>\s*\{)/, '$1async $2');
      if (newL !== l){
        const out = [...lines];
        out[i] = newL;
        return { lines: out, changed: true };
      }
    }
    // Function declaration: function(req,res){ ... }
    if (/function\s*\([^)]*\)\s*\{/.test(l)){
      if (/async\s+function\s*\(/.test(l)) return { lines, changed: false };
      const newL = l.replace(/^(\s*)function\s*\(/, '$1async function(');
      if (newL !== l){
        const out = [...lines];
        out[i] = newL;
        return { lines: out, changed: true };
      }
    }
    // router.<method>(..., (req,res) => { ... }) on same line
    if (/router\.[a-zA-Z]+\(.*\(([^)]*)\)\s*=>\s*\{/.test(l)){
      if (/router\.[a-zA-Z]+\(.*async\s*\(([^)]*)\)\s*=>\s*\{/.test(l)) return { lines, changed: false };
      const newL = l.replace(/(router\.[a-zA-Z]+\([^,]+,\s*)(\()/, '$1async $2');
      if (newL !== l){
        const out = [...lines];
        out[i] = newL;
        return { lines: out, changed: true };
      }
    }
  }
  return { lines, changed: false };
}

const transformers = [
  { rule: 'missing-await-async-call', apply: transformMissingAwait, check: (l) => /^\s*await\b/.test(l.trim()) },
  { rule: 'http-not-https', apply: transformHttpToHttps, check: (l) => !/http:\/\//.test(l) && /https:\/\//.test(l) },
  { rule: 'dangerous-innerHTML', apply: transformInnerHTML, check: (l) => /\.textContent\s*=/.test(l) },
  { rule: 'sync-io', apply: transformSyncFs, check: (l) => /fs\.promises\./.test(l) },
];

function getCommentSyntax(file) {
  const ext = path.extname(file).toLowerCase();
  if (['.js', '.jsx', '.ts', '.tsx', '.java', '.go', '.c', '.cpp', '.h'].includes(ext)) return { line: '// ' };
  if (['.py', '.yml', '.yaml', '.json', '.env'].includes(ext)) return { line: '# ' };
  if (['.html', '.htm', '.xml'].includes(ext)) return { blockStart: '<!-- ', blockEnd: ' -->' };
  if (['.css', '.scss', '.less'].includes(ext)) return { blockStart: '/* ', blockEnd: ' */' };
  return { line: '// ' };
}

function commentOut(original, file) {
  const syntax = getCommentSyntax(file);
  const lines = original.split(/\r?\n/);
  if (syntax.line) return lines.map(l => `${syntax.line}${l}`).join('\n');
  // block
  return `${syntax.blockStart}${original}\n${syntax.blockEnd}`;
}

module.exports = { transformers, getCommentSyntax, commentOut, ensureAsyncAroundLine };
