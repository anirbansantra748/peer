const fsp = require('fs').promises;
const path = require('path');
const { detectLanguage } = require('./languageDetector');

/**
 * Complexity Analyzer
 * Language-agnostic complexity analysis using pattern matching
 * Measures: cyclomatic complexity, nesting depth, function length
 */

const COMPLEXITY_KEYWORDS = {
  // Keywords that add to cyclomatic complexity (branching/decision points)
  branching: [
    // JavaScript/TypeScript
    'if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||', '?',
    // Python
    'elif', 'except', 'and', 'or',
    // Java/C#/C++
    'foreach', 'try',
    // Go
    'select',
    // Ruby
    'elsif', 'rescue', 'unless', 'until',
    // Rust
    'match',
    // Others
    'when', 'unless'
  ],
  
  // Function/method declaration patterns
  functions: [
    /\bfunction\s+\w+\s*\(/,           // JavaScript
    /\bdef\s+\w+\s*\(/,               // Python, Ruby
    /\b(?:public|private|protected|static)?\s*\w+\s+\w+\s*\([^)]*\)\s*\{/, // Java/C#
    /\bfn\s+\w+\s*\(/,                // Rust
    /\bfunc\s+\w+\s*\(/,              // Go
    /=>\s*\{/,                        // Arrow functions
    /\w+\s*=\s*\([^)]*\)\s*=>/,       // Arrow function assignments
  ]
};

function countBranchingPoints(content) {
  let count = 0;
  const lines = content.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }
    
    // Count branching keywords
    for (const keyword of COMPLEXITY_KEYWORDS.branching) {
      if (keyword.length <= 2) {
        // Special handling for operators like &&, ||, ?
        const regex = new RegExp(`\\${keyword}`, 'g');
        const matches = (trimmed.match(regex) || []).length;
        count += matches;
      } else {
        // Regular keywords
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = (trimmed.match(regex) || []).length;
        count += matches;
      }
    }
  }
  
  return count;
}

function analyzeFunctionComplexity(content, language) {
  const functions = [];
  const lines = content.split(/\r?\n/);
  let currentFunction = null;
  let braceDepth = 0;
  let maxNesting = 0;
  let currentNesting = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }
    
    // Detect function start
    let isFunctionLine = false;
    for (const pattern of COMPLEXITY_KEYWORDS.functions) {
      if (pattern.test(line)) {
        isFunctionLine = true;
        
        // Extract function name
        let functionName = 'anonymous';
        if (language === 'JavaScript' || language === 'TypeScript') {
          const match = line.match(/function\s+(\w+)|(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/);
          if (match) functionName = match[1] || match[2];
        } else if (language === 'Python') {
          const match = line.match(/def\s+(\w+)/);
          if (match) functionName = match[1];
        } else if (language === 'Java') {
          const match = line.match(/\b(\w+)\s*\([^)]*\)\s*\{/);
          if (match && !['if', 'while', 'for', 'switch'].includes(match[1])) functionName = match[1];
        }
        
        currentFunction = {
          name: functionName,
          startLine: i + 1,
          endLine: i + 1,
          complexity: 1, // Base complexity is 1
          maxNesting: 0,
          length: 0
        };
        braceDepth = 0;
        maxNesting = 0;
        currentNesting = 0;
        break;
      }
    }
    
    if (currentFunction) {
      currentFunction.length++;
      
      // Count braces for function boundary detection
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      
      // Track nesting level
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      currentNesting += openBraces - closeBraces;
      maxNesting = Math.max(maxNesting, currentNesting);
      
      // Count complexity within function
      for (const keyword of COMPLEXITY_KEYWORDS.branching) {
        if (keyword.length <= 2) {
          const regex = new RegExp(`\\${keyword}`, 'g');
          const matches = (trimmed.match(regex) || []).length;
          currentFunction.complexity += matches;
        } else {
          const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
          const matches = (trimmed.match(regex) || []).length;
          currentFunction.complexity += matches;
        }
      }
      
      currentFunction.maxNesting = maxNesting;
      
      // Function ended
      if (braceDepth <= 0 && (line.includes('}') || (language === 'Python' && !line.startsWith(' ') && !line.startsWith('\t') && trimmed && !isFunctionLine))) {
        currentFunction.endLine = i + 1;
        functions.push(currentFunction);
        currentFunction = null;
      }
    }
  }
  
  // Handle case where function doesn't end with brace (e.g., Python at EOF)
  if (currentFunction) {
    currentFunction.endLine = lines.length;
    functions.push(currentFunction);
  }
  
  return functions;
}

async function analyzeComplexity(baseDir, files) {
  const findings = [];
  
  // Filter to code files only
  const codeFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.rb', '.go', '.php', '.cs', '.cpp', '.c', '.rs', '.swift', '.kt'].includes(ext);
  });
  
  if (codeFiles.length === 0) {
    return [];
  }
  
  for (const file of codeFiles) {
    const filePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
    const language = detectLanguage(file);
    
    try {
      const content = await fsp.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      const totalBranching = countBranchingPoints(content);
      const functions = analyzeFunctionComplexity(content, language);
      
      // File-level complexity
      if (totalBranching > 50) {
        findings.push({
          analyzer: 'complexity',
          file: path.relative(baseDir, filePath),
          line: 1,
          column: 1,
          rule: 'high-file-complexity',
          severity: 'medium',
          message: `High file complexity: ${totalBranching} branching points`,
          source: 'complexity-analyzer',
          suggestion: 'Consider breaking this file into smaller modules or classes.',
          example: 'Split complex logic into smaller, focused functions.',
          codeSnippet: '',
          category: 'complexity',
          language,
        });
      } else if (totalBranching > 25) {
        findings.push({
          analyzer: 'complexity',
          file: path.relative(baseDir, filePath),
          line: 1,
          column: 1,
          rule: 'medium-file-complexity',
          severity: 'low',
          message: `Moderate file complexity: ${totalBranching} branching points`,
          source: 'complexity-analyzer',
          suggestion: 'Monitor complexity growth. Consider refactoring if it increases further.',
          example: 'Keep functions small and focused.',
          codeSnippet: '',
          category: 'complexity',
          language,
        });
      }
      
      // Function-level complexity
      for (const func of functions) {
        if (func.complexity > 15) {
          findings.push({
            analyzer: 'complexity',
            file: path.relative(baseDir, filePath),
            line: func.startLine,
            column: 1,
            rule: 'high-cyclomatic-complexity',
            severity: 'high',
            message: `Function '${func.name}' has high cyclomatic complexity: ${func.complexity}`,
            source: 'complexity-analyzer',
            suggestion: 'Refactor function by extracting methods, reducing nested conditions, or using polymorphism.',
            example: 'Break down complex conditional logic into smaller methods.',
            codeSnippet: lines[func.startLine - 1]?.trim().slice(0, 120) || '',
            category: 'complexity',
            language,
          });
        } else if (func.complexity > 10) {
          findings.push({
            analyzer: 'complexity',
            file: path.relative(baseDir, filePath),
            line: func.startLine,
            column: 1,
            rule: 'medium-cyclomatic-complexity',
            severity: 'medium',
            message: `Function '${func.name}' has moderate cyclomatic complexity: ${func.complexity}`,
            source: 'complexity-analyzer',
            suggestion: 'Consider simplifying this function to improve maintainability.',
            example: 'Reduce nested if statements and extract helper methods.',
            codeSnippet: lines[func.startLine - 1]?.trim().slice(0, 120) || '',
            category: 'complexity',
            language,
          });
        }
        
        // Deep nesting
        if (func.maxNesting > 5) {
          findings.push({
            analyzer: 'complexity',
            file: path.relative(baseDir, filePath),
            line: func.startLine,
            column: 1,
            rule: 'deep-nesting',
            severity: 'medium',
            message: `Function '${func.name}' has deep nesting: ${func.maxNesting} levels`,
            source: 'complexity-analyzer',
            suggestion: 'Reduce nesting by using early returns, guard clauses, or extracting methods.',
            example: 'Use early returns: if (!condition) return; instead of deep nesting.',
            codeSnippet: lines[func.startLine - 1]?.trim().slice(0, 120) || '',
            category: 'complexity',
            language,
          });
        }
        
        // Long functions
        if (func.length > 100) {
          findings.push({
            analyzer: 'complexity',
            file: path.relative(baseDir, filePath),
            line: func.startLine,
            column: 1,
            rule: 'long-function',
            severity: 'medium',
            message: `Function '${func.name}' is very long: ${func.length} lines`,
            source: 'complexity-analyzer',
            suggestion: 'Break large functions into smaller, focused methods.',
            example: 'Extract logical blocks into separate methods with descriptive names.',
            codeSnippet: lines[func.startLine - 1]?.trim().slice(0, 120) || '',
            category: 'complexity',
            language,
          });
        } else if (func.length > 50) {
          findings.push({
            analyzer: 'complexity',
            file: path.relative(baseDir, filePath),
            line: func.startLine,
            column: 1,
            rule: 'long-function',
            severity: 'low',
            message: `Function '${func.name}' is long: ${func.length} lines`,
            source: 'complexity-analyzer',
            suggestion: 'Consider breaking this function into smaller pieces.',
            example: 'Extract reusable logic into helper methods.',
            codeSnippet: lines[func.startLine - 1]?.trim().slice(0, 120) || '',
            category: 'complexity',
            language,
          });
        }
      }
      
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  return findings;
}

module.exports = { analyzeComplexity };