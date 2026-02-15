const express = require('express');
const crypto = require('crypto');
const Installation = require('../../../shared/models/Installation');
const logger = require('../../../shared/utils/prettyLogger');

const router = express.Router();

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(req, res, next) {
  const signature = req.header('X-Hub-Signature-256');
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.warn('githubApp', 'GITHUB_APP_WEBHOOK_SECRET not configured, skipping signature verification');
    return next();
  }

  if (!signature) {
    logger.error('githubApp', 'Missing X-Hub-Signature-256 header');
    return res.status(401).json({ error: 'Missing signature header' });
  }

  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', webhookSecret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    logger.error('githubApp', 'Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

/**
 * Handle installation created event
 */
async function handleInstallationCreated(payload) {
  const { installation, repositories, sender } = payload;

  logger.info('githubApp', 'Installation created', {
    installationId: installation.id,
    account: installation.account.login,
    repositorySelection: installation.repository_selection,
    repoCount: repositories?.length || 0,
    sender: sender.login
  });

  // Create Installation document
  const repos = (repositories || []).map(repo => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    url: repo.html_url
  }));

  const installationDoc = new Installation({
    installationId: installation.id,
    accountLogin: installation.account.login,
    accountId: installation.account.id,
    accountType: installation.account.type,
    repositorySelection: installation.repository_selection,
    repositories: repos,
    permissions: installation.permissions,
    events: installation.events,
    suspended: false,
    suspendedAt: null,
    // Try to link to user who installed (sender)
    // This will be updated when user logs in via OAuth
  });

  await installationDoc.save();

  logger.info('githubApp', 'Installation saved to DB', {
    _id: installationDoc._id,
    installationId: installation.id,
    repos: repos.length
  });

  return { ok: true, installationId: installation.id };
}

/**
 * Handle installation deleted event
 */
async function handleInstallationDeleted(payload) {
  const { installation } = payload;

  logger.info('githubApp', 'Installation deleted', {
    installationId: installation.id,
    account: installation.account.login
  });

  // Mark installation as suspended (soft delete)
  const installationDoc = await Installation.findOne({
    installationId: installation.id
  });

  if (!installationDoc) {
    logger.warn('githubApp', 'Installation not found in DB', {
      installationId: installation.id
    });
    return { ok: true, message: 'Installation not found' };
  }

  installationDoc.suspended = true;
  installationDoc.suspendedAt = new Date();
  await installationDoc.save();

  logger.info('githubApp', 'Installation marked as suspended', {
    _id: installationDoc._id,
    installationId: installation.id
  });

  return { ok: true, installationId: installation.id };
}

/**
 * Handle installation repositories added/removed
 */
async function handleInstallationRepositories(payload, action) {
  const { installation, repositories_added, repositories_removed } = payload;

  logger.info('githubApp', `Installation repositories ${action}`, {
    installationId: installation.id,
    account: installation.account.login,
    added: repositories_added?.length || 0,
    removed: repositories_removed?.length || 0
  });

  const installationDoc = await Installation.findOne({
    installationId: installation.id
  });

  if (!installationDoc) {
    logger.warn('githubApp', 'Installation not found in DB', {
      installationId: installation.id
    });
    return { ok: false, error: 'Installation not found' };
  }

  // Add new repositories
  if (repositories_added && repositories_added.length > 0) {
    const newRepos = repositories_added.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      url: repo.html_url
    }));

    // Filter out duplicates
    const existingRepoIds = new Set(installationDoc.repositories.map(r => r.id));
    const toAdd = newRepos.filter(r => !existingRepoIds.has(r.id));
    installationDoc.repositories.push(...toAdd);
  }

  // Remove repositories
  if (repositories_removed && repositories_removed.length > 0) {
    const removedRepoIds = new Set(repositories_removed.map(r => r.id));
    installationDoc.repositories = installationDoc.repositories.filter(
      r => !removedRepoIds.has(r.id)
    );
  }

  await installationDoc.save();

  logger.info('githubApp', 'Installation repositories updated', {
    _id: installationDoc._id,
    installationId: installation.id,
    totalRepos: installationDoc.repositories.length
  });

  return { ok: true, installationId: installation.id };
}

