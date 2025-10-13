#!/usr/bin/env node
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function checkService(name, command) {
  try {
    const { stdout } = await execAsync(command);
    return { name, status: 'running', details: stdout.trim() };
  } catch (error) {
    return { name, status: 'not running', details: error.message };
  }
}

function checkHTTP(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve({ status: 'ok', code: res.statusCode });
    });
    req.on('error', (err) => {
      resolve({ status: 'error', message: err.message });
    });
    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ status: 'timeout', message: 'Request timed out' });
    });
  });
}

async function main() {
  console.log(`\n${colors.bold}🔍 Checking Service Status...${colors.reset}\n`);

  // Check MongoDB
  console.log(`${colors.cyan}1. MongoDB (port 27017)${colors.reset}`);
  try {
    const { stdout } = await execAsync('netstat -an | findstr :27017');
    if (stdout.includes('LISTENING')) {
      console.log(`   ${colors.green}✓ Running${colors.reset}`);
    } else {
      console.log(`   ${colors.yellow}⚠ Port open but not listening${colors.reset}`);
    }
  } catch {
    console.log(`   ${colors.red}✗ Not running${colors.reset}`);
    console.log(`   ${colors.yellow}   Start with: net start MongoDB${colors.reset}`);
  }

  // Check Redis
  console.log(`\n${colors.cyan}2. Redis (port 6379)${colors.reset}`);
  try {
    const { stdout } = await execAsync('netstat -an | findstr :6379');
    if (stdout.includes('LISTENING')) {
      console.log(`   ${colors.green}✓ Running${colors.reset}`);
    } else {
      console.log(`   ${colors.yellow}⚠ Port open but not listening${colors.reset}`);
    }
  } catch {
    console.log(`   ${colors.red}✗ Not running${colors.reset}`);
    console.log(`   ${colors.yellow}   Start Redis first!${colors.reset}`);
  }

  // Check API Server
  console.log(`\n${colors.cyan}3. API Server (port 3001)${colors.reset}`);
  const apiResult = await checkHTTP('http://localhost:3001/health');
  if (apiResult.status === 'ok') {
    console.log(`   ${colors.green}✓ Running${colors.reset}`);
    console.log(`   ${colors.green}   Health check: OK (${apiResult.code})${colors.reset}`);
  } else {
    console.log(`   ${colors.red}✗ Not responding${colors.reset}`);
    console.log(`   ${colors.yellow}   Start with: npm run dev:api${colors.reset}`);
  }

  // Check if Worker is running
  console.log(`\n${colors.cyan}4. Analyzer Worker${colors.reset}`);
  try {
    const { stdout } = await execAsync('tasklist | findstr node.exe');
    const nodeProcesses = stdout.split('\n').filter(line => line.includes('node.exe'));
    if (nodeProcesses.length > 0) {
      console.log(`   ${colors.green}✓ Node processes running (${nodeProcesses.length})${colors.reset}`);
      console.log(`   ${colors.yellow}   Check logs to confirm worker is active${colors.reset}`);
    } else {
      console.log(`   ${colors.red}✗ No Node processes found${colors.reset}`);
      console.log(`   ${colors.yellow}   Start with: npm run dev:analyzer${colors.reset}`);
    }
  } catch {
    console.log(`   ${colors.red}✗ Could not check processes${colors.reset}`);
  }

  console.log(`\n${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}📝 Summary${colors.reset}\n`);
  console.log(`${colors.yellow}⚠ IMPORTANT: If you made code changes, you MUST restart services!${colors.reset}\n`);
  console.log(`To restart:`);
  console.log(`  1. Stop API: Press Ctrl+C in the API terminal`);
  console.log(`  2. Stop Worker: Press Ctrl+C in the Worker terminal`);
  console.log(`  3. Start API: npm run dev:api`);
  console.log(`  4. Start Worker: npm run dev:analyzer`);
  console.log(`\n${colors.bold}═══════════════════════════════════════════════════════${colors.reset}\n`);
}

main().catch(console.error);
