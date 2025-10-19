#!/usr/bin/env node

/**
 * Test script to verify token tracking is working correctly
 * 
 * Usage:
 *   node scripts/testTokenTracking.js <githubUsername>
 * 
 * Example:
 *   node scripts/testTokenTracking.js anirbansantra748
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function testTokenTracking() {
  const username = process.argv[2];
  
  if (!username) {
    console.error('Usage: node scripts/testTokenTracking.js <githubUsername>');
    process.exit(1);
  }

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/peer-review';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Load models
    const User = require('../shared/models/User');
    const { incrementUserTokens, getUserTokenStats } = require('../shared/utils/userTokens');

    // Find user
    const user = await User.findOne({ githubUsername: username });
    if (!user) {
      console.error(`✗ User not found: ${username}`);
      process.exit(1);
    }

    console.log('\n📊 Current User Stats:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`User ID: ${user._id}`);
    console.log(`GitHub Username: ${user.githubUsername}`);
    console.log(`Subscription Tier: ${user.subscriptionTier || 'free'}`);
    console.log(`Token Limit: ${user.tokenLimit || 1000}`);
    console.log(`Tokens Used: ${user.tokensUsed || 0}`);
    
    const hasGroqKey = !!(user.apiKeys?.groq);
    const hasGeminiKey = !!(user.apiKeys?.gemini);
    console.log(`Has Groq API Key: ${hasGroqKey}`);
    console.log(`Has Gemini API Key: ${hasGeminiKey}`);
    
    // Test token increment
    console.log('\n🧪 Testing Token Increment...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Adding 100 test tokens...');
    
    await incrementUserTokens(user._id, 100);
    
    // Fetch updated stats
    const stats = await getUserTokenStats(user._id);
    
    console.log('\n✅ Updated Stats:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Tokens Used: ${stats.tokensUsed}`);
    console.log(`Token Limit: ${stats.tokenLimit}`);
    console.log(`Percentage: ${stats.percentage}%`);
    console.log(`Remaining: ${stats.remaining}`);
    console.log(`Subscription Tier: ${stats.subscriptionTier}`);
    console.log(`Has Own Keys: ${stats.hasOwnKeys}`);
    console.log(`Unlimited: ${stats.unlimited}`);
    
    console.log('\n✅ Token tracking test completed successfully!');
    console.log('\n💡 Next Steps:');
    console.log('1. Open dashboard: http://localhost:3000/');
    console.log('2. Check the AI Usage widget');
    console.log('3. Trigger a PR analysis to see real token tracking');
    console.log('4. Enable LLM_DEBUG=1 in .env to see detailed logs');
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

testTokenTracking();
