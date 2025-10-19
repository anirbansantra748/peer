const nodemailer = require('nodemailer');
const logger = require('../utils/prettyLogger');

/**
 * Email Service for sending notifications
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.from = process.env.EMAIL_FROM || 'Peer Code Review <notifications@peer.dev>';
    this.appUrl = process.env.APP_URL || 'http://localhost:3000';
    this.enabled = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
    
    if (this.enabled) {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      
      logger.info('email', 'Email service initialized', { 
        host: process.env.SMTP_HOST,
        from: this.from 
      });
    } else {
      logger.warn('email', 'Email service disabled - SMTP credentials not configured');
    }
  }

  /**
   * Get user's notification email (preference or fallback to GitHub email)
   */
  getUserEmail(user) {
    return user.notificationEmail || user.email;
  }

  /**
   * Send email notification
   */
  async send({ to, subject, html, text }) {
    if (!this.enabled) {
      logger.info('email', 'Email not sent (service disabled)', { to, subject });
      return { sent: false, reason: 'service_disabled' };
    }

    if (!to) {
      logger.warn('email', 'Email not sent (no recipient)', { subject });
      return { sent: false, reason: 'no_recipient' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text: text || '',
        html: html || text,
      });

      logger.info('email', 'Email sent successfully', { 
        to, 
        subject, 
        messageId: info.messageId 
      });

      return { sent: true, messageId: info.messageId };
    } catch (error) {
      logger.error('email', 'Failed to send email', { 
        to, 
        subject, 
        error: String(error) 
      });
      return { sent: false, reason: 'send_failed', error: String(error) };
    }
  }

  /**
   * Send PR created notification
   */
  async sendPRCreated({ user, repo, prNumber, runId, issuesFound }) {
    const email = this.getUserEmail(user);
    if (!email || !user.notifications?.email?.prCreated) return { sent: false, reason: 'disabled_or_no_email' };

    const subject = `📝 PR #${prNumber} analyzed - ${issuesFound} issues found`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .stats { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔍 Pull Request Analyzed</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${user.displayName || user.username}</strong>,</p>
              <p>Your pull request has been analyzed by Peer AI Code Review.</p>
              
              <div class="stats">
                <p><strong>📦 Repository:</strong> ${repo}</p>
                <p><strong>🔢 PR Number:</strong> #${prNumber}</p>
                <p><strong>🔍 Issues Found:</strong> ${issuesFound}</p>
              </div>

              <p>Click below to view the detailed analysis:</p>
              <a href="${this.appUrl}/pr/${runId}" class="button">View Analysis →</a>

              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                Based on your installation settings, automatic fixes may have been applied or may require your action.
              </p>
            </div>
            <div class="footer">
              <p>Powered by Peer AI Code Review</p>
              <p><a href="${this.appUrl}/settings/notifications">Manage notification preferences</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.send({ to: email, subject, html });
  }

  /**
   * Send auto-merge complete notification
   */
  async sendAutoMergeComplete({ user, repo, prNumber, runId, issuesFixed, fixPrNumber, fixPrUrl }) {
    const email = this.getUserEmail(user);
    if (!email || !user.notifications?.email?.autoMergeComplete) return { sent: false, reason: 'disabled_or_no_email' };

    const subject = `✅ Auto-merge completed for ${repo} PR #${prNumber}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .stats { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
            .success { color: #28a745; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Auto-Merge Completed!</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${user.displayName || user.username}</strong>,</p>
              <p class="success">Great news! Your fixes have been automatically merged.</p>
              
              <div class="stats">
                <p><strong>📦 Repository:</strong> ${repo}</p>
                <p><strong>🔢 Original PR:</strong> #${prNumber}</p>
                <p><strong>✅ Issues Fixed:</strong> ${issuesFixed}</p>
                ${fixPrNumber ? `<p><strong>🔗 Fix PR:</strong> <a href="${fixPrUrl}">#${fixPrNumber}</a></p>` : ''}
              </div>

              <p>Your code has been automatically reviewed, fixed, and merged successfully!</p>
              
              ${fixPrUrl ? `<a href="${fixPrUrl}" class="button">View Fix PR on GitHub →</a>` : ''}
              <a href="${this.appUrl}/pr/${runId}" class="button">View Details →</a>

              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                This automatic fix was applied using AI code review (Mode 0: Auto-Merge).
              </p>
            </div>
            <div class="footer">
              <p>Powered by Peer AI Code Review</p>
              <p><a href="${this.appUrl}/settings/notifications">Manage notification preferences</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.send({ to: email, subject, html });
  }

  /**
   * Send approval needed notification
   */
  async sendApprovalNeeded({ user, repo, prNumber, runId, issuesFixed, fixPrNumber, fixPrUrl }) {
    const email = this.getUserEmail(user);
    if (!email || !user.notifications?.email?.approvalNeeded) return { sent: false, reason: 'disabled_or_no_email' };

    const subject = `👀 Approval needed for ${repo} PR #${prNumber}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #ffc107; color: #333; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .stats { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
            .warning { color: #ff9800; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>👀 Approval Required</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${user.displayName || user.username}</strong>,</p>
              <p class="warning">Action required! Your PR fixes are ready and awaiting approval.</p>
              
              <div class="stats">
                <p><strong>📦 Repository:</strong> ${repo}</p>
                <p><strong>🔢 Original PR:</strong> #${prNumber}</p>
                <p><strong>✅ Issues Fixed:</strong> ${issuesFixed}</p>
                ${fixPrNumber ? `<p><strong>🔗 Fix PR:</strong> <a href="${fixPrUrl}">#${fixPrNumber}</a></p>` : ''}
              </div>

              <p>Peer AI has created a fix PR with ${issuesFixed} automated fixes. Once approved by you or your team, it will be automatically merged.</p>
              
              ${fixPrUrl ? `<a href="${fixPrUrl}" class="button">Approve on GitHub →</a>` : ''}
              <a href="${this.appUrl}/pr/${runId}" class="button">View Details →</a>

              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                This requires one approval before auto-merge (Mode 1: Approval Required).
              </p>
            </div>
            <div class="footer">
              <p>Powered by Peer AI Code Review</p>
              <p><a href="${this.appUrl}/settings/notifications">Manage notification preferences</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.send({ to: email, subject, html });
  }

  /**
   * Send manual issue selection notification
   */
  async sendIssueSelectionNeeded({ user, repo, prNumber, runId, issuesFound }) {
    const email = this.getUserEmail(user);
    if (!email || !user.notifications?.email?.issueSelectionNeeded) return { sent: false, reason: 'disabled_or_no_email' };

    const subject = `🎯 Select issues to fix for ${repo} PR #${prNumber}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .stats { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
            .action { color: #667eea; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎯 Choose Issues to Fix</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${user.displayName || user.username}</strong>,</p>
              <p class="action">Your input is needed! Select which issues you'd like to fix.</p>
              
              <div class="stats">
                <p><strong>📦 Repository:</strong> ${repo}</p>
                <p><strong>🔢 PR Number:</strong> #${prNumber}</p>
                <p><strong>🔍 Issues Found:</strong> ${issuesFound}</p>
              </div>

              <p>Peer AI has analyzed your PR and found ${issuesFound} potential issues. You can now review and select which ones to fix automatically.</p>
              
              <a href="${this.appUrl}/runs/${runId}/select" class="button">Select Issues to Fix →</a>

              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                You have full control over which fixes are applied (Mode 2: Manual Selection).
              </p>
            </div>
            <div class="footer">
              <p>Powered by Peer AI Code Review</p>
              <p><a href="${this.appUrl}/settings/notifications">Manage notification preferences</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await this.send({ to: email, subject, html });
  }
}

// Export singleton instance
module.exports = new EmailService();
