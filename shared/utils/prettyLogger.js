// Simple ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const c = {
  gray: (str) => `${colors.gray}${str}${colors.reset}`,
  green: (str) => `${colors.green}${str}${colors.reset}`,
  yellow: (str) => `${colors.yellow}${str}${colors.reset}`,
  red: (str) => `${colors.red}${str}${colors.reset}`,
  cyan: (str) => `${colors.cyan}${str}${colors.reset}`,
  bold: (str) => `${colors.bold}${str}${colors.reset}`,
}

function timestamp() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour12: false });
}

function formatMeta(meta) {
  if (!meta || typeof meta !== 'object') return '';
  
  const parts = [];
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === 'object') {
      parts.push(`${key}=${JSON.stringify(value)}`);
    } else {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.length > 0 ? ` | ${parts.join(', ')}` : '';
}

module.exports = {
  info: (service, msg, meta) => {
    const metaStr = formatMeta(meta);
    console.log(`${c.gray(timestamp())} ${c.green('✓')} [${c.cyan(service)}] ${msg}${metaStr}`);
  },
  
  warn: (service, msg, meta) => {
    const metaStr = formatMeta(meta);
    console.log(`${c.gray(timestamp())} ${c.yellow('⚠')} [${c.cyan(service)}] ${msg}${metaStr}`);
  },
  
  error: (service, msg, meta) => {
    const metaStr = formatMeta(meta);
    console.error(`${c.gray(timestamp())} ${c.red('✗')} [${c.cyan(service)}] ${msg}${metaStr}`);
  },
  
  success: (service, msg, meta) => {
    const metaStr = formatMeta(meta);
    console.log(`${c.gray(timestamp())} ${c.green('✓')} [${c.cyan(service)}] ${c.bold(msg)}${metaStr}`);
  },
};
