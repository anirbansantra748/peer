const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'pr_created', 
      'auto_merge_complete', 
      'approval_needed', 
      'manual_selection_needed', 
      'fix_complete', 
      'fix_failed',
      'token_limit_exceeded',
      'api_error',
      'github_error',
      'installation_error',
      'error'
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  link: {
    type: String,
  },
  metadata: {
    repo: String,
    prNumber: Number,
    runId: String,
    patchRequestId: String,
    issuesCount: Number,
    fixedCount: Number,
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  emailSent: {
    type: Boolean,
    default: false,
  },
  emailSentAt: Date,
}, {
  timestamps: true,
});

// Index for efficient queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

// Static method to create and optionally send email
notificationSchema.statics.createNotification = async function(data) {
  const notification = await this.create(data);
  
  // Send email if user has email notifications enabled
  if (data.sendEmail) {
    try {
      const User = require('./User');
      
      const user = await User.findById(data.userId);
      
      // Map notification types to user preference keys
      const typeMap = {
        'pr_created': 'prCreated',
        'auto_merge_complete': 'autoMergeComplete',
        'approval_needed': 'approvalNeeded',
        'manual_selection_needed': 'issueSelectionNeeded'
      };
      
      const prefKey = typeMap[data.type];
      const emailEnabled = user?.notifications?.email?.[prefKey];
      
      if (user && (user.notificationEmail || user.email) && emailEnabled !== false) {
        // Lazy load emailService to avoid initialization issues
        const emailService = require('../services/emailService');
        
        // Check if emailService is properly initialized
        if (typeof emailService.sendNotificationEmail !== 'function') {
          console.error('[Notification] EmailService not properly initialized');
          return notification;
        }
        
        try {
          await emailService.sendNotificationEmail(user, notification);
          notification.emailSent = true;
          notification.emailSentAt = new Date();
          await notification.save();
        } catch (emailError) {
          console.error('[Notification] Failed to send email:', emailError.message, emailError.stack);
        }
      }
    } catch (error) {
      console.error('[Notification] Error in notification creation:', error.message, error.stack);
    }
  }
  
  return notification;
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.read = true;
  return await this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
