const crypto = require('crypto');
const { connection: redis } = require('../queue');
const logger = require('../utils/prettyLogger');

/**
 * LLM Response Cache using Redis
 * Cache key = hash(file_content + errors + model)
 * TTL = 24 hours (configurable)
 */

const CACHE_PREFIX = 'llm:cache:';
const CACHE_TTL = parseInt(process.env.LLM_CACHE_TTL || '86400', 10); // 24 hours default
const CACHE_ENABLED = process.env.LLM_CACHE_ENABLED !== '0';

// Cache statistics
let stats = {
  hits: 0,
  misses: 0,
  saves: 0,
  errors: 0
};

/**
 * Generate cache key from code and findings
 */
function generateCacheKey(file, code, findings, model) {
  const findingsStr = JSON.stringify(findings.map(f => ({
    rule: f.rule,
    severity: f.severity,
    line: f.line,
    message: f.message
  })).sort((a, b) => a.line - b.line));
  
  const dataToHash = `${file}:${code}:${findingsStr}:${model}`;
  return CACHE_PREFIX + crypto.createHash('sha256').update(dataToHash).digest('hex');
}

/**
 * Get cached AI response
 */
async function get(file, code, findings, model) {
  if (!CACHE_ENABLED) return null;
  
  try {
    const key = generateCacheKey(file, code, findings, model);
    const cached = await redis.get(key);
    
    if (cached) {
      stats.hits++;
      const data = JSON.parse(cached);
      logger.info('cache', 'Cache HIT', { 
        file, 
        model, 
        hitRate: `${((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)}%` 
      });
      return data;
    }
    
    stats.misses++;
    return null;
  } catch (error) {
    stats.errors++;
    logger.warn('cache', 'Cache get error', { error: String(error.message) });
    return null;
  }
}

/**
 * Save AI response to cache
 */
async function set(file, code, findings, model, response) {
  if (!CACHE_ENABLED) return;
  
  try {
    const key = generateCacheKey(file, code, findings, model);
    const data = {
      text: response.text,
      modelUsed: response.modelUsed,
      provider: response.provider,
      responseTime: response.responseTime,
      timestamp: Date.now(),
      cachedAt: new Date().toISOString()
    };
    
    await redis.setex(key, CACHE_TTL, JSON.stringify(data));
    stats.saves++;
    
    logger.info('cache', 'Cache SAVE', { 
      file, 
      model, 
      ttl: `${CACHE_TTL}s`,
      size: `${JSON.stringify(data).length} bytes`
    });
  } catch (error) {
    stats.errors++;
    logger.warn('cache', 'Cache set error', { error: String(error.message) });
  }
}

/**
 * Clear all cache
 */
async function clear() {
  try {
    const keys = await redis.keys(`${CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info('cache', 'Cache cleared', { keysDeleted: keys.length });
    }
    return keys.length;
  } catch (error) {
    logger.error('cache', 'Cache clear error', { error: String(error.message) });
    return 0;
  }
}

/**
 * Get cache statistics
 */
function getStats() {
  const total = stats.hits + stats.misses;
  return {
    ...stats,
    hitRate: total > 0 ? ((stats.hits / total) * 100).toFixed(2) + '%' : '0%',
    missRate: total > 0 ? ((stats.misses / total) * 100).toFixed(2) + '%' : '0%',
    total,
    enabled: CACHE_ENABLED,
    ttl: CACHE_TTL
  };
}

/**
 * Reset statistics
 */
function resetStats() {
  stats = { hits: 0, misses: 0, saves: 0, errors: 0 };
}

module.exports = {
  get,
  set,
  clear,
  getStats,
  resetStats,
  generateCacheKey
};
