const util = require('util');

function ts() {
  return new Date().toISOString();
}

function base(level, service, msg, meta) {
  const rec = {
    t: ts(),
    level,
    service,
    msg,
    ...(meta && typeof meta === 'object' ? { meta } : {}),
  };
  // Compact JSON log line
  console.log(JSON.stringify(rec));
}

module.exports = {
  info: (service, msg, meta) => base('info', service, msg, meta),
  warn: (service, msg, meta) => base('warn', service, msg, meta),
  error: (service, msg, meta) => base('error', service, msg, meta),
};
