const fsp = require('fs').promises;
const path = require('path');

const SQL_PATTERNS = [
  // Security
  {
    id: 'select-star',
    re: /SELECT\s+\*\s+FROM/i,
    severity: 'medium',
    message: 'Using SELECT * - inefficient and fragile',
    suggestion: 'Specify column names explicitly.',
    example: `❌ SELECT * FROM users\n✅ SELECT id, name, email FROM users`,
    category: 'performance',
  },
  {
    id: 'no-where-clause',
    re: /DELETE\s+FROM.*(?!WHERE)/i,
    severity: 'critical',
    message: 'DELETE without WHERE clause - will delete all rows',
    suggestion: 'Add WHERE clause to limit deletions.',
    example: `❌ DELETE FROM users\n✅ DELETE FROM users WHERE id = 1`,
    category: 'logic',
  },
  {
    id: 'update-no-where',
    re: /UPDATE\s+\w+\s+SET.*(?!WHERE)/i,
    severity: 'critical',
    message: 'UPDATE without WHERE clause - will update all rows',
    suggestion: 'Add WHERE clause to limit updates.',
    example: `❌ UPDATE users SET status = 'active'\n✅ UPDATE users SET status = 'active' WHERE id = 1`,
    category: 'logic',
  },
  {
    id: 'drop-table',
    re: /DROP\s+(TABLE|DATABASE)/i,
    severity: 'critical',
    message: 'DROP TABLE/DATABASE command',
    suggestion: 'Ensure this is intentional and add IF EXISTS clause.',
    example: `❌ DROP TABLE users\n✅ DROP TABLE IF EXISTS temp_users`,
    category: 'dangerous',
  },
  {
    id: 'truncate-table',
    re: /TRUNCATE\s+TABLE/i,
    severity: 'high',
    message: 'TRUNCATE TABLE - permanently deletes all data',
    suggestion: 'Verify this is intentional.',
    example: `⚠️ TRUNCATE TABLE logs -- Cannot be rolled back`,
    category: 'dangerous',
  },
  {
    id: 'no-index-on-foreign-key',
    re: /FOREIGN\s+KEY.*(?!INDEX|KEY)/i,
    severity: 'medium',
    message: 'Foreign key without index - performance impact',
    suggestion: 'Add index on foreign key column.',
    example: `✅ CREATE INDEX idx_user_id ON posts(user_id)`,
    category: 'performance',
  },
  {
    id: 'varchar-without-limit',
    re: /VARCHAR\s*\(\s*MAX\s*\)|TEXT/i,
    severity: 'low',
    message: 'Using VARCHAR(MAX) or TEXT - consider specific length',
    suggestion: 'Define appropriate length limit.',
    example: `❌ VARCHAR(MAX)\n✅ VARCHAR(255)`,
    category: 'performance',
  },
];

async function analyzeSQL(baseDir, files) {
  const findings = [];
  
  const sqlFiles = files.filter(f => /\.(sql|plsql|psql)$/i.test(f));
  
  if (sqlFiles.length === 0) {
    return [];
  }
  
  for (const file of sqlFiles) {
    const filePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
    
    try {
      const content = await fsp.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      
      for (const pattern of SQL_PATTERNS) {
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('--') || trimmed.startsWith('/*')) {
            return;
          }
          
          if (pattern.re.test(line)) {
            findings.push({
              analyzer: 'sql',
              file: path.relative(baseDir, filePath),
              line: idx + 1,
              column: 1,
              rule: pattern.id,
              severity: pattern.severity,
              message: pattern.message,
              source: 'sql-analyzer',
              suggestion: pattern.suggestion,
              example: pattern.example,
              codeSnippet: line.trim().slice(0, 120),
              category: pattern.category,
              language: 'SQL',
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

module.exports = { analyzeSQL };
