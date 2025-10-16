/**
 * LLM Response Filter
 * 
 * Cleans LLM outputs to remove common problematic patterns that can break code:
 * 1. Explanatory comments before/after code blocks
 * 2. Markdown code fences
 * 3. "Changes made:" summaries
 * 4. "Here's the corrected code:" introductions
 * 5. Meta-commentary about the fixes
 */

const logger = require('../utils/prettyLogger');

/**
 * Patterns that indicate non-code explanatory text
 */
const EXPLANATORY_PATTERNS = [
  // "Here's the code..." introductions
  /^Here'?s?\s+(?:the\s+)?(?:corrected|fixed|updated|improved|refactored)\s+code/im,
  /^I\s+(?:added|removed|fixed|changed|updated)/im,
  /^This\s+code/im,
  /^In\s+this\s+code/im,
  
  // "Changes made:" summaries
  /^Changes\s+made:/im,
  /^Modifications:/im,
  /^Updates:/im,
  /^Fixes\s+applied:/im,
  /^Fixed\s+issues?:/im,
  /^Corrected\s+(?:the|issues):/im,
  
  // Numbered change lists (1., 2., 3., etc.)
  /^\d+\.\s+(?:Replaced|Added|Removed|Fixed|Changed|Used|Updated)/im,
  
  // Explanatory paragraphs about what was done
  /^I've\s+fixed\s+(?:the|a|an)/im,
  /^For\s+the\s+.+\s+issue/im,
  /^Regarding\s+the/im,
  /^Lastly,\s+I've/im,
  /^If\s+you(?:'re|\s+are)\s+using/im,
  /^you\s+(?:should|can|may)\s+(?:catch|replace|use)/im,
  
  // Meta-commentary
  /^(?:Note|Important|Warning):/im,
  /^I've\s+(?:added|removed|fixed)/im,
  /^The\s+following\s+changes/im,
];

/**
 * Detect if a line is likely explanatory text (not code)
 */
function isExplanatoryLine(line) {
  const trimmed = line.trim();
  
  // Empty lines are fine
  if (!trimmed) return false;
  
  // Check against known patterns
  for (const pattern of EXPLANATORY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  // Multi-line comment blocks that look like summaries
  if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) {
    // Check if it contains summary-like keywords
    const summaryKeywords = [
      'changes made',
      'modifications',
      'added missing',
      'removed document.write',
      'moved inline',
      'security risk',
      'poses a',
      'potential xss',
      'blocks page rendering',
      'resource not closed',
      'unsafe deserialization',
      'path traversal',
      'try-with-resources',
      'logging framework',
      'generic exceptions'
    ];
    
    const lowerLine = trimmed.toLowerCase();
    for (const keyword of summaryKeywords) {
      if (lowerLine.includes(keyword)) {
        return true;
      }
    }
  }
  
  // Detect explanatory sentences (not code)
  // These typically have sentence structure: subject + verb + object
  if (!trimmed.match(/^[\w$]+\s*[=:({<]/) && // Not code assignment/function call
      !trimmed.match(/^(const|let|var|function|class|import|export|return|if|for|while)\b/) && // Not code keyword
      !trimmed.match(/^[\w$]+\s*\(/) && // Not function call
      !trimmed.match(/^[{}\[\];,]/) && // Not code punctuation
      trimmed.length > 40 && // Long enough to be explanatory
      trimmed.match(/\b(?:I've|I have|you should|you can|recommend|ensure|avoid|replace)\b/i)) { // Explanatory verbs
    return true;
  }
  
  return false;
}

/**
 * Remove markdown code fences
 */
function stripCodeFences(text) {
  // Remove opening fence with optional language
  text = text.replace(/^```[a-zA-Z]*\n/gm, '');
  
  // Remove closing fence
  text = text.replace(/\n```$/gm, '');
  
  return text;
}

/**
 * Remove explanatory text blocks before the actual code
 */
function removeIntroText(text) {
  const lines = text.split('\n');
  let codeStartIndex = 0;
  
  // Find where actual code starts (skip intro lines)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // If it's an explanatory line, skip it
    if (isExplanatoryLine(line)) {
      codeStartIndex = i + 1;
      continue;
    }
    
    // Found first line of actual code
    break;
  }
  
  return lines.slice(codeStartIndex).join('\n');
}

/**
 * Remove explanatory text blocks after the actual code
 */
function removeOutroText(text) {
  const lines = text.split('\n');
  let codeEndIndex = lines.length;
  
  // Scan backwards to find where code ends
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // If it's an explanatory line, mark as end
    if (isExplanatoryLine(line)) {
      codeEndIndex = i;
      continue;
    }
    
    // Found last line of actual code
    break;
  }
  
  return lines.slice(0, codeEndIndex).join('\n');
}

/**
 * Remove multi-line comment blocks that are obviously summaries, not code comments
 */
function removeExplanatoryComments(text) {
  const lines = text.split('\n');
  const result = [];
  let inSummaryBlock = false;
  let blockLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect start of multi-line comment
    if (trimmed.startsWith('/*')) {
      inSummaryBlock = true;
      blockLines = [line];
      continue;
    }
    
    // Inside a comment block
    if (inSummaryBlock) {
      blockLines.push(line);
      
      // End of comment block
      if (trimmed.includes('*/')) {
        inSummaryBlock = false;
        
        // Check if this block is a summary (contains explanatory text)
        const blockText = blockLines.join('\n');
        let isSummary = false;
        
        for (const blockLine of blockLines) {
          if (isExplanatoryLine(blockLine)) {
            isSummary = true;
            break;
          }
        }
        
        // If NOT a summary, keep it (it's a real code comment)
        if (!isSummary) {
          result.push(...blockLines);
        } else {
          // Log that we removed a summary block
          if (process.env.LLM_DEBUG === '1') {
            logger.info('filter', 'Removed explanatory comment block', { 
              lines: blockLines.length,
              preview: blockLines[0].trim().substring(0, 50) 
            });
          }
        }
        
        blockLines = [];
      }
      continue;
    }
    
    // Regular line (not in comment block)
    result.push(line);
  }
  
  return result.join('\n');
}

/**
 * Main filtering function - clean LLM response to pure code
 */
function cleanLLMResponse(text, options = {}) {
  const { 
    debug = process.env.LLM_DEBUG === '1',
    filename = 'unknown'
  } = options;
  
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  const original = text;
  let cleaned = text;
  
  // Step 1: Remove markdown code fences
  cleaned = stripCodeFences(cleaned);
  
  // Step 2: Remove intro text ("Here's the corrected code...")
  cleaned = removeIntroText(cleaned);
  
  // Step 3: Remove outro text ("Changes made:...")
  cleaned = removeOutroText(cleaned);
  
  // Step 4: Remove explanatory comment blocks
  cleaned = removeExplanatoryComments(cleaned);
  
  // Step 5: Trim excess whitespace
  cleaned = cleaned.trim();
  
  // Log if significant changes were made
  if (debug && cleaned !== original) {
    const originalLines = original.split('\n').length;
    const cleanedLines = cleaned.split('\n').length;
    const removedLines = originalLines - cleanedLines;
    
    if (removedLines > 0) {
      logger.info('filter', 'Cleaned LLM response', {
        file: filename,
        originalLines,
        cleanedLines,
        removedLines,
        removedPercent: `${((removedLines / originalLines) * 100).toFixed(1)}%`
      });
    }
  }
  
  return cleaned;
}

/**
 * Validate that the cleaned response looks like valid code
 */
function validateCodeStructure(text, language = 'javascript') {
  const lines = text.split('\n');
  let codeLineCount = 0;
  let commentLineCount = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      commentLineCount++;
    } else {
      codeLineCount++;
    }
  }
  
  // If more than 50% are comments, something is wrong
  const totalLines = codeLineCount + commentLineCount;
  if (totalLines > 0 && commentLineCount / totalLines > 0.5) {
    return {
      valid: false,
      reason: 'Too many comment lines (possibly explanatory text)',
      codeLines: codeLineCount,
      commentLines: commentLineCount
    };
  }
  
  // Basic language-specific validation
  if (language === 'javascript' || language === 'typescript') {
    // Should have some typical JS/TS patterns
    const hasTypicalCode = /(?:function|const|let|var|class|import|export|=>)/i.test(text);
    if (!hasTypicalCode && codeLineCount > 5) {
      return {
        valid: false,
        reason: 'Missing typical JavaScript/TypeScript syntax patterns'
      };
    }
  }
  
  return {
    valid: true,
    codeLines: codeLineCount,
    commentLines: commentLineCount
  };
}

module.exports = {
  cleanLLMResponse,
  validateCodeStructure,
  isExplanatoryLine,
  stripCodeFences,
  removeExplanatoryComments
};
