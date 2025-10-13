const fsp = require('fs').promises;
const path = require('path');

/**
 * CSS Analyzer
 * Checks: best practices, performance, accessibility, maintainability
 */
async function analyzeCSS(baseDir, files) {
  const findings = [];
  
  const patterns = [
    // Performance Issues
    {
      id: 'universal-selector',
      re: /^\s*\*\s*\{/m,
      severity: 'medium',
      message: 'Universal selector (*) - performance impact',
      suggestion: 'Avoid universal selector as it matches every element. Use specific selectors instead.',
      example: `❌ * { margin: 0; }
✅ body, h1, h2, p { margin: 0; }`,
    },
    {
      id: 'excessive-specificity',
      re: /#[\w-]+\s+#[\w-]+/,
      severity: 'low',
      message: 'Excessive selector specificity with multiple IDs',
      suggestion: 'Reduce specificity by using single ID or class selectors.',
      example: `❌ #header #nav { }
✅ #nav { } or .header-nav { }`,
    },
    {
      id: 'important-overuse',
      re: /!important/i,
      severity: 'low',
      message: '!important flag detected - indicates specificity issues',
      suggestion: 'Avoid !important. Fix specificity issues by restructuring selectors.',
      example: `❌ .button { color: red !important; }
✅ .primary-button { color: red; }`,
    },
    {
      id: 'too-many-font-families',
      re: /font-family:\s*[^;]{100,}/i,
      severity: 'low',
      message: 'Very long font-family declaration',
      suggestion: 'Limit font fallback stack to 3-4 fonts for better performance.',
      example: `❌ font-family: Font1, Font2, Font3, Font4, Font5, ...
✅ font-family: 'Primary Font', Arial, sans-serif`,
    },
    
    // Accessibility Issues
    {
      id: 'low-contrast-text',
      re: /color:\s*#([0-9a-f]{3}|[0-9a-f]{6});?\s*background(?:-color)?:\s*#([0-9a-f]{3}|[0-9a-f]{6})/i,
      severity: 'medium',
      message: 'Potential low contrast between text and background',
      suggestion: 'Ensure text has sufficient contrast ratio (4.5:1 for normal text, 3:1 for large text).',
      example: `❌ color: #999; background: #ccc; /* Low contrast */
✅ color: #333; background: #fff; /* Good contrast */`,
    },
    {
      id: 'tiny-font-size',
      re: /font-size:\s*[0-9]px/i,
      severity: 'medium',
      message: 'Font size less than 10px - accessibility issue',
      suggestion: 'Use at least 12px font size for readability. Consider rem units for scalability.',
      example: `❌ font-size: 8px;
✅ font-size: 0.875rem; /* 14px */`,
    },
    {
      id: 'outline-none-without-alternative',
      re: /outline:\s*none/i,
      severity: 'high',
      message: 'outline: none without visible focus alternative',
      suggestion: 'Provide alternative focus styles for keyboard navigation accessibility.',
      example: `❌ :focus { outline: none; }
✅ :focus { outline: none; box-shadow: 0 0 0 3px rgba(0,123,255,.5); }`,
    },
    
    // Best Practices
    {
      id: 'px-instead-of-rem',
      re: /font-size:\s*\d+px/i,
      severity: 'low',
      message: 'Using px for font-size instead of relative units',
      suggestion: 'Use rem or em for better scalability and accessibility.',
      example: `❌ font-size: 16px;
✅ font-size: 1rem;`,
    },
    {
      id: 'missing-fallback-color',
      re: /(rgba?|hsla?)\([^)]+\)(?![^;]*;[^}]*\b(?:background|color))/i,
      severity: 'low',
      message: 'RGB/HSL color without fallback for older browsers',
      suggestion: 'Provide hex/named color fallback before rgba/hsla.',
      example: `❌ color: rgba(255, 0, 0, 0.8);
✅ color: #ff0000; color: rgba(255, 0, 0, 0.8);`,
    },
    {
      id: 'vendor-prefix-missing',
      re: /(transform|transition|animation|flex|user-select):/i,
      severity: 'low',
      message: 'CSS property may need vendor prefixes for older browsers',
      suggestion: 'Consider using autoprefixer or add vendor prefixes manually.',
      example: `❌ transform: rotate(45deg);
✅ -webkit-transform: rotate(45deg); transform: rotate(45deg);`,
    },
    {
      id: 'color-name-instead-of-hex',
      re: /(?:color|background(?:-color)?|border(?:-color)?):\s*(red|blue|green|yellow|black|white|gray|grey)\b/i,
      severity: 'low',
      message: 'Using color name instead of hex/rgb',
      suggestion: 'Use hex or rgb for precise color control and better browser support.',
      example: `❌ color: red;
✅ color: #ff0000;`,
    },
    {
      id: 'missing-box-sizing',
      re: /width:\s*\d+%[^}]*padding:/i,
      severity: 'low',
      message: 'Using percentage width with padding without box-sizing',
      suggestion: 'Add box-sizing: border-box to include padding in width calculation.',
      example: `❌ width: 100%; padding: 20px;
✅ box-sizing: border-box; width: 100%; padding: 20px;`,
    },
    
    // Responsive Design
    {
      id: 'hardcoded-dimensions',
      re: /width:\s*\d{3,}px|height:\s*\d{3,}px/i,
      severity: 'low',
      message: 'Large hardcoded dimensions - may not be responsive',
      suggestion: 'Consider using relative units (%, vw, vh) or max-width for responsiveness.',
      example: `❌ width: 1200px;
✅ max-width: 1200px; width: 100%;`,
    },
    {
      id: 'fixed-positioning-overuse',
      re: /position:\s*fixed/i,
      severity: 'low',
      message: 'Fixed positioning - test on mobile devices',
      suggestion: 'Fixed elements can cause issues on mobile. Test thoroughly or use sticky.',
      example: `❌ position: fixed;
✅ position: sticky; /* For headers/navbars */`,
    },
    
    // Maintainability
    {
      id: 'magic-numbers',
      re: /:\s*\d{3,}(?:px|em|rem)/i,
      severity: 'low',
      message: 'Large numeric value - consider using CSS variable',
      suggestion: 'Define commonly used values as CSS custom properties for easier maintenance.',
      example: `❌ margin-top: 150px;
✅ :root { --spacing-xl: 150px; } ... margin-top: var(--spacing-xl);`,
    },
    {
      id: 'duplicate-properties',
      re: /([\w-]+):\s*[^;]+;[^}]*\1:/i,
      severity: 'low',
      message: 'Duplicate property in same rule',
      suggestion: 'Remove duplicate properties. Only the last one takes effect.',
      example: `❌ color: red; font-size: 14px; color: blue;
✅ color: blue; font-size: 14px;`,
    },
    {
      id: 'empty-ruleset',
      re: /[^}]+\{\s*\}/,
      severity: 'low',
      message: 'Empty CSS ruleset',
      suggestion: 'Remove empty rulesets to reduce file size.',
      example: `❌ .unused-class { }
✅ /* Remove if not needed */`,
    },
    
    // Modern CSS Features
    {
      id: 'use-css-grid',
      re: /display:\s*inline-block[^}]*display:\s*inline-block/i,
      severity: 'low',
      message: 'Multiple inline-block elements - consider CSS Grid or Flexbox',
      suggestion: 'Use modern layout methods like Grid or Flexbox for better control.',
      example: `❌ .item { display: inline-block; }
✅ .container { display: grid; grid-template-columns: repeat(3, 1fr); }`,
    },
    {
      id: 'float-layout',
      re: /float:\s*(left|right)/i,
      severity: 'low',
      message: 'Using float for layout - consider Flexbox or Grid',
      suggestion: 'Floats are outdated for layouts. Use Flexbox or Grid instead.',
      example: `❌ float: left;
✅ display: flex; or display: grid;`,
    },
  ];
  
  const cssFiles = files.filter(f => /\.css$/i.test(f));
  
  for (const file of cssFiles) {
    const filePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
    try {
      const content = await fsp.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      
      // Basic syntax checks: mismatched braces
      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        findings.push({
          analyzer: 'css',
          file: path.relative(baseDir, filePath),
          line: 1,
          column: 1,
          rule: 'mismatched-braces',
          severity: 'high',
          message: `Mismatched braces in CSS: ${openBraces} opening, ${closeBraces} closing`,
          source: 'css-analyzer',
          suggestion: 'Ensure each { has a matching }.',
          example: `❌ a { color: red; } }\n✅ a { color: red; }`,
          codeSnippet: '',
        });
      }
      
      // Check for line-level patterns
      for (const pattern of patterns) {
        lines.forEach((line, idx) => {
          if (pattern.re.test(line)) {
            findings.push({
              analyzer: 'css',
              file: path.relative(baseDir, filePath),
              line: idx + 1,
              column: 1,
              rule: pattern.id,
              severity: pattern.severity,
              message: pattern.message,
              source: 'css-analyzer',
              suggestion: pattern.suggestion,
              example: pattern.example,
              codeSnippet: line.trim().slice(0, 120),
            });
          }
        });
      }
      
      // Check for duplicate selectors
      const selectors = [];
      const selectorLines = {};
      lines.forEach((line, idx) => {
        const match = line.match(/^\s*([.#]?[\w-]+)\s*\{/);
        if (match) {
          const selector = match[1];
          if (selectors.includes(selector)) {
            findings.push({
              analyzer: 'css',
              file: path.relative(baseDir, filePath),
              line: idx + 1,
              column: 1,
              rule: 'duplicate-selector',
              severity: 'medium',
              message: `Duplicate selector '${selector}' detected`,
              source: 'css-analyzer',
              suggestion: 'Combine duplicate selectors into one rule for maintainability.',
              example: `❌ .btn { color: red; }\n.btn { margin: 10px; }\n✅ .btn { color: red; margin: 10px; }`,
              codeSnippet: line.trim().slice(0, 120),
            });
          } else {
            selectors.push(selector);
            selectorLines[selector] = idx + 1;
          }
        }
      });
      
      // Detect invalid declarations inside rules (no colon present)
      let inRule = false;
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.endsWith('{')) inRule = true;
        if (inRule && trimmed && !trimmed.startsWith('/*') && !trimmed.includes(':') && !trimmed.endsWith('{') && !trimmed.endsWith('}')) {
          findings.push({
            analyzer: 'css',
            file: path.relative(baseDir, filePath),
            line: idx + 1,
            column: 1,
            rule: 'invalid-css-declaration',
            severity: 'high',
            message: 'Invalid CSS declaration - missing property:value;',
            source: 'css-analyzer',
            suggestion: 'Use proper CSS syntax: property: value;',
            example: `❌ mmam\n✅ margin: 1rem;`,
            codeSnippet: trimmed,
          });
        }
        if (trimmed.endsWith('}')) inRule = false;
      });
      
      // Check for empty rulesets
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*[^}]+\{\s*\}\s*$/.test(line)) {
          findings.push({
            analyzer: 'css',
            file: path.relative(baseDir, filePath),
            line: i + 1,
            column: 1,
            rule: 'empty-ruleset',
            severity: 'low',
            message: 'Empty CSS ruleset',
            suggestion: 'Remove empty rulesets to reduce file size.',
            example: `❌ .unused { }\n✅ /* Remove if not needed */`,
            codeSnippet: line.trim(),
          });
        }
      }
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  return findings;
}

module.exports = { analyzeCSS };
