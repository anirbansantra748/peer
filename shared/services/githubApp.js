const { createAppAuth } = require('@octokit/auth-app');
const { Octokit } = require('@octokit/rest');

/**
 * GitHub App service for interacting with GitHub API as an app
 */
class GitHubAppService {
  constructor() {
    this.appId = process.env.GITHUB_APP_ID;
    this.privateKey = process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY;
    this.clientId = process.env.GITHUB_APP_CLIENT_ID;
    this.clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
    
    if (!this.appId || !this.privateKey) {
      console.warn('[GitHubApp] App ID or Private Key not configured - GitHub App features disabled');
      this.enabled = false;
      return;
    }
    
    this.enabled = true;
    this.installationOctokits = new Map(); // Cache authenticated instances
  }

  /**
   * Check if GitHub App is configured
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get an authenticated Octokit instance for an installation
   */
  async getInstallationOctokit(installationId) {
    if (!this.enabled) {
      throw new Error('GitHub App not configured');
    }
    
    // Return cached instance if available
    if (this.installationOctokits.has(installationId)) {
      return this.installationOctokits.get(installationId);
    }
    
    // Create authenticated Octokit for this installation
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.appId,
        privateKey: this.privateKey.replace(/\\n/g, '\n'),
        installationId: installationId,
      },
    });
    
    this.installationOctokits.set(installationId, octokit);
    return octokit;
  }

  /**
   * Get list of repositories for an installation
   */
  async getInstallationRepositories(installationId) {
    const octokit = await this.getInstallationOctokit(installationId);
    
    const { data } = await octokit.apps.listReposAccessibleToInstallation();
    
    return data.repositories.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      url: repo.html_url,
      defaultBranch: repo.default_branch,
      language: repo.language,
    }));
  }

  /**
   * Get installation details
   */
  async getInstallation(installationId) {
    if (!this.enabled) {
      throw new Error('GitHub App not configured');
    }
    
    const octokit = await this.getInstallationOctokit(installationId);
    const { data } = await octokit.apps.getInstallation({ installation_id: installationId });
    
    return {
      id: data.id,
      account: {
        id: data.account.id,
        login: data.account.login,
        type: data.account.type,
        avatarUrl: data.account.avatar_url,
      },
      permissions: data.permissions,
      events: data.events,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      suspendedAt: data.suspended_at,
    };
  }

  /**
   * Create or update a webhook for a repository
   */
  async ensureWebhook(installationId, owner, repo) {
    const octokit = await this.getInstallationOctokit(installationId);
    
    const webhookUrl = process.env.WEBHOOK_URL || `${process.env.API_BASE || 'http://localhost:3001'}/webhook/github`;
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    
    // Check if webhook already exists
    try {
      const { data: hooks } = await octokit.repos.listWebhooks({ owner, repo });
      const existingHook = hooks.find(h => h.config.url === webhookUrl);
      
      if (existingHook) {
        console.log(`[GitHubApp] Webhook already exists for ${owner}/${repo}`);
        return existingHook;
      }
    } catch (error) {
      console.error(`[GitHubApp] Error checking webhooks:`, error.message);
    }
    
    // Create new webhook
    try {
      const { data } = await octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: webhookSecret,
        },
        events: ['pull_request', 'push'],
        active: true,
      });
      
      console.log(`[GitHubApp] Created webhook for ${owner}/${repo}`);
      return data;
    } catch (error) {
      console.error(`[GitHubApp] Error creating webhook:`, error.message);
      throw error;
    }
  }

  /**
   * Add a comment to a pull request
   */
  async addPRComment(installationId, owner, repo, pullNumber, body) {
    const octokit = await this.getInstallationOctokit(installationId);
    
    const { data } = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });
    
    return data;
  }

  /**
   * Get pull request details
   */
  async getPullRequest(installationId, owner, repo, pullNumber) {
    const octokit = await this.getInstallationOctokit(installationId);
    
    const { data } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    
    return data;
  }

  /**
   * Get pull request files
   */
  async getPullRequestFiles(installationId, owner, repo, pullNumber) {
    const octokit = await this.getInstallationOctokit(installationId);
    
    const { data } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
    });
    
    return data;
  }
}

// Export singleton instance
module.exports = new GitHubAppService();
