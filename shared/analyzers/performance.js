const fsp = require('fs').promises;
const path = require('path');

/**
 * Performance & Scalability Analyzer
 * Heuristics for nested loops, sync I/O, unbatched DB calls, missing pagination.
 */
async function analyzePerformance(baseDir, files) {
  const findings = [];

  const codeFiles = files.filter((f) => /\.(js|jsx|ts|tsx|py|java|go|rb|php)$/i.test(f));
  for (const file of codeFiles) {
    const filePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
    try {
      const content = await fsp.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);

      // 1) Nested loops (naive n^2 heuristic): two for/while within 6 lines
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/\b(for|while)\b/.test(l)) {
          for (let j = i + 1; j <= Math.min(i + 6, lines.length - 1); j++) {
            if (/\b(for|while)\b/.test(lines[j])) {
              findings.push({
                analyzer: 'performance',
                file: path.relative(baseDir, filePath),
                line: i + 1,
                column: 1,
                rule: 'nested-loops',
                severity: 'medium',
                message: 'Nested loops detected; may be O(n^2). Consider batching or optimizing.',
                source: 'performance-analyzer',
                suggestion: 'Refactor nested loops with maps/sets, batching, or algorithmic improvements.',
                example: '✅ Use hash-based lookups or pre-index data to avoid O(n^2).',
                codeSnippet: (l.trim() + ' // ... ' + lines[j].trim()).slice(0, 160),
                reason: 'Quadratic time complexity harms scalability on large datasets.',
                cwe: [], owasp: [], severityWeight: 2,
              });
              break;
            }
          }
        }
      }

      // 2) Sync file I/O in JS/TS (Node)
      if (/\.(js|jsx|ts|tsx)$/i.test(file)) {
        lines.forEach((l, idx) => {
          if (/fs\.(readFileSync|writeFileSync|readdirSync|statSync)\s*\(/.test(l)) {
            findings.push({
              analyzer: 'performance',
              file: path.relative(baseDir, filePath),
              line: idx + 1,
              column: 1,
              rule: 'sync-io',
              severity: 'medium',
              message: 'Synchronous file I/O blocks the event loop; use async APIs.',
              source: 'performance-analyzer',
              suggestion: 'Use fs.promises.* or async callbacks instead of *Sync.',
              example: '✅ await fs.promises.readFile(path)',
              codeSnippet: l.trim().slice(0, 120),
              reason: 'Blocking operations reduce concurrency and throughput.',
              cwe: [], owasp: [], severityWeight: 2,
            });
          }
        });
      }

      // 3) Unbatched DB/API calls in loops (simple heuristic)
      const dbCallRegex = /(query|execute|axios\.(get|post)|fetch|requests\.(get|post))/i;
      for (let i = 0; i < lines.length; i++) {
        if (/\b(for|while|forEach|map)\b/.test(lines[i])) {
          // await inside loop (JS/TS)
          for (let k = i + 1; k <= Math.min(i + 8, lines.length - 1); k++) {
            if (/\bawait\b/.test(lines[k])) {
              findings.push({
                analyzer: 'performance', file: path.relative(baseDir, filePath), line: k + 1, column: 1,
                rule: 'await-in-loop', severity: 'medium',
                message: 'await detected inside loop; consider batching or Promise.all.',
                source: 'performance-analyzer',
                suggestion: 'Collect promises and await Promise.all for concurrency.',
                example: '✅ await Promise.all(items.map(process))',
                codeSnippet: lines[k].trim().slice(0, 160),
                reason: 'Sequential awaits elongate loop duration and reduce throughput.',
                cwe: [], owasp: [], severityWeight: 2,
              });
              break;
            }
          }
          for (let j = i + 1; j <= Math.min(i + 8, lines.length - 1); j++) {
            if (dbCallRegex.test(lines[j])) {
              findings.push({
                analyzer: 'performance',
                file: path.relative(baseDir, filePath),
                line: j + 1,
                column: 1,
                rule: 'unbatched-io-in-loop',
                severity: 'high',
                message: 'Potential unbatched DB/API calls inside a loop.',
                source: 'performance-analyzer',
                suggestion: 'Batch requests or parallelize (Promise.all) and paginate results.',
                example: '✅ Collect params and perform a single bulk query or use Promise.all([...])',
                codeSnippet: lines[j].trim().slice(0, 160),
                reason: 'Repeated network/DB calls per iteration cause N+1 performance issues.',
                cwe: [], owasp: [], severityWeight: 3,
              });
              break;
            }
          }
        }
      }

      // 4) Missing pagination hints in API fetching (heuristic)
      const urlNoLimit = /(fetch|axios\.(get|post)|requests\.(get|post))\s*\(\s*['"][^'"]+['"]/i;
      lines.forEach((l, idx) => {
        if (urlNoLimit.test(l) && !/limit=|page=|per_page=|offset=/.test(l)) {
          findings.push({
            analyzer: 'performance',
            file: path.relative(baseDir, filePath),
            line: idx + 1,
            column: 1,
            rule: 'missing-pagination',
            severity: 'low',
            message: 'API call without explicit pagination parameters; may fetch large datasets.',
            source: 'performance-analyzer',
            suggestion: 'Add limit/page/per_page to API calls and paginate on server.',
            example: '✅ fetch(`/api/items?limit=50&page=1`)',
            codeSnippet: l.trim().slice(0, 140),
            reason: 'Unbounded responses degrade performance and memory usage.',
            cwe: [], owasp: [], severityWeight: 1,
          });
        }
      });

    } catch (e) {
      // Skip file
    }
  }

  return findings;
}

module.exports = { analyzePerformance };