/**
 * Handle installation suspended event
 */
async function handleInstallationSuspended(payload) {
  const { installation } = payload;

  logger.info('githubApp', 'Installation suspended', {
    installationId: installation.id,
    account: installation.account.login
  });

  const installationDoc = await Installation.findOne({
    installationId: installation.id
  });

  if (!installationDoc) {
    logger.warn('githubApp', 'Installation not found in DB', {
      installationId: installation.id
    });
    return { ok: true, message: 'Installation not found' };
  }

  installationDoc.suspended = true;
  installationDoc.suspendedAt = new Date();
  await installationDoc.save();

  logger.info('githubApp', 'Installation marked as suspended', {
    _id: installationDoc._id,
    installationId: installation.id
  });

  return { ok: true, installationId: installation.id };
}

/**
 * Handle installation unsuspended event
 */
async function handleInstallationUnsuspended(payload) {
  const { installation } = payload;

  logger.info('githubApp', 'Installation unsuspended', {
    installationId: installation.id,
    account: installation.account.login
  });

  const installationDoc = await Installation.findOne({
    installationId: installation.id
  });

  if (!installationDoc) {
    logger.warn('githubApp', 'Installation not found in DB', {
      installationId: installation.id
    });
    return { ok: true, message: 'Installation not found' };
  }

  installationDoc.suspended = false;
  installationDoc.suspendedAt = null;
  await installationDoc.save();

  logger.info('githubApp', 'Installation marked as active', {
    _id: installationDoc._id,
    installationId: installation.id
  });

  return { ok: true, installationId: installation.id };
}

/**
 * Main webhook handler
 */
