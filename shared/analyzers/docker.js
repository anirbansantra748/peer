const fsp = require('fs').promises;
const path = require('path');

const DOCKER_PATTERNS = [
  // Security
  {
    id: 'latest-tag',
    re: /FROM\s+[\w\/:.-]+:latest/i,
    severity: 'high',
    message: 'Using :latest tag - not reproducible',
    suggestion: 'Pin to specific version tag.',
    example: `❌ FROM node:latest\n✅ FROM node:18.17.0-alpine`,
    category: 'security',
  },
  {
    id: 'run-as-root',
    re: /^(?!.*USER).*RUN/im,
    severity: 'medium',
    message: 'Running as root user - security risk',
    suggestion: 'Add USER directive to run as non-root.',
    example: `❌ (no USER directive)\n✅ USER node`,
    category: 'security',
  },
  {
    id: 'exposed-secrets',
    re: /ENV\s+.*(?:PASSWORD|SECRET|KEY|TOKEN).*=/i,
    severity: 'critical',
    message: 'Hardcoded secret in ENV - security risk',
    suggestion: 'Use build args or mount secrets at runtime.',
    example: `❌ ENV PASSWORD=secret\n✅ Use Docker secrets or env at runtime`,
    category: 'security',
  },
  {
    id: 'add-instead-of-copy',
    re: /^ADD\s+(?!http)/im,
    severity: 'medium',
    message: 'Using ADD instead of COPY',
    suggestion: 'Use COPY unless you need ADD features (tar extraction, URL).',
    example: `❌ ADD app.js /app/\n✅ COPY app.js /app/`,
    category: 'best-practice',
  },
  {
    id: 'apt-get-without-cleanup',
    re: /apt-get\s+install.*(?!&&\s*rm\s+-rf\s+\/var\/lib\/apt)/i,
    severity: 'medium',
    message: 'apt-get install without cleanup - larger image',
    suggestion: 'Clean up apt cache in same layer.',
    example: `✅ RUN apt-get update && apt-get install -y pkg && rm -rf /var/lib/apt/lists/*`,
    category: 'optimization',
  },
  {
    id: 'multiple-run-commands',
    re: /^RUN[\s\S]*^RUN/im,
    severity: 'low',
    message: 'Multiple RUN commands - creates extra layers',
    suggestion: 'Combine RUN commands with && for smaller images.',
    example: `❌ RUN cmd1\nRUN cmd2\n✅ RUN cmd1 && cmd2`,
    category: 'optimization',
  },
  {
    id: 'missing-healthcheck',
    re: /^(?![\s\S]*HEALTHCHECK)/im,
    severity: 'low',
    message: 'Missing HEALTHCHECK instruction',
    suggestion: 'Add HEALTHCHECK for container monitoring.',
    example: `✅ HEALTHCHECK CMD curl -f http://localhost/ || exit 1`,
    category: 'best-practice',
  },
];

async function analyzeDocker(baseDir, files) {
  const findings = [];
  
  const dockerFiles = files.filter(f => {
    const basename = path.basename(f);
    return /^Dockerfile/i.test(basename) || /\.dockerfile$/i.test(f) || basename === 'docker-compose.yml' || basename === 'docker-compose.yaml';
  });
  
  if (dockerFiles.length === 0) {
    return [];
  }
  
  for (const file of dockerFiles) {
    const filePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
    
    try {
      const content = await fsp.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      
      for (const pattern of DOCKER_PATTERNS) {
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('#')) {
            return;
          }
          
          if (pattern.re.test(line)) {
            findings.push({
              analyzer: 'docker',
              file: path.relative(baseDir, filePath),
              line: idx + 1,
              column: 1,
              rule: pattern.id,
              severity: pattern.severity,
              message: pattern.message,
              source: 'docker-analyzer',
              suggestion: pattern.suggestion,
              example: pattern.example,
              codeSnippet: line.trim().slice(0, 120),
              category: pattern.category,
              language: 'Docker',
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

module.exports = { analyzeDocker };
