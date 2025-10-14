/**
 * Issue Categorization Module
 * Maps findings (severity + rule type) to consequence-based categories
 * Categories: BLOCKING, URGENT, RECOMMENDED, OPTIONAL
 */

// Security-related rule patterns that should always be BLOCKING
const SECURITY_PATTERNS = [
  /sql.*injection/i,
  /xss/i,
  /cross.*site.*script/i,
  /csrf/i,
  /auth/i,
  /password/i,
  /secret/i,
  /token.*expos/i,
  /insecure/i,
  /vulnerab/i,
  /exploit/i,
  /command.*injection/i,
  /path.*traversal/i,
  /dos/i,
  /denial.*service/i,
];

// Critical runtime error patterns (BLOCKING)
const RUNTIME_ERROR_PATTERNS = [
  /null.*pointer/i,
  /undefined.*reference/i,
  /division.*zero/i,
  /crash/i,
  /fatal/i,
  /exception.*unhandled/i,
  /memory.*leak/i,
  /buffer.*overflow/i,
  /race.*condition/i,
  /deadlock/i,
];

// Data integrity patterns (URGENT)
const DATA_INTEGRITY_PATTERNS = [
  /data.*loss/i,
  /corrupt/i,
  /invalid.*state/i,
  /inconsistent/i,
  /transaction/i,
  /concurrent/i,
];

// Deprecated/breaking change patterns (URGENT)
const DEPRECATION_PATTERNS = [
  /deprecated/i,
  /obsolete/i,
  /breaking.*change/i,
  /removed.*api/i,
  /no.*longer.*support/i,
];

// Performance patterns (RECOMMENDED)
const PERFORMANCE_PATTERNS = [
  /performance/i,
  /slow/i,
  /inefficient/i,
  /optimization/i,
  /n\+1/i,
  /query.*performance/i,
  /memory.*usage/i,
];

// Code quality patterns (OPTIONAL)
const QUALITY_PATTERNS = [
  /style/i,
  /format/i,
  /naming/i,
  /convention/i,
  /comment/i,
  /documentation/i,
  /unused.*variable/i,
  /duplicate.*code/i,
  /complexity/i,
];

/**
 * Categorize a finding into BLOCKING/URGENT/RECOMMENDED/OPTIONAL
 * @param {Object} finding - Finding object with severity, rule, message
 * @returns {Object} Enhanced finding with category, impact, effort, consequence, canSkip
 */
function categorizeFinding(finding) {
  const { severity = 'medium', rule = '', message = '' } = finding;
  const text = `${rule} ${message}`.toLowerCase();
  
  let category = 'RECOMMENDED'; // default
  let impact = '';
  let consequence = '';
  let effort = '5 min'; // default
  let canSkip = true;
  
  // Check for BLOCKING issues (security + critical runtime errors)
  if (SECURITY_PATTERNS.some(p => p.test(text))) {
    category = 'BLOCKING';
    impact = 'Security vulnerability - attackers can exploit this';
    consequence = 'Your app is vulnerable to attacks. Production risk!';
    effort = estimateEffort(finding);
    canSkip = false; // Requires acknowledgment
  } else if (RUNTIME_ERROR_PATTERNS.some(p => p.test(text))) {
    category = 'BLOCKING';
    impact = 'Will cause app crashes or fatal errors';
    consequence = 'Your app will crash in production';
    effort = estimateEffort(finding);
    canSkip = false;
  } 
  // Check for URGENT issues
  else if (severity === 'critical' || DATA_INTEGRITY_PATTERNS.some(p => p.test(text))) {
    category = 'URGENT';
    impact = 'Will cause bugs or data corruption soon';
    consequence = 'Can lead to data loss or application errors';
    effort = estimateEffort(finding);
    canSkip = true;
  } else if (DEPRECATION_PATTERNS.some(p => p.test(text))) {
    category = 'URGENT';
    impact = 'Using deprecated API - will break in future updates';
    consequence = 'Your code will break when dependencies update';
    effort = estimateEffort(finding);
    canSkip = true;
  }
  // Check for RECOMMENDED issues
  else if (severity === 'high' || PERFORMANCE_PATTERNS.some(p => p.test(text))) {
    category = 'RECOMMENDED';
    impact = 'Performance degradation or code quality issue';
    consequence = 'Technical debt will accumulate';
    effort = estimateEffort(finding);
    canSkip = true;
  }
  // Everything else is OPTIONAL
  else if (severity === 'low' || QUALITY_PATTERNS.some(p => p.test(text))) {
    category = 'OPTIONAL';
    impact = 'Minor improvement - no functional impact';
    consequence = 'No immediate issues, just cleaner code';
    effort = estimateEffort(finding);
    canSkip = true;
  }
  
  // Return enhanced finding
  return {
    ...finding,
    category,
    impact,
    consequence,
    effort,
    canSkip,
  };
}

/**
 * Estimate effort based on finding complexity
 */
function estimateEffort(finding) {
  const { rule = '', message = '' } = finding;
  const text = `${rule} ${message}`.toLowerCase();
  
  // Complex fixes (10+ min)
  if (/refactor|restructure|redesign|migrate/i.test(text)) {
    return '15 min';
  }
  
  // Medium fixes (5-10 min)
  if (/replace|update|change.*logic|add.*validation/i.test(text)) {
    return '10 min';
  }
  
  // Simple fixes (2-5 min)
  if (/remove|delete|add|fix.*typo/i.test(text)) {
    return '3 min';
  }
  
  // Default
  return '5 min';
}

/**
 * Categorize all findings in a run and add enhanced metadata
 * @param {Array} findings - Array of finding objects
 * @returns {Array} Enhanced findings with categories
 */
function categorizeAllFindings(findings) {
  if (!Array.isArray(findings)) return [];
  return findings.map(categorizeFinding);
}

/**
 * Get summary statistics for categorized findings
 */
function getCategorySummary(findings) {
  const enhanced = categorizeAllFindings(findings);
  const counts = {
    BLOCKING: enhanced.filter(f => f.category === 'BLOCKING').length,
    URGENT: enhanced.filter(f => f.category === 'URGENT').length,
    RECOMMENDED: enhanced.filter(f => f.category === 'RECOMMENDED').length,
    OPTIONAL: enhanced.filter(f => f.category === 'OPTIONAL').length,
  };
  
  const totalEstimatedMinutes = enhanced.reduce((sum, f) => {
    const mins = parseInt(f.effort) || 5;
    return sum + mins;
  }, 0);
  
  return {
    counts,
    total: enhanced.length,
    totalEstimatedTime: `${totalEstimatedMinutes} min`,
    blockingCount: counts.BLOCKING,
    criticalCount: counts.BLOCKING + counts.URGENT,
  };
}

module.exports = {
  categorizeFinding,
  categorizeAllFindings,
  getCategorySummary,
};
