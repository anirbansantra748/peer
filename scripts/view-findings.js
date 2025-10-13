#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const PRRun = require('../shared/models/PRRun');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Severity colors
  critical: '\x1b[41m\x1b[37m', // white on red
  high: '\x1b[31m', // red
  medium: '\x1b[33m', // yellow
  low: '\x1b[36m', // cyan
  
  // Other colors
  green: '\x1b[32m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function colorSeverity(severity) {
  const color = colors[severity] || colors.gray;
  return `${color}${severity.toUpperCase()}${colors.reset}`;
}

function formatFinding(finding, index) {
  const header = `\n${colors.bold}${index}. [${colorSeverity(finding.severity)}] ${finding.rule}${colors.reset}`;
  const location = `${colors.blue}${finding.file}:${finding.line}${finding.column ? `:${finding.column}` : ''}${colors.reset}`;
  const message = `${colors.gray}${finding.message}${colors.reset}`;
  
  let output = `${header}\n   ${location}\n   ${message}`;
  
  if (finding.codeSnippet) {
    output += `\n   ${colors.dim}Code: ${finding.codeSnippet}${colors.reset}`;
  }
  
  if (finding.suggestion) {
    output += `\n   ${colors.green}💡 ${finding.suggestion}${colors.reset}`;
  }

  if (finding.reason) {
    output += `\n   ${colors.gray}Why:${colors.reset} ${finding.reason}`;
  }

  if (Array.isArray(finding.cwe) && finding.cwe.length) {
    output += `\n   ${colors.gray}CWE:${colors.reset} ${finding.cwe.join(', ')}`;
  }
  if (Array.isArray(finding.owasp) && finding.owasp.length) {
    output += `\n   ${colors.gray}OWASP:${colors.reset} ${finding.owasp.join(', ')}`;
  }
  if (typeof finding.severityWeight === 'number') {
    output += `\n   ${colors.gray}Weight:${colors.reset} ${finding.severityWeight}`;
  }
  
  if (finding.example) {
    const lines = finding.example.split('\\n');
    output += `\n   ${colors.gray}Example:${colors.reset}`;
    lines.forEach(line => {
      output += `\n      ${line}`;
    });
  }

  if (finding.exampleDiff) {
    const lines = finding.exampleDiff.split('\\n');
    output += `\n   ${colors.gray}Diff:${colors.reset}`;
    lines.forEach(line => { output += `\n      ${line}`; });
  }
  
  return output;
}

async function viewFindings(runId) {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/peer');
    
    // Convert string to ObjectId if needed
    let prRun;
    try {
      prRun = await PRRun.findById(runId);
    } catch (e) {
      // If it fails, try finding by _id as string (in case of different storage)
      prRun = await PRRun.findOne({ _id: runId });
    }
    
    if (!prRun) {
      console.error(`${colors.high}Error: Run not found${colors.reset}`);
      process.exit(1);
    }
    
    console.log(`\n${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}PR Analysis Results${colors.reset}`);
    console.log(`${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.gray}Run ID:${colors.reset} ${prRun._id}`);
    console.log(`${colors.gray}Repo:${colors.reset} ${prRun.repo}`);
    console.log(`${colors.gray}PR:${colors.reset} #${prRun.prNumber}`);
    console.log(`${colors.gray}Status:${colors.reset} ${prRun.status}`);
    console.log(`${colors.gray}SHA:${colors.reset} ${prRun.sha}`);
    
    console.log(`\n${colors.bold}Summary:${colors.reset}`);
    console.log(`  Critical: ${colors.critical}${prRun.summary.critical}${colors.reset}`);
    console.log(`  High:     ${colors.high}${prRun.summary.high}${colors.reset}`);
    console.log(`  Medium:   ${colors.medium}${prRun.summary.medium}${colors.reset}`);
    console.log(`  Low:      ${colors.low}${prRun.summary.low}${colors.reset}`);
    console.log(`  Total:    ${colors.bold}${prRun.findings.length}${colors.reset}`);
    
    if (prRun.findings.length === 0) {
      console.log(`\n${colors.green}✓ No issues found!${colors.reset}\n`);
      process.exit(0);
    }
    
    // Group by severity
    const grouped = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    
    prRun.findings.forEach(f => {
      if (grouped[f.severity]) {
        grouped[f.severity].push(f);
      }
    });
    
    let findingIndex = 0;
    
    ['critical', 'high', 'medium', 'low'].forEach(severity => {
      if (grouped[severity].length > 0) {
        console.log(`\n${colors.bold}─────────────────────────────────────────────────────${colors.reset}`);
        console.log(`${colors.bold}${colorSeverity(severity)} Issues (${grouped[severity].length})${colors.reset}`);
        console.log(`${colors.bold}─────────────────────────────────────────────────────${colors.reset}`);
        
        grouped[severity].forEach(finding => {
          findingIndex++;
          console.log(formatFinding(finding, findingIndex));
        });
      }
    });
    
    console.log(`\n${colors.bold}═══════════════════════════════════════════════════════${colors.reset}\n`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error(`${colors.high}Error:${colors.reset}`, error.message);
    process.exit(1);
  }
}

const runId = process.argv[2];

if (!runId) {
  console.log(`${colors.bold}Usage:${colors.reset} node scripts/view-findings.js <runId>`);
  console.log(`${colors.gray}Example: node scripts/view-findings.js 68e216ff49ef037826d7bcf4${colors.reset}`);
  process.exit(1);
}

viewFindings(runId);
