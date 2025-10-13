const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const simpleGit = require('simple-git');
const logger = require('../utils/prettyLogger');

// Import language detection
const { analyzeFile, isAnalyzable } = require('./languageDetector');

// Import all analyzers
const { analyzeStyle } = require('./style');
const { analyzeLogic } = require('./logic');
const { analyzeSecurity } = require('./security');
const { analyzeImprovements } = require('./improvement');
const { analyzeHTML } = require('./html');
const { analyzeCSS } = require('./css');
const { analyzeUniversal } = require('./universal');

// Import new multi-language analyzers
const { analyzeJava } = require('./java');
const { analyzePython } = require('./python');
const { analyzeTypeScript } = require('./typescript');
const { analyzeSQL } = require('./sql');
const { analyzeDocker } = require('./docker');
const { analyzeExternal } = require('./external');
const { analyzeComplexity } = require('./complexity');
const { analyzeAI } = require('./ai');
const { analyzePerformance } = require('./performance');
const { analyzeMaintainability } = require('./maintainability');
const { analyzeLicense } = require('./license');

function safeRepoUrl(repo) {
  const token = process.env.GITHUB_TOKEN;
  if (token) return `https://x-access-token:${token}@github.com/${repo}.git`;
  return `https://github.com/${repo}.git`;
}

