const Notification = require('../models/Notification');
const logger = require('./prettyLogger');

/**
 * Create a notification for an error that occurred
 * @param {Object} options - Notification options
 * @param {string} options.userId - User ID to notify
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {string} options.type - Notification type
 * @param {string} options.link - Optional link for the notification
 * @param {Object} options.metadata - Optional metadata
 * @param {boolean} options.sendEmail - Whether to send an email
 */
async function notifyUserError(options) {
  const {
    userId,
    title,
    message,
    type = 'error',
    link = null,
    metadata = {},
    sendEmail = false,
  } = options;

  if (!userId) {
    logger.warn('errorNotification', 'Cannot send notification: no userId provided');
    return null;
  }

  try {
    const notification = await Notification.createNotification({
      userId,
      type,
      title,
      message,
      link,
      metadata,
      sendEmail,
    });

    logger.info('errorNotification', 'Error notification created', {
      userId,
      type,
      title,
    });

    return notification;
  } catch (error) {
    logger.error('errorNotification', 'Failed to create error notification', {
      error: error.message,
      userId,
    });
    return null;
  }
}

/**
 * Notify user that their token limit has been exceeded
 * @param {string} userId - User ID
 * @param {number} tokensUsed - Current tokens used
 * @param {number} tokenLimit - Token limit
 */
async function notifyTokenLimitExceeded(userId, tokensUsed, tokenLimit) {
  return notifyUserError({
    userId,
    type: 'token_limit_exceeded',
    title: '⚠️ Token Limit Reached',
    message: `You've used ${tokensUsed} of ${tokenLimit} tokens. Add your own API keys to continue using Peer without limits, or upgrade your plan.`,
    link: '/settings/api-keys',
    metadata: {
      tokensUsed,
      tokenLimit,
    },
    sendEmail: true,
  });
}

/**
 * Notify user about a general API error
 * @param {string} userId - User ID
 * @param {string} operation - Operation that failed
 * @param {string} errorMessage - Error message
 * @param {string} link - Optional link
 */
async function notifyApiError(userId, operation, errorMessage, link = null) {
  return notifyUserError({
    userId,
    type: 'api_error',
    title: `❌ ${operation} Failed`,
    message: errorMessage,
    link,
    metadata: {
      operation,
      errorMessage,
    },
    sendEmail: false,
  });
}

/**
 * Notify user about a GitHub API error
 * @param {string} userId - User ID
 * @param {string} repo - Repository name
 * @param {string} errorMessage - Error message
 */
async function notifyGitHubError(userId, repo, errorMessage) {
  return notifyUserError({
    userId,
    type: 'github_error',
    title: '❌ GitHub API Error',
    message: `Failed to interact with ${repo}: ${errorMessage}`,
    link: null,
    metadata: {
      repo,
      errorMessage,
    },
    sendEmail: false,
  });
}

/**
 * Notify user about an installation error
 * @param {string} userId - User ID
 * @param {string} errorMessage - Error message
 */
async function notifyInstallationError(userId, errorMessage) {
  return notifyUserError({
    userId,
    type: 'installation_error',
    title: '❌ Installation Error',
    message: errorMessage,
    link: '/installations',
    metadata: {
      errorMessage,
    },
    sendEmail: false,
  });
}

module.exports = {
  notifyUserError,
  notifyTokenLimitExceeded,
  notifyApiError,
  notifyGitHubError,
  notifyInstallationError,
};
