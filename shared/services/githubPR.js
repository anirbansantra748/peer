const { Octokit } = require('@octokit/rest');
const logger = require('../utils/prettyLogger');

/**
 * Create GitHub API client
 */
function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN not configured');
  }
  return new Octokit({ auth: token });
}

/**
 * Create a Pull Request
 * @param {Object} params
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.head - Branch with changes
 * @param {string} params.base - Target branch (usually 'main' or 'master')
 * @param {string} params.title - PR title
 * @param {string} params.body - PR description
 */
async function createPullRequest({ owner, repo, head, base, title, body }) {
  const octokit = getOctokit();

  try {
    logger.info('githubPR', 'Creating pull request', { owner, repo, head, base });

    const response = await octokit.pulls.create({
      owner,
      repo,
      title,
      head,
      base,
      body: body || '',
    });

    logger.info('githubPR', 'Pull request created', {
      prNumber: response.data.number,
      url: response.data.html_url,
    });

    return {
      prNumber: response.data.number,
      url: response.data.html_url,
      nodeId: response.data.node_id,
    };
  } catch (error) {
    if (error.status === 422 && error.message.includes('A pull request already exists')) {
      logger.warn('githubPR', 'Pull request already exists', { head, base });
      // Find existing PR
      const existingPRs = await octokit.pulls.list({
        owner,
        repo,
        head: `${owner}:${head}`,
        base,
        state: 'open',
      });
      if (existingPRs.data.length > 0) {
        const pr = existingPRs.data[0];
        return {
          prNumber: pr.number,
          url: pr.html_url,
          nodeId: pr.node_id,
          existing: true,
        };
      }
    }
    throw error;
  }
}

/**
 * Check if PR can be merged
 * @param {Object} params
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {number} params.prNumber - PR number
 */
async function checkPRMergeable({ owner, repo, prNumber }) {
  const octokit = getOctokit();

  const pr = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  return {
    mergeable: pr.data.mergeable,
    mergeableState: pr.data.mergeable_state,
    state: pr.data.state,
    merged: pr.data.merged,
  };
}

/**
 * Check PR status checks (CI/CD)
 * @param {Object} params
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.ref - Commit SHA or branch name
 */
async function checkStatusChecks({ owner, repo, ref }) {
  const octokit = getOctokit();

  try {
    const response = await octokit.checks.listForRef({
      owner,
      repo,
      ref,
    });

    const checks = response.data.check_runs || [];
    const allPassed = checks.every(check => 
      check.conclusion === 'success' || 
      check.conclusion === 'skipped' ||
      check.conclusion === 'neutral'
    );

    const pending = checks.some(check => check.status !== 'completed');

    return {
      allPassed,
      pending,
      checks: checks.map(c => ({
        name: c.name,
        status: c.status,
        conclusion: c.conclusion,
      })),
    };
  } catch (error) {
    logger.warn('githubPR', 'Could not check status checks', { error: error.message });
    // If no checks configured, consider it as passed
    return { allPassed: true, pending: false, checks: [] };
  }
}

/**
 * Check PR reviews/approvals
 * @param {Object} params
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {number} params.prNumber - PR number
 */
async function checkReviews({ owner, repo, prNumber }) {
  const octokit = getOctokit();

  const reviews = await octokit.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
  });

  const approvals = reviews.data.filter(r => r.state === 'APPROVED').length;
  const changesRequested = reviews.data.some(r => r.state === 'CHANGES_REQUESTED');

  return {
    approvals,
    changesRequested,
    reviews: reviews.data.map(r => ({
      user: r.user.login,
      state: r.state,
    })),
  };
}

/**
 * Merge a Pull Request
 * @param {Object} params
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {number} params.prNumber - PR number
 * @param {string} params.commitTitle - Merge commit title
 * @param {string} params.commitMessage - Merge commit message
 * @param {string} params.mergeMethod - 'merge', 'squash', or 'rebase' (default: 'merge')
 */
