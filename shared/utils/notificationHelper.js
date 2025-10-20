const Notification = require('../models/Notification');
const logger = require('./prettyLogger');

/**
 * Create a notification for a user
 */
async function createNotification({ userId, type, title, message, link, metadata, sendEmail = true }) {
  try {
    const notification = await Notification.createNotification({
      userId,
      type,
      title,
      message,
      link,
      metadata,
      sendEmail
    });

    logger.info('notification', 'Notification created', {
      userId,
      type,
      notificationId: notification._id,
      emailSent: notification.emailSent
    });

    return notification;
  } catch (error) {
    logger.error('notification', 'Failed to create notification', {
      userId,
      type,
      error: String(error)
    });
    return null;
  }
}

/**
 * Create PR analyzed notification
 */
async function notifyPRAnalyzed({ userId, repo, prNumber, runId, issuesCount, mode }) {
  let type, title, message;

  if (mode === 'review') {
    // Mode 2: Manual selection
    type = 'manual_selection_needed';
    title = `🎯 Select issues to fix`;
    message = `PR #${prNumber} in ${repo} has ${issuesCount} issues. Choose which ones to fix.`;
  } else {
    // Mode 0 or 1: Auto-processing
    type = 'pr_created';
    title = `📝 PR #${prNumber} analyzed`;
    message = `Found ${issuesCount} issues in ${repo}. Automated fixes are being applied.`;
  }

  return await createNotification({
    userId,
    type,
    title,
    message,
    link: mode === 'review' ? `/runs/${runId}/select` : `/pr/${runId}`,
    metadata: {
      repo,
      prNumber,
      runId,
      issuesCount
    }
  });
}

/**
 * Create auto-merge complete notification
 */
async function notifyAutoMergeComplete({ userId, repo, prNumber, runId, fixedCount, fixPrNumber, fixPrUrl }) {
  return await createNotification({
    userId,
    type: 'auto_merge_complete',
    title: `✅ Auto-merge completed`,
    message: `${fixedCount} issues fixed and merged in ${repo} PR #${prNumber}`,
    link: fixPrUrl || `/pr/${runId}`,
    metadata: {
      repo,
      prNumber,
      runId,
      fixedCount,
      fixPrNumber,
      fixPrUrl
    }
  });
}

/**
 * Create approval needed notification
 */
async function notifyApprovalNeeded({ userId, repo, prNumber, runId, fixedCount, fixPrNumber, fixPrUrl }) {
  return await createNotification({
    userId,
    type: 'approval_needed',
    title: `👀 Approval needed`,
    message: `${fixedCount} fixes ready for ${repo} PR #${prNumber}. Please approve to merge.`,
    link: fixPrUrl || `/pr/${runId}`,
    metadata: {
      repo,
      prNumber,
      runId,
      fixedCount,
      fixPrNumber,
      fixPrUrl
    }
  });
}

/**
 * Create fix complete notification
 */
async function notifyFixComplete({ userId, repo, prNumber, runId, fixedCount }) {
  return await createNotification({
    userId,
    type: 'fix_complete',
    title: `✅ Fixes applied`,
    message: `${fixedCount} issues fixed in ${repo} PR #${prNumber}`,
    link: `/pr/${runId}`,
    metadata: {
      repo,
      prNumber,
      runId,
      fixedCount
    }
  });
}

/**
 * Create fix failed notification
 */
async function notifyFixFailed({ userId, repo, prNumber, runId, reason }) {
  return await createNotification({
    userId,
    type: 'fix_failed',
    title: `❌ Fix failed`,
    message: `Failed to apply fixes to ${repo} PR #${prNumber}: ${reason}`,
    link: `/pr/${runId}`,
    metadata: {
      repo,
      prNumber,
      runId
    }
  });
}

module.exports = {
  createNotification,
  notifyPRAnalyzed,
  notifyAutoMergeComplete,
  notifyApprovalNeeded,
  notifyFixComplete,
  notifyFixFailed
};
