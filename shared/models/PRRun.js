const mongoose = require('mongoose');

// Schema for individual findings
const findingSchema = new mongoose.Schema({
  file: {
    type: String,
    required: true,
  },
  line: {
    type: Number,
    required: true,
  },
  rule: {
    type: String,
    required: true,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    enum: [
      'static-analysis', 
      'dependency-scan', 
      'iac-scan', 
      'llm-analysis', 
      'style-analyzer', 
      'logic-analyzer', 
      'security-analyzer', 
      'improvement-analyzer', 
      'html-analyzer', 
      'css-analyzer', 
      'universal-analyzer',
      // New multi-language analyzers
      'java-analyzer',
      'python-analyzer',
      'typescript-analyzer',
      'sql-analyzer',
      'docker-analyzer',
      // New analyzers
      'maintainability-analyzer',
      'license-analyzer',
      // External tools
      'eslint',
      'pylint',
      'bandit',
      'pmd',
      'semgrep',
      'hadolint',
      'checkov',
      // Complexity/Performance/SCA
      'complexity-analyzer',
      'performance-analyzer',
      'npm-audit',
      'pip-audit',
      'safety',
      'snyk',
      'trivy',
    ],
    required: true,
  },
  suggestion: {
    type: String,
  },
  example: {
    type: String,
  },
  codeSnippet: {
    type: String,
  },
  column: {
    type: Number,
  },
  // Enriched structured fields (optional)
  reason: {
    type: String,
  },
  fix: {
    type: String,
  },
  exampleDiff: {
    type: String,
  },
  cwe: [{ type: String }],
  owasp: [{ type: String }],
  severityWeight: {
    type: Number,
  },
  // Autofix state
  fixed: { type: Boolean, default: false },
  fixedAt: { type: Date },
  fixedByPatchRequestId: { type: String },
}, { _id: true }); // Enable _id for findings so we can track individual findings

// Schema for summary counts by severity
const summarySchema = new mongoose.Schema({
  low: {
    type: Number,
    default: 0,
  },
  medium: {
    type: Number,
    default: 0,
  },
  high: {
    type: Number,
    default: 0,
  },
  critical: {
    type: Number,
    default: 0,
  },
}, { _id: false });

// Main PRRun schema
const prRunSchema = new mongoose.Schema({
  repo: {
    type: String,
    required: true,
    index: true,
  },
  prNumber: {
    type: Number,
    required: true,
    index: true,
  },
  sha: {
    type: String,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed'],
    default: 'queued',
    index: true,
  },
  // Reference to GitHub App installation (optional for backwards compatibility)
  installationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Installation',
    index: true,
  },
  findings: [findingSchema],
  summary: {
    type: summarySchema,
    default: () => ({ low: 0, medium: 0, high: 0, critical: 0 }),
  },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
});

// Compound index for efficient queries
prRunSchema.index({ repo: 1, prNumber: 1, sha: 1 }, { unique: true });

// Instance method to update summary counts based on findings
prRunSchema.methods.updateSummary = function() {
  const summary = { low: 0, medium: 0, high: 0, critical: 0 };
  
  this.findings.forEach(finding => {
    if (summary[finding.severity] !== undefined) {
      summary[finding.severity]++;
    }
  });
  
  this.summary = summary;
  return this;
};

// Static method to find runs by repo and PR number
prRunSchema.statics.findByRepoPR = function(repo, prNumber) {
  return this.find({ repo, prNumber }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('PRRun', prRunSchema);