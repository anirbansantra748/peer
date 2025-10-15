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
    suspendedAt: null
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
