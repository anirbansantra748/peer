require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../shared/models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const user = await User.findOne().sort({ lastLogin: -1 });
  console.log('\n=== CURRENT USER TOKENS ===');
  console.log('Username:', user.username);
  console.log('Tier:', user.subscriptionTier);
  console.log('Tokens Used:', user.tokensUsed);
  console.log('Purchased Tokens:', user.purchasedTokens || 0);
  console.log('Token Limit:', user.tokenLimit);
  console.log('===========================\n');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
