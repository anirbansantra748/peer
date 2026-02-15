require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../shared/models/User');
const logger = require('../shared/utils/prettyLogger');

/**
 * Monthly token reset job
 * Resets tokensUsed for users whose tokenResetDate has passed
 */
async function resetMonthlyTokens() {
  const shouldDisconnect = mongoose.connection.readyState !== 1;
  
  try {
    // Only connect if not already connected
    if (shouldDisconnect) {
      await mongoose.connect(process.env.MONGO_URI);
      logger.info('cron', 'Connected to MongoDB for token reset');
    }

    const now = new Date();
    
    // Find users whose token reset date has passed
    const usersToReset = await User.find({
      tokenResetDate: { $lte: now },
      subscriptionTier: 'free' // Only reset free tier users
    });

    logger.info('cron', 'Found users to reset', { count: usersToReset.length });

    let resetCount = 0;
    for (const user of usersToReset) {
      const oldUsage = user.tokensUsed;
      
      // Reset tokens used to 0
      user.tokensUsed = 0;
      
      // Set next reset date to first day of next month
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      user.tokenResetDate = nextReset;
      
      await user.save();
      resetCount++;
      
      logger.info('cron', 'Reset user tokens', {
        userId: user._id,
        username: user.username,
        oldUsage,
        newUsage: 0,
        nextResetDate: nextReset.toISOString()
      });
    }

    logger.info('cron', 'Token reset completed', { 
      totalReset: resetCount,
      timestamp: new Date().toISOString()
    });

    // Only disconnect if we connected in this function
    if (shouldDisconnect) {
      await mongoose.disconnect();
      process.exit(0);
    }
  } catch (error) {
    logger.error('cron', 'Token reset failed', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  resetMonthlyTokens();
}

module.exports = resetMonthlyTokens;
