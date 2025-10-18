class LLMUsageTracker {
  constructor() {
    this.enabled = process.env.TRACK_LLM_USAGE !== 'false';
    this.redis = null;
  }
  
  getRedis() {
    if (!this.redis) {
      const { connection } = require('../queue');
      this.redis = connection;
    }
    return this.redis;
  }

  /**
   * Track an LLM API call
   */
  async trackCall({ provider, model, tokens, cost = 0 }) {
    if (!this.enabled) return;
    
    const redis = this.getRedis();
    if (!redis) return;

    try {
      const now = Date.now();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Increment counters
      await redis.hincrby('llm:usage:total', 'calls', 1);
      await redis.hincrby('llm:usage:total', 'tokens', tokens || 0);
      if (cost > 0) {
        await redis.hincrbyfloat('llm:usage:total', 'cost', cost);
      }
      
      // Track by provider
      await redis.hincrby(`llm:usage:provider:${provider}`, 'calls', 1);
      await redis.hincrby(`llm:usage:provider:${provider}`, 'tokens', tokens || 0);
      
      // Track by model
      await redis.hincrby(`llm:usage:model:${model}`, 'calls', 1);
      await redis.hincrby(`llm:usage:model:${model}`, 'tokens', tokens || 0);
      
      // Track daily usage
      await redis.hincrby(`llm:usage:daily:${today}`, 'calls', 1);
      await redis.hincrby(`llm:usage:daily:${today}`, 'tokens', tokens || 0);
      await redis.expire(`llm:usage:daily:${today}`, 90 * 24 * 60 * 60); // Keep 90 days
      
      // Track last call
      await redis.hset('llm:usage:total', 'lastCall', now);
    } catch (error) {
      console.error('[UsageTracker] Failed to track call:', error);
    }
  }

  /**
   * Get total usage statistics
   */
  async getTotalUsage() {
    if (!this.enabled) {
      return { calls: 0, tokens: 0, cost: 0, lastCall: null };
    }
    
    const redis = this.getRedis();
    if (!redis) {
      return { calls: 0, tokens: 0, cost: 0, lastCall: null };
    }

    try {
      const data = await redis.hgetall('llm:usage:total');
      return {
        calls: parseInt(data.calls || 0),
        tokens: parseInt(data.tokens || 0),
        cost: parseFloat(data.cost || 0),
        lastCall: data.lastCall ? new Date(parseInt(data.lastCall)) : null
      };
    } catch (error) {
      console.error('[UsageTracker] Failed to get total usage:', error);
      return { calls: 0, tokens: 0, cost: 0, lastCall: null };
    }
  }

  /**
   * Get usage by provider
   */
  async getProviderUsage() {
    if (!this.enabled) return {};
    
    const redis = this.getRedis();
    if (!redis) return {};

    try {
      const providers = ['openai', 'openrouter', 'groq', 'deepseek', 'gemini', 'claude'];
      const usage = {};

      for (const provider of providers) {
        const data = await redis.hgetall(`llm:usage:provider:${provider}`);
        if (data && Object.keys(data).length > 0) {
          usage[provider] = {
            calls: parseInt(data.calls || 0),
            tokens: parseInt(data.tokens || 0)
          };
        }
      }

      return usage;
    } catch (error) {
      console.error('[UsageTracker] Failed to get provider usage:', error);
      return {};
    }
  }

  /**
   * Get daily usage for last N days
   */
  async getDailyUsage(days = 30) {
    if (!this.enabled) return [];
    
    const redis = this.getRedis();
    if (!redis) return [];

    try {
      const usage = [];
      const today = new Date();

      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];

        const data = await redis.hgetall(`llm:usage:daily:${dateKey}`);
        usage.push({
          date: dateKey,
          calls: parseInt(data.calls || 0),
          tokens: parseInt(data.tokens || 0)
        });
      }

      return usage.reverse();
    } catch (error) {
      console.error('[UsageTracker] Failed to get daily usage:', error);
      return [];
    }
  }

  /**
   * Reset usage statistics
   */
  async reset() {
    if (!this.enabled) return;
    
    const redis = this.getRedis();
    if (!redis) return;

    try {
      await redis.del('llm:usage:total');
      
      // Clean up provider keys
      const providers = ['openai', 'openrouter', 'groq', 'deepseek', 'gemini', 'claude'];
      for (const provider of providers) {
        await redis.del(`llm:usage:provider:${provider}`);
      }
      
      console.log('[UsageTracker] Usage statistics reset');
    } catch (error) {
      console.error('[UsageTracker] Failed to reset usage:', error);
    }
  }
}

module.exports = new LLMUsageTracker();