async function getChangedFiles(baseDir, baseSha, headSha) {
  const git = simpleGit({ baseDir });
  try {
    if (baseSha) {
      const out = await git.diff(['--name-only', `${baseSha}..${headSha}`]);
      return out.split(/\r?\n/).filter(Boolean);
    }
    const out = await git.diff(['--name-only', `${headSha}~1..${headSha}`]);
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Main analyzer function - runs all 4 analyzers sequentially
 * Returns findings grouped by analyzer type
 */
async function analyzeRepoDeep({ repo, sha, baseSha }) {
  let tempDir;
  const cleanup = async () => {
    if (tempDir) {
      try { await fsp.rm(tempDir, { recursive: true, force: true }); } catch {}
    }
  };
  
  try {
    // 1. Clone repo
    tempDir = path.join(os.tmpdir(), `peer-analyze-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fsp.mkdir(tempDir, { recursive: true });
    
    const cloneUrl = safeRepoUrl(repo);
    logger.info('analyzer', 'Cloning repository', { repo, tempDir });
    const git = simpleGit();
    await git.clone(cloneUrl, tempDir);
    const git2 = simpleGit({ baseDir: tempDir });
    await git2.checkout(sha);
    
    // 2. Get changed files
    const changed = await getChangedFiles(tempDir, baseSha, sha);
    logger.info('analyzer', 'Changed files detected', { count: changed.length, files: changed.slice(0, 20) });
    
    // Filter analyzable files using language detector
    const analyzableFiles = changed.filter(f => isAnalyzable(f));
    
    if (analyzableFiles.length === 0) {
      logger.info('analyzer', 'No analyzable files changed');
      return { tempDir, findings: [], changed, analyzerResults: {} };
    }
    
    // Categorize files by language
    const filesByLanguage = {};
    for (const file of analyzableFiles) {
      const analysis = analyzeFile(file);
      const lang = analysis.language;
      if (!filesByLanguage[lang]) {
        filesByLanguage[lang] = [];
      }
      filesByLanguage[lang].push(file);
    }
    
    logger.info('analyzer', 'Running analyzers', { 
      filesByLanguage,
      totalAnalyzableFiles: analyzableFiles.length 
    });
    
    // 3. Run all analyzers in parallel
    const analyzerPromises = [
      // Original analyzers (for backward compatibility with JS/TS)
      analyzeStyle(tempDir, filesByLanguage['JavaScript'] || []).catch((e) => {
        logger.warn('analyzer', 'Style analyzer failed', { error: String(e) });
        return [];
      }),
      analyzeLogic(tempDir, filesByLanguage['JavaScript'] || []).catch((e) => {
        logger.warn('analyzer', 'Logic analyzer failed', { error: String(e) });
        return [];
      }),
      analyzeSecurity(tempDir, changed).catch((e) => {
        logger.warn('analyzer', 'Security analyzer failed', { error: String(e) });
        return [];
      }),
      analyzeImprovements(tempDir, analyzableFiles).catch((e) => {
        logger.warn('analyzer', 'Improvement analyzer failed', { error: String(e) });
        return [];
      }),
      analyzeHTML(tempDir, changed).catch((e) => {
        logger.warn('analyzer', 'HTML analyzer failed', { error: String(e) });
        return [];
      }),
      analyzeCSS(tempDir, changed).catch((e) => {
        logger.warn('analyzer', 'CSS analyzer failed', { error: String(e) });
        return [];
      }),
      analyzeUniversal(tempDir, changed).catch((e) => {
        logger.warn('analyzer', 'Universal analyzer failed', { error: String(e) });
        return [];
      }),
      
      // New multi-language analyzers
      analyzeJava(tempDir, changed).catch((e) => {
        logger.warn('analyzer', 'Java analyzer failed', { error: String(e) });
        return [];
      }),
      analyzePython(tempDir, changed).catch((e) => {
        logger.warn('analyzer', 'Python analyzer failed', { error: String(e) });
        return [];
      }),
      analyzeTypeScript(tempDir, changed).catch((e) => {
        logger.warn('analyzer', 'TypeScript analyzer failed', { error: String(e) });
        return [];
      }),
      analyzeSQL(tempDir, changed).catch((e) => {
        logger.warn('analyzer', 'SQL analyzer failed', { error: String(e) });
        return [];
      }),
      analyzeDocker(tempDir, changed).catch((e) => {
        logger.warn('analyzer', 'Docker analyzer failed', { error: String(e) });
        return [];
      }),
      // External CLI analyzers (conditional)
      (async () => {
        try {
          const { findings, breakdown } = await analyzeExternal(tempDir, changed);
          logger.info('analyzer', 'External analyzers results', breakdown);
          return findings;
        } catch (e) {
          logger.warn('analyzer', 'External analyzers failed', { error: String(e) });
          return [];
        }
      })(),
      // Maintainability analyzer
      (async () => {
        try { return await analyzeMaintainability(tempDir, changed); } catch (e) {
          logger.warn('analyzer', 'Maintainability analyzer failed', { error: String(e) });
          return [];
        }
      })(),
      // License & dependency freshness
      (async () => {
        try { return await analyzeLicense(tempDir, changed); } catch (e) {
          logger.warn('analyzer', 'License analyzer failed', { error: String(e) });
          return [];
        }
      })(),
      // Complexity analyzer (language-agnostic, opt-in)
      (async () => {
        if (process.env.PEER_ENABLE_COMPLEXITY === '1') {
          try { return await analyzeComplexity(tempDir, changed); } catch (e) {
            logger.warn('analyzer', 'Complexity analyzer failed', { error: String(e) });
            return [];
          }
        }
        return [];
      })(),
      // AI deep analyzer (only runs if OPENAI_API_KEY is set)
      analyzeAI(tempDir, changed).catch((e) => {
        logger.warn('analyzer', 'AI analyzer failed', { error: String(e) });
        return [];
      }),
      // Performance analyzer
      analyzePerformance(tempDir, changed).catch((e) => {
        logger.warn('analyzer', 'Performance analyzer failed', { error: String(e) });
        return [];
      }),
    ];
    
    const [styleFindings, logicFindings, securityFindings, improvementFindings, htmlFindings, cssFindings, universalFindings, javaFindings, pythonFindings, typescriptFindings, sqlFindings, dockerFindings, externalFindings, complexityFindings, aiFindings, performanceFindings, maintainabilityFindings, licenseFindings] = await Promise.all(analyzerPromises);
    
    // Combine all findings
    const allFindings = [
      ...styleFindings,
      ...logicFindings,
      ...securityFindings,
      ...improvementFindings,
      ...htmlFindings,
      ...cssFindings,
      ...universalFindings,
      ...javaFindings,
      ...pythonFindings,
      ...typescriptFindings,
      ...sqlFindings,
      ...dockerFindings,
      ...externalFindings,
      ...complexityFindings,
      ...aiFindings,
      ...performanceFindings,
      ...maintainabilityFindings,
      ...licenseFindings,
    ];
    
    logger.info('analyzer', 'Analysis complete', {
      style: styleFindings.length,
      logic: logicFindings.length,
      security: securityFindings.length,
      improvement: improvementFindings.length,
      html: htmlFindings.length,
      css: cssFindings.length,
      universal: universalFindings.length,
      java: javaFindings.length,
      python: pythonFindings.length,
      typescript: typescriptFindings.length,
      sql: sqlFindings.length,
      docker: dockerFindings.length,
      external: externalFindings.length,
      complexity: complexityFindings.length,
      ai: aiFindings.length,
      performance: performanceFindings.length,
      maintainability: maintainabilityFindings.length,
      license: licenseFindings.length,
      total: allFindings.length,
      languageBreakdown: filesByLanguage,
    });
    
    return {
      tempDir,
      findings: allFindings,
      changed,
      analyzerResults: {
        style: styleFindings,
        logic: logicFindings,
        security: securityFindings,
        improvement: improvementFindings,
        html: htmlFindings,
        css: cssFindings,
        universal: universalFindings,
        java: javaFindings,
        python: pythonFindings,
        typescript: typescriptFindings,
        sql: sqlFindings,
        docker: dockerFindings,
        maintainability: maintainabilityFindings,
        license: licenseFindings,
      },
    };
  } catch (e) {
    await cleanup();
    throw e;
  }
}

module.exports = {
  analyzeRepoDeep,
  safeRepoUrl,
  getChangedFiles,
};
