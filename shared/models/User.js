const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  githubId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  username: {
    type: String,
    required: true,
  },
  displayName: {
    type: String,
  },
  email: {
    type: String,
  },
  avatar: {
    type: String,
  },
  // Encrypted GitHub access token
  accessToken: {
    type: String,
    required: true,
  },
  // GitHub profile URL
  profileUrl: {
    type: String,
  },
  // Last login timestamp
  lastLogin: {
    type: Date,
    default: Date.now,
  },
  // Onboarding completion flag
  onboardingComplete: {
    type: Boolean,
    default: false,
  },
  // Token usage tracking
  tokensUsed: {
    type: Number,
    default: 0,
  },
  tokenLimit: {
    type: Number,
    default: 1000, // Free tier: 1000 tokens/month
  },
  // Monthly token reset date (for free tier)
  tokenResetDate: {
    type: Date,
    default: function() {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 1); // First day of next month
    },
  },
  // Purchased token credits (Pro tier - doesn't expire)
  purchasedTokens: {
    type: Number,
    default: 0,
  },
  // User's own API keys (encrypted)
  apiKeys: {
    groq: String,
    gemini: String,
  },
  // Subscription tier
  subscriptionTier: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free',
  },
  subscriptionExpiry: Date,
  subscriptionStatus: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active',
  },
  // Notification preferences
  notificationEmail: {
    type: String, // Separate from GitHub email, user can override
  },
  notifications: {
    email: {
      prCreated: { type: Boolean, default: true },
      autoMergeComplete: { type: Boolean, default: true },
      approvalNeeded: { type: Boolean, default: true },
      issueSelectionNeeded: { type: Boolean, default: true },
    },
    toast: {
      prCreated: { type: Boolean, default: true },
      autoMergeComplete: { type: Boolean, default: true },
      approvalNeeded: { type: Boolean, default: true },
      issueSelectionNeeded: { type: Boolean, default: true },
    },
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

// Index for faster lookups
userSchema.index({ githubId: 1 });
userSchema.index({ username: 1 });

// Instance method to get safe user data (without sensitive fields)
userSchema.methods.toSafeObject = function() {
  return {
    id: this._id,
    githubId: this.githubId,
    username: this.username,
    displayName: this.displayName,
    email: this.email,
    avatar: this.avatar,
    profileUrl: this.profileUrl,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
};

// Static method to find or create user from GitHub profile
userSchema.statics.findOrCreateFromGitHub = async function(profile, accessToken) {
  const { encrypt } = require('../utils/encryption');
  
  const githubId = profile.id;
  const userData = {
    githubId: String(githubId),
    username: profile.username,
    displayName: profile.displayName || profile.username,
    email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
    avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
    profileUrl: profile.profileUrl,
    accessToken: encrypt(accessToken),
    lastLogin: new Date(),
  };

  // Find existing user or create new
  let user = await this.findOne({ githubId: String(githubId) });
  
  if (user) {
    // Update existing user
    Object.assign(user, userData);
    await user.save();
  } else {
    // Create new user
    user = await this.create(userData);
  }
  
  return user;
};

module.exports = mongoose.model('User', userSchema);
