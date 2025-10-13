const fsp = require('fs').promises;
const path = require('path');

/**
 * HTML Analyzer
 * Checks: accessibility, semantic HTML, SEO, security, best practices
 */
async function analyzeHTML(baseDir, files) {
  const findings = [];
  
  const patterns = [
    // Accessibility Issues
    {
      id: 'missing-alt-attribute',
      re: /<img(?![^>]*alt=)/i,
      severity: 'high',
      message: 'Image missing alt attribute - accessibility issue',
      suggestion: 'Add descriptive alt text to all images for screen readers.',
      example: `❌ <img src="photo.jpg">
✅ <img src="photo.jpg" alt="Description of image">`,
    },
    {
      id: 'empty-alt-attribute',
      re: /<img[^>]*alt=["']\s*["']/i,
      severity: 'medium',
      message: 'Image has empty alt attribute',
      suggestion: 'Provide descriptive alt text, or use alt="" only for decorative images.',
      example: `❌ <img src="photo.jpg" alt="">
✅ <img src="photo.jpg" alt="User profile photo">`,
    },
    {
      id: 'missing-label-for-input',
      re: /<input(?![^>]*id=)(?![^>]*type=["']?(hidden|submit|button))/i,
      severity: 'high',
      message: 'Input field without associated label - accessibility issue',
      suggestion: 'Wrap input in <label> or use id/for attributes to associate labels.',
      example: `❌ <input type="text" placeholder="Name">
✅ <label for="name">Name: <input type="text" id="name"></label>`,
    },
    {
      id: 'button-without-text',
      re: /<button[^>]*>\s*<\/button>/i,
      severity: 'high',
      message: 'Button element without text content',
      suggestion: 'Add descriptive text inside button or use aria-label.',
      example: `❌ <button></button>
✅ <button>Submit</button> or <button aria-label="Submit form"></button>`,
    },
    
    // Semantic HTML
    {
      id: 'div-soup',
      re: /<div[^>]*>\s*<div[^>]*>\s*<div[^>]*>\s*<div/i,
      severity: 'low',
      message: 'Excessive nested divs - consider semantic HTML',
      suggestion: 'Use semantic elements like <header>, <nav>, <main>, <article>, <section>, <footer>.',
      example: `❌ <div class="header"><div class="nav">...
✅ <header><nav>...`,
    },
    {
      id: 'inline-event-handler',
      re: /\s(onclick|onload|onerror|onmouseover|onchange)=/i,
      severity: 'medium',
      message: 'Inline event handler detected - potential XSS risk and poor practice',
      suggestion: 'Use addEventListener in JavaScript instead of inline event handlers.',
      example: `❌ <button onclick="handleClick()">
✅ <button id="myBtn">Click</button> + JS: btn.addEventListener('click', handleClick)`,
    },
    
    // Security Issues
    {
      id: 'inline-javascript',
      re: /<script[^>]*>(?![\s\S]*src=)/i,
      severity: 'medium',
      message: 'Inline JavaScript detected - consider external files',
      suggestion: 'Move JavaScript to external .js files for better caching and CSP compliance.',
      example: `❌ <script>console.log('inline');</script>
✅ <script src="app.js"></script>`,
    },
    {
      id: 'target-blank-without-rel',
      re: /<a[^>]*target=["']_blank["'](?![^>]*rel=["'][^"']*noopener)/i,
      severity: 'high',
      message: 'target="_blank" without rel="noopener" - security risk',
      suggestion: 'Add rel="noopener noreferrer" to prevent reverse tabnabbing attacks.',
      example: `❌ <a href="..." target="_blank">
✅ <a href="..." target="_blank" rel="noopener noreferrer">`,
    },
    
    // SEO Issues
    {
      id: 'missing-title',
      re: /^(?![\s\S]*<title>)/i,
      severity: 'high',
      message: 'Missing <title> tag - critical for SEO',
      suggestion: 'Add a descriptive <title> tag in <head> section.',
      example: `❌ <head><meta charset="UTF-8"></head>
✅ <head><title>Page Title</title><meta charset="UTF-8"></head>`,
    },
    {
      id: 'missing-meta-description',
      re: /^(?![\s\S]*<meta[^>]*name=["']description)/i,
      severity: 'medium',
      message: 'Missing meta description - important for SEO',
      suggestion: 'Add a meta description tag for search engines.',
      example: `❌ <head><title>Page</title></head>
✅ <head><title>Page</title><meta name="description" content="Page description"></head>`,
    },
    {
      id: 'missing-viewport',
      re: /^(?![\s\S]*<meta[^>]*name=["']viewport)/i,
      severity: 'medium',
      message: 'Missing viewport meta tag - affects mobile responsiveness',
      suggestion: 'Add viewport meta tag for responsive design.',
      example: `❌ <head><title>Page</title></head>
✅ <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>`,
    },
    
    // Best Practices
    {
      id: 'inline-style',
      re: /\sstyle=["'][^"']{20,}/i,
      severity: 'low',
      message: 'Extensive inline styles detected',
      suggestion: 'Move styles to external CSS file or <style> block for maintainability.',
      example: `❌ <div style="color: red; font-size: 14px; ...">
✅ <div class="styled-div"> + CSS: .styled-div { color: red; }`,
    },
    {
      id: 'deprecated-tag',
      re: /<(font|center|marquee|blink|big|tt|strike|basefont|frameset|frame|noframes|applet|isindex|dir|menu)\b/i,
      severity: 'medium',
      message: 'Deprecated HTML tag detected',
      suggestion: 'Replace deprecated tags with modern HTML5 and CSS alternatives.',
      example: `❌ <font color="red">Text</font>
✅ <span style="color: red">Text</span>`,
    },
    {
      id: 'empty-href',
      re: /<a[^>]*href=["']#["']/i,
      severity: 'low',
      message: 'Anchor tag with empty href="#"',
      suggestion: 'Use href="#!" or button element instead, or provide meaningful link.',
      example: `❌ <a href="#">Click</a>
✅ <button type="button">Click</button>`,
    },
    {
      id: 'http-in-src',
      re: /<(?:img|script|link)[^>]*(?:src|href)=["']http:\/\//i,
      severity: 'medium',
      message: 'HTTP resource in HTTPS page - mixed content warning',
      suggestion: 'Use HTTPS URLs or protocol-relative URLs (//).',
      example: `❌ <img src="http://example.com/image.jpg">
✅ <img src="https://example.com/image.jpg">`,
    },
    {
      id: 'missing-lang-attribute',
      re: /<html(?![^>]*lang=)/i,
      severity: 'medium',
      message: 'Missing lang attribute on <html> tag',
      suggestion: 'Add lang attribute for accessibility and SEO.',
      example: `❌ <html>
✅ <html lang="en">`,
    },
    {
      id: 'multiple-h1',
      re: /<h1[^>]*>[\s\S]*<h1[^>]*>/i,
      severity: 'low',
      message: 'Multiple <h1> tags detected',
      suggestion: 'Use only one <h1> per page for better SEO and document structure.',
      example: `❌ <h1>Title 1</h1> ... <h1>Title 2</h1>
✅ <h1>Main Title</h1> ... <h2>Subtitle</h2>`,
    },
  ];
  
  const htmlFiles = files.filter(f => /\.(html|htm)$/i.test(f));
  
  // Separate line-level patterns from file-level patterns
  const lineLevelPatterns = patterns.filter(p => 
    !p.id.startsWith('missing-') && !p.id.includes('multiple-h1')
  );
  
  const fileLevelPatterns = patterns.filter(p => 
    p.id.startsWith('missing-') || p.id.includes('multiple-h1')
  );
  
  for (const file of htmlFiles) {
    const filePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
    try {
      const content = await fsp.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      
      // Check line-level patterns (like inline handlers, empty buttons, etc.)
      for (const pattern of lineLevelPatterns) {
        lines.forEach((line, idx) => {
          if (pattern.re.test(line)) {
            findings.push({
              analyzer: 'html',
              file: path.relative(baseDir, filePath),
              line: idx + 1,
              column: 1,
              rule: pattern.id,
              severity: pattern.severity,
              message: pattern.message,
              source: 'html-analyzer',
              suggestion: pattern.suggestion,
              example: pattern.example,
              codeSnippet: line.trim().slice(0, 120),
            });
          }
        });
      }
      
      // Check file-level patterns ONCE per file (not on every line!)
      for (const pattern of fileLevelPatterns) {
        // For "missing" patterns, check if it's NOT in the content
        if (pattern.id.startsWith('missing-')) {
          if (!content.includes(pattern.id.replace('missing-', '').replace('-', ' '))) {
            // More precise checks
            if (pattern.id === 'missing-title' && !/<title>/i.test(content)) {
              findings.push({
                analyzer: 'html',
                file: path.relative(baseDir, filePath),
                line: 1,
                column: 1,
                rule: pattern.id,
                severity: pattern.severity,
                message: pattern.message,
                source: 'html-analyzer',
                suggestion: pattern.suggestion,
                example: pattern.example,
                codeSnippet: '<head>',
              });
            } else if (pattern.id === 'missing-meta-description' && !/<meta[^>]*name=["']description/i.test(content)) {
              findings.push({
                analyzer: 'html',
                file: path.relative(baseDir, filePath),
                line: 1,
                column: 1,
                rule: pattern.id,
                severity: pattern.severity,
                message: pattern.message,
                source: 'html-analyzer',
                suggestion: pattern.suggestion,
                example: pattern.example,
                codeSnippet: '<head>',
              });
            } else if (pattern.id === 'missing-viewport' && !/<meta[^>]*name=["']viewport/i.test(content)) {
              findings.push({
                analyzer: 'html',
                file: path.relative(baseDir, filePath),
                line: 1,
                column: 1,
                rule: pattern.id,
                severity: pattern.severity,
                message: pattern.message,
                source: 'html-analyzer',
                suggestion: pattern.suggestion,
                example: pattern.example,
                codeSnippet: '<head>',
              });
            } else if (pattern.id === 'missing-lang-attribute' && !/<html[^>]*lang=/i.test(content)) {
              findings.push({
                analyzer: 'html',
                file: path.relative(baseDir, filePath),
                line: 1,
                column: 1,
                rule: pattern.id,
                severity: pattern.severity,
                message: pattern.message,
                source: 'html-analyzer',
                suggestion: pattern.suggestion,
                example: pattern.example,
                codeSnippet: '<html>',
              });
            }
          }
        } else if (pattern.id === 'multiple-h1') {
          // Check for multiple H1 tags
          const h1Count = (content.match(/<h1[^>]*>/gi) || []).length;
          if (h1Count > 1) {
            findings.push({
              analyzer: 'html',
              file: path.relative(baseDir, filePath),
              line: 1,
              column: 1,
              rule: pattern.id,
              severity: pattern.severity,
              message: `Multiple <h1> tags detected (${h1Count} found)`,
              source: 'html-analyzer',
              suggestion: pattern.suggestion,
              example: pattern.example,
              codeSnippet: '',
            });
          }
        }
      }
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  return findings;
}

module.exports = { analyzeHTML };