async function mergePullRequest({ owner, repo, prNumber, commitTitle, commitMessage, mergeMethod = 'merge' }) {
  const octokit = getOctokit();

  logger.info('githubPR', 'Merging pull request', { owner, repo, prNumber, mergeMethod });

  const response = await octokit.pulls.merge({
    owner,
    repo,
    pull_number: prNumber,
    commit_title: commitTitle,
    commit_message: commitMessage || '',
    merge_method: mergeMethod,
  });

  logger.info('githubPR', 'Pull request merged', {
    prNumber,
    sha: response.data.sha,
    merged: response.data.merged,
  });

  return {
    merged: response.data.merged,
    sha: response.data.sha,
    message: response.data.message,
  };
}

/**
 * Auto-merge PR if conditions are met
 * @param {Object} params
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name  
 * @param {number} params.prNumber - PR number
 * @param {string} params.ref - Commit SHA
 * @param {Object} params.config - Installation config
 */
async function attemptAutoMerge({ owner, repo, prNumber, ref, config }) {
  logger.info('githubPR', 'Attempting auto-merge', { owner, repo, prNumber });

  // Check if auto-merge is enabled
  if (!config?.autoMerge?.enabled) {
    logger.info('githubPR', 'Auto-merge not enabled', { prNumber });
    return { merged: false, reason: 'auto_merge_not_enabled' };
  }

  // Check mergeable status (with retry since GitHub needs time to compute)
  let mergeableStatus;
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    mergeableStatus = await checkPRMergeable({ owner, repo, prNumber });
    
    // If mergeable is null or unknown, wait and retry
    if (mergeableStatus.mergeable === null || mergeableStatus.mergeableState === 'unknown') {
      attempts++;
      if (attempts < maxAttempts) {
        logger.info('githubPR', 'Mergeable status not ready, retrying...', { 
          prNumber, 
          attempt: attempts,
          state: mergeableStatus.mergeableState 
        });
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        continue;
      }
    }
    break;
  }
  
  if (!mergeableStatus.mergeable) {
    logger.warn('githubPR', 'PR not mergeable', { prNumber, state: mergeableStatus.mergeableState });
    return { merged: false, reason: 'not_mergeable', details: mergeableStatus };
  }

  // Check status checks if required
  if (config.autoMerge.requireTests) {
    const statusChecks = await checkStatusChecks({ owner, repo, ref });
    if (statusChecks.pending) {
      logger.info('githubPR', 'Status checks pending', { prNumber });
      return { merged: false, reason: 'checks_pending', details: statusChecks };
    }
    if (!statusChecks.allPassed) {
      logger.warn('githubPR', 'Status checks failed', { prNumber });
      return { merged: false, reason: 'checks_failed', details: statusChecks };
    }
  }

  // Check required approvals
  const requiredApprovals = config.autoMerge.requireReviews || 0;
  if (requiredApprovals > 0) {
    const reviews = await checkReviews({ owner, repo, prNumber });
    if (reviews.changesRequested) {
      logger.warn('githubPR', 'Changes requested on PR', { prNumber });
      return { merged: false, reason: 'changes_requested', details: reviews };
    }
    if (reviews.approvals < requiredApprovals) {
      logger.info('githubPR', 'Insufficient approvals', { 
        prNumber, 
        required: requiredApprovals, 
        actual: reviews.approvals 
      });
      return { merged: false, reason: 'insufficient_approvals', details: reviews };
    }
  }

  // All conditions met - merge!
  try {
    const result = await mergePullRequest({
      owner,
      repo,
      prNumber,
      commitTitle: `peer: Auto-merge fixes for PR #${prNumber}`,
      commitMessage: 'Automatically merged by Peer after all checks passed',
      mergeMethod: 'merge',
    });

    return { merged: true, sha: result.sha };
  } catch (error) {
    logger.error('githubPR', 'Failed to merge PR', { 
      prNumber, 
      error: error.message 
    });
    return { merged: false, reason: 'merge_failed', error: error.message };
  }
}

module.exports = {
  createPullRequest,
  mergePullRequest,
  checkPRMergeable,
  checkStatusChecks,
  checkReviews,
  attemptAutoMerge,
};
