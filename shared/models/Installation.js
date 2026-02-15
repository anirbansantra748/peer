const mongoose = require('mongoose');

const installationSchema = new mongoose.Schema({
  // GitHub App installation ID
  installationId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  // User who installed the app (optional - linked after OAuth login)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  },
  // GitHub account info
  accountId: {
    type: Number,
    required: true,
    index: true,
  },
  accountLogin: {
    type: String,
    required: true,
    index: true,
  },
  accountType: {
    type: String,
    enum: ['User', 'Organization'],
    required: true,
  },
  accountAvatarUrl: String,
  // Repository selection type
  repositorySelection: {
    type: String,
    enum: ['all', 'selected'],
    required: true,
  },
  // List of repositories this installation has access to
  repositories: [{
    id: Number,
    name: String,
    fullName: String,
    private: Boolean,
    url: String,
  }],
  // Installation status
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active',
  },
  // Configuration per installation
  config: {
    // Auto-processing mode
    mode: {
      type: String,
      enum: ['analyze', 'commit', 'merge', 'review'],
      default: 'analyze', // Just analyze and comment, don't auto-commit
      // 'review' = show findings in UI, user manually selects which to fix
    },
    // Which severity levels to auto-fix
    severities: {
      type: [String],
      default: ['critical', 'high'],
      enum: ['critical', 'high', 'medium', 'low'],
    },
    // Maximum files to process per run
    maxFilesPerRun: {
      type: Number,
      default: 10,
      min: 1,
      max: 50,
    },
    // Auto-merge settings
    autoMerge: {
      enabled: {
        type: Boolean,
        default: false,
      },
      requireTests: {
        type: Boolean,
        default: true,
      },
      requireReviews: {
        type: Number,
        default: 0,
      },
    },
  },
  // API keys specific to this installation (optional - falls back to user keys)
  apiKeys: {
    groq: String,
    gemini: String,
    openrouter: String,
  },
  // Permissions granted
  permissions: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Events subscribed
  events: {
    type: [String],
    default: [],
  },
  // Installation metadata
  installedAt: {
    type: Date,
    default: Date.now,
  },
  suspendedAt: Date,
  deletedAt: Date,
}, {
  timestamps: true,
});

// Indexes (installationId already has unique: true and index: true)
installationSchema.index({ userId: 1, status: 1 });
installationSchema.index({ accountLogin: 1 });

// Instance method to check if repository is included
installationSchema.methods.hasRepository = function(repoFullName) {
  return this.repositories.some(r => r.fullName === repoFullName);
};

// Instance method to get safe config data
installationSchema.methods.getSafeConfig = function() {
  return {
    mode: this.config.mode,
    severities: this.config.severities,
    maxFilesPerRun: this.config.maxFilesPerRun,
    autoMerge: {
      enabled: this.config.autoMerge.enabled,
      requireTests: this.config.autoMerge.requireTests,
      requireReviews: this.config.autoMerge.requireReviews,
    },
  };
};

// Static method to find active installations for a user
installationSchema.statics.findActiveByUser = function(userId) {
  return this.find({ userId, status: 'active' }).sort({ installedAt: -1 });
};

// Static method to find installation by GitHub installation ID
installationSchema.statics.findByInstallationId = function(installationId) {
  return this.findOne({ installationId, status: 'active' });
};

module.exports = mongoose.model('Installation', installationSchema);
