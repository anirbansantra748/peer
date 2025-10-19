const User = require('../models/User');
const { decrypt } = require('./encryption');

/**
 * Check if user has enough tokens for a request
 * @param {Object} user - User document from MongoDB
 * @param {number} estimatedTokens - Estimated tokens for this request
 * @returns {Object} { allowed: boolean, reason: string }
 */
async function checkUserTokenLimit(user, estimatedTokens = 0) {
  if (!user) {
    return { allowed: false, reason: 'No user provided' };
  }

  const tokensUsed = user.tokensUsed || 0;
  const tokenLimit = user.tokenLimit || 1000;

  // Unlimited tokens (Enterprise plan)
  if (tokenLimit === -1) {
    return { allowed: true, reason: 'Unlimited tokens' };
  }

  // User has their own API keys, bypass platform limits
  if (user.apiKeys?.groq || user.apiKeys?.gemini) {
    return { allowed: true, reason: 'Using own API keys', useUserKeys: true };
  }

  // Check if within limit
  if (tokensUsed + estimatedTokens <= tokenLimit) {
    return { allowed: true, remaining: tokenLimit - tokensUsed };
  }

  return { 
    allowed: false, 
    reason: `Token limit exceeded (${tokensUsed}/${tokenLimit})`,
    needsUpgrade: true
  };
}

/**
 * Increment user's token usage
 * @param {string} userId - User ID
 * @param {number} tokens - Number of tokens used
 */
async function incrementUserTokens(userId, tokens) {
  if (!userId || !tokens || tokens <= 0) {
    console.log('[UserTokens] Skipping increment:', { userId: !!userId, tokens });
    return;
  }

  try {
    console.log('[UserTokens] Incrementing tokens:', { userId, tokens });
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { tokensUsed: tokens } },
      { new: true }
    );
    console.log('[UserTokens] Tokens incremented successfully:', { 
      userId, 
      tokensAdded: tokens, 
      newTotal: updatedUser?.tokensUsed,
      limit: updatedUser?.tokenLimit
    });
  } catch (error) {
    console.error('[UserTokens] Failed to increment tokens:', error);
  }
}

/**
 * Get user's decrypted API keys
 * @param {Object} user - User document
 * @returns {Object} { groq: string|null, gemini: string|null }
 */
function getUserApiKeys(user) {
  if (!user || !user.apiKeys) {
    return { groq: null, gemini: null };
  }

  try {
    return {
      groq: user.apiKeys.groq ? decrypt(user.apiKeys.groq) : null,
      gemini: user.apiKeys.gemini ? decrypt(user.apiKeys.gemini) : null,
    };
  } catch (error) {
    console.error('[UserTokens] Failed to decrypt API keys:', error);
    return { groq: null, gemini: null };
  }
}

/**
 * Get user's current token usage stats
 * @param {string} userId - User ID
 * @returns {Object} Usage statistics
 */
async function getUserTokenStats(userId) {
  if (!userId) {
    return { tokensUsed: 0, tokenLimit: 1000, percentage: 0 };
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return { tokensUsed: 0, tokenLimit: 1000, percentage: 0 };
    }

    const tokensUsed = user.tokensUsed || 0;
    const tokenLimit = user.tokenLimit || 1000;
    const hasOwnKeys = !!(user.apiKeys?.groq || user.apiKeys?.gemini);
    
    // Calculate percentage
    let percentage = 0;
    if (tokenLimit > 0) {
      percentage = Math.min(100, Math.round((tokensUsed / tokenLimit) * 100));
    }

    return {
      tokensUsed,
      tokenLimit,
      percentage,
      remaining: tokenLimit === -1 ? 'Unlimited' : Math.max(0, tokenLimit - tokensUsed),
      subscriptionTier: user.subscriptionTier || 'free',
      hasOwnKeys,
      unlimited: tokenLimit === -1,
    };
  } catch (error) {
    console.error('[UserTokens] Failed to get user stats:', error);
    return { tokensUsed: 0, tokenLimit: 1000, percentage: 0 };
  }
}

/**
 * Reset user's token usage (for new billing period)
 * @param {string} userId - User ID
 */
async function resetUserTokens(userId) {
  if (!userId) return;

  try {
    await User.findByIdAndUpdate(
      userId,
      { tokensUsed: 0 },
      { new: true }
    );
  } catch (error) {
    console.error('[UserTokens] Failed to reset tokens:', error);
  }
}

module.exports = {
  checkUserTokenLimit,
  incrementUserTokens,
  getUserApiKeys,
  getUserTokenStats,
  resetUserTokens,
};