router.post('/', verifyGitHubSignature, async (req, res) => {
  const event = req.header('X-GitHub-Event');
  const delivery = req.header('X-GitHub-Delivery');

  logger.info('githubApp', 'Webhook received', {
    event,
    delivery,
    action: req.body.action
  });

  try {
    let result;

    switch (event) {
      case 'installation':
        if (req.body.action === 'created') {
          result = await handleInstallationCreated(req.body);
        } else if (req.body.action === 'deleted') {
          result = await handleInstallationDeleted(req.body);
        } else if (req.body.action === 'suspend') {
          result = await handleInstallationSuspended(req.body);
        } else if (req.body.action === 'unsuspend') {
          result = await handleInstallationUnsuspended(req.body);
        } else {
          logger.warn('githubApp', 'Unhandled installation action', {
            action: req.body.action
          });
          result = { ok: true, message: 'Unhandled action' };
        }
        break;

      case 'installation_repositories':
        result = await handleInstallationRepositories(
          req.body,
          req.body.action
        );
        break;

      case 'pull_request_review':
        // Handle review events on Peer autofix PRs
        if (req.body.pull_request && req.body.repository) {
          const repo = req.body.repository.full_name;
          const prNumber = req.body.pull_request.number;
          const prBranch = req.body.pull_request.head.ref;
          const reviewState = req.body.review?.state;
          
          // Only handle approved reviews on Peer autofix PRs
          if (prBranch.startsWith('peer/autofix/') && reviewState === 'approved') {
            logger.info('githubApp', 'Peer autofix PR approved, attempting auto-merge', { repo, prNumber });
            
            const { attemptAutoMerge } = require('../../../shared/services/githubPR');
            const Installation = require('../../../shared/models/Installation');
            const PatchRequest = require('../../../shared/models/PatchRequest');
            
            // Find the patch request for this PR by branch name
            const patch = await PatchRequest.findOne({
              repo,
              $or: [
                { 'results.fixPrNumber': prNumber },
                { 'results.branchName': prBranch }
              ]
            }).sort({ createdAt: -1 });
            
            if (!patch) {
              logger.warn('githubApp', 'No patch request found for autofix PR', { repo, prNumber });
              result = { ok: true, message: 'No patch request found' };
              break;
            }
            
            // Get installation config
            const PRRun = require('../../../shared/models/PRRun');
            const run = await PRRun.findById(patch.runId);
            if (!run || !run.installationId) {
              logger.warn('githubApp', 'No installation found for patch', { patchId: patch._id.toString() });
              result = { ok: true, message: 'No installation' };
              break;
            }
            
            const installation = await Installation.findById(run.installationId);
            if (!installation) {
              logger.warn('githubApp', 'Installation not found', { installationId: run.installationId });
              result = { ok: true, message: 'Installation not found' };
              break;
            }
            
            // Parse repo owner/name
            const [owner, repoName] = repo.split('/');
            
            // Attempt auto-merge
            try {
              const mergeResult = await attemptAutoMerge({
                owner,
                repo: repoName,
                prNumber,
                ref: req.body.pull_request.head.sha,
                config: installation.config
              });
              
              patch.results.autoMerged = mergeResult.merged;
              patch.results.autoMergeReason = mergeResult.reason;
              await patch.save();
              
              if (mergeResult.merged) {
                logger.info('githubApp', 'Autofix PR auto-merged after approval', { repo, prNumber });
                result = { ok: true, merged: true };
              } else {
                logger.info('githubApp', 'Autofix PR not auto-merged', { repo, prNumber, reason: mergeResult.reason });
                result = { ok: true, merged: false, reason: mergeResult.reason };
              }
            } catch (mergeError) {
              logger.error('githubApp', 'Failed to auto-merge after approval', {
                repo,
                prNumber,
                error: String(mergeError),
                stack: mergeError.stack
              });
              result = { ok: true, error: 'merge_failed' };
            }
          } else {
            logger.info('githubApp', 'Ignoring review event', { repo, prNumber, reviewState, isPeerPR: prBranch.startsWith('peer/autofix/') });
            result = { ok: true, ignored: true };
          }
        } else {
          result = { ok: true, message: 'No PR data' };
        }
        break;

      case 'pull_request':
        // Forward to main PR webhook handler
        const prAction = req.body.action;
        logger.info('githubApp', 'Forwarding PR event to main handler', { event, action: prAction });
        
        // Only process opened and synchronize actions
        if (prAction !== 'opened' && prAction !== 'synchronize') {
          logger.info('githubApp', 'Ignoring PR action', { action: prAction });
          result = { ok: true, ignored: true, reason: 'action_not_handled' };
          break;
        }
        
        // Re-process through main webhook by calling it internally
        const PRRun = require('../../../shared/models/PRRun');
        const Installation = require('../../../shared/models/Installation');
        const { analyzeQueue } = require('../../../shared/queue');
        
        if (req.body.pull_request && req.body.repository) {
          const repo = req.body.repository.full_name;
          const prNumber = req.body.pull_request.number;
          const sha = req.body.pull_request.head.sha;
          const baseSha = req.body.pull_request.base.sha;
          const prBranch = req.body.pull_request.head.ref;
          
          // Ignore PRs created by Peer autofix (prevent infinite loop)
          if (prBranch.startsWith('peer/autofix/')) {
            logger.info('githubApp', 'Ignoring Peer autofix PR', { repo, prNumber });
            result = { ok: true, ignored: true };
            break;
          }
          
          // Look up installation
          const installation = await Installation.findOne({
            'repositories.fullName': repo,
            status: 'active'
          });
          
          if (!installation) {
            logger.warn('githubApp', 'No installation found', { repo });
            result = { ok: true, message: 'No installation' };
            break;
          }
          
          // Create PRRun and enqueue
          const prRun = new PRRun({ 
            repo, 
            prNumber, 
            sha, 
            status: 'queued',
            installationId: installation._id
          });
          await prRun.save();
          
          await analyzeQueue.add('analyze', {
            runId: prRun._id.toString(),
            repo,
            prNumber,
            sha,
            baseSha,
          });
          
          logger.info('githubApp', 'PR job enqueued', { runId: prRun._id.toString(), repo, prNumber });
          result = { ok: true, runId: prRun._id.toString() };
        } else {
          result = { ok: true, message: 'No PR data' };
        }
        break;

      default:
        logger.info('githubApp', 'Unhandled event type', { event });
        result = { ok: true, message: 'Event not handled' };
    }

    res.json(result);
  } catch (error) {
    logger.error('githubApp', 'Webhook handler error', {
      event,
      delivery,
      error: String(error),
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
