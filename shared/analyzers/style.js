const fsp = require('fs').promises;
const path = require('path');
const { ESLint } = require('eslint');

/**
 * Style & Design Analyzer
 * Checks: formatting, semicolons, quotes, naming conventions, indentation
 */
async function analyzeStyle(baseDir, files) {
  const findings = [];
  
  try {
    const configFile = path.resolve(__dirname, '..', '..', 'eslint.config.js');
    const eslint = new ESLint({
      cwd: baseDir,
      overrideConfigFile: configFile,
      errorOnUnmatchedPattern: false,
      overrideConfig: {
        rules: {
          // Style rules
          'semi': ['error', 'always'],
          'quotes': ['error', 'single', { avoidEscape: true }],
          'indent': ['error', 2],
          'comma-dangle': ['error', 'always-multiline'],
          'arrow-spacing': 'error',
          'space-before-blocks': 'error',
          'keyword-spacing': 'error',
          'object-curly-spacing': ['error', 'always'],
          'array-bracket-spacing': ['error', 'never'],
          'no-trailing-spaces': 'error',
          'eol-last': ['error', 'always'],
          
          // Naming
          'camelcase': ['warn', { properties: 'never' }],
          'new-cap': 'error',
          
          // Best practices that affect style
          'curly': ['error', 'all'],
          'brace-style': ['error', '1tbs'],
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
        const lineIdx = (m.line || 1) - 1;
        const codeSnippet = lines[lineIdx]?.trim().slice(0, 120) || '';
        const { suggestion, example } = getStyleSuggestion(m.ruleId, m.message, codeSnippet);
        
        findings.push({
          analyzer: 'style',
          file: path.relative(baseDir, res.filePath),
          line: m.line || 1,
          column: m.column || 1,
          rule: m.ruleId || 'style-issue',
          severity: 'low', // Style issues are generally low severity
          message: m.message,
          source: 'style-analyzer',
          suggestion,
          example,
          codeSnippet,
        });
      }
    }
  } catch (e) {
    // Silent fail - other analyzers will still run
  }
  
  return findings;
}

function getStyleSuggestion(ruleId, message, codeSnippet) {
  const suggestionMap = {
    'semi': {
      suggestion: 'Add a semicolon at the end. Run eslint --fix to auto-fix.',
      example: `❌ const x = 5\n✅ const x = 5;`,
    },
    'quotes': {
      suggestion: 'Use single quotes consistently. Run eslint --fix to auto-fix.',
      example: `❌ const msg = "hello"\n✅ const msg = 'hello'`,
    },
    'indent': {
      suggestion: 'Use 2-space indentation consistently. Run eslint --fix to auto-fix.',
      example: `❌   if (true) {\n✅ if (true) {`,
    },
    'comma-dangle': {
      suggestion: 'Add trailing commas in multiline structures. Run eslint --fix.',
      example: `❌ { a: 1, b: 2 }\n✅ { a: 1, b: 2, }`,
    },
    'no-trailing-spaces': {
      suggestion: 'Remove trailing whitespace. Run eslint --fix.',
      example: `❌ const x = 5;   \n✅ const x = 5;`,
    },
    'camelcase': {
      suggestion: 'Use camelCase for variable and function names.',
      example: `❌ const user_name = 'John'\n✅ const userName = 'John'`,
    },
    'curly': {
      suggestion: 'Wrap control statements in curly braces for clarity.',
      example: `❌ if (condition) doSomething()\n✅ if (condition) { doSomething(); }`,
    },
    'brace-style': {
      suggestion: 'Follow 1TBS brace style (opening brace on same line).',
      example: `❌ if (condition)\n{ code }\n✅ if (condition) {\n  code\n}`,
    },
    'space-before-blocks': {
      suggestion: 'Add space before block opening brace.',
      example: `❌ if (true){ code }\n✅ if (true) { code }`,
    },
    'keyword-spacing': {
      suggestion: 'Add proper spacing around keywords.',
      example: `❌ if(condition)\n✅ if (condition)`,
    },
    'object-curly-spacing': {
      suggestion: 'Add spaces inside object braces.',
      example: `❌ {a: 1, b: 2}\n✅ { a: 1, b: 2 }`,
    },
    'arrow-spacing': {
      suggestion: 'Add spaces around arrow function arrow.',
      example: `❌ const fn =()=>{}\n✅ const fn = () => {}`,
    },
  };
  
  const result = suggestionMap[ruleId] || {
    suggestion: `Fix style issue: ${message}`,
    example: codeSnippet ? `Current: ${codeSnippet}` : '',
  };
  
  return result;
}

module.exports = { analyzeStyle };
