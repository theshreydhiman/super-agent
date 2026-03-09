import emailjs from '@emailjs/nodejs';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const log = createLogger('EmailService');

interface PRInfo {
  issueNumber: number;
  issueTitle: string;
  prNumber: number;
  prUrl: string;
  reviewApproved: boolean;
  reviewScore: number;
  reviewFeedback: string;
  reworkAttempts: number;
}

export class EmailService {
  private userEmail: string | null;

  constructor(userEmail?: string | null) {
    this.userEmail = userEmail || null;
  }

  /**
   * Sends a consolidated email notification about all created PRs
   * using the global EmailJS account. Sends to the user's GitHub email.
   */
  async sendPRNotification(prs: PRInfo[], repoFullName: string): Promise<void> {
    const { serviceId, templateId, publicKey, privateKey } = config.emailjs;

    if (!serviceId || !templateId || !publicKey) {
      log.warn('EmailJS not fully configured, skipping notification');
      return;
    }

    if (!this.userEmail) {
      log.warn('No user email available, skipping notification');
      return;
    }

    const prCount = prs.length;

    const prSummaryLines = prs.map((pr) => {
      const status = pr.reviewApproved ? '✅ Approved' : '⚠️ Needs review';
      const reworkInfo = pr.reworkAttempts > 0 ? ` (${pr.reworkAttempts} rework(s))` : '';
      return `• Issue #${pr.issueNumber}: ${pr.issueTitle}\n  PR #${pr.prNumber}: ${pr.prUrl}\n  Score: ${pr.reviewScore}/10 — ${status}${reworkInfo}`;
    });

    const feedbackLines = prs.map((pr) => {
      return `Issue #${pr.issueNumber} — ${pr.issueTitle}:\n${pr.reviewFeedback}`;
    });

    const templateParams = {
      to_email: this.userEmail,
      repo: repoFullName,
      pr_count: prCount.toString(),
      subject: `🤖 Super Agent: ${prCount} PR${prCount > 1 ? 's' : ''} created for ${repoFullName}`,
      pr_summary: prSummaryLines.join('\n\n'),
      review_feedback: feedbackLines.join('\n\n---\n\n'),
      timestamp: new Date().toLocaleString(),
    };

    try {
      const response = await emailjs.send(
        serviceId,
        templateId,
        templateParams,
        { publicKey, privateKey },
      );

      log.info(`EmailJS notification sent to ${this.userEmail} (status: ${response.status})`);
    } catch (error: any) {
      log.error('Failed to send EmailJS notification', {
        error: error?.text || error?.message || error,
      });
      throw error;
    }
  }

  /**
   * Sends an email notification when an issue fails the review cycle
   * after exhausting all rework attempts and needs manual intervention.
   */
  async sendManualInterventionNotification(failures: {
    issueNumber: number;
    issueTitle: string;
    lastScore: number;
    reworkAttempts: number;
    lastFeedback: string;
  }[], repoFullName: string): Promise<void> {
    const { serviceId, templateId, publicKey, privateKey } = config.emailjs;

    if (!serviceId || !templateId || !publicKey) {
      log.warn('EmailJS not fully configured, skipping failure notification');
      return;
    }

    if (!this.userEmail) {
      log.warn('No user email available, skipping failure notification');
      return;
    }

    const failureSummaryLines = failures.map((f) => {
      return `• Issue #${f.issueNumber}: ${f.issueTitle}\n  Final Score: ${f.lastScore}/10 after ${f.reworkAttempts} rework attempt(s)\n  Feedback: ${f.lastFeedback}`;
    });

    const templateParams = {
      to_email: this.userEmail,
      repo: repoFullName,
      pr_count: '0',
      subject: `🚨 Super Agent: ${failures.length} issue(s) in ${repoFullName} need manual intervention`,
      pr_summary: failureSummaryLines.join('\n\n'),
      review_feedback: `The AI agent was unable to produce fixes that meet the quality threshold (7/10) after multiple attempts. These issues require manual attention.`,
      timestamp: new Date().toLocaleString(),
    };

    try {
      const response = await emailjs.send(
        serviceId,
        templateId,
        templateParams,
        { publicKey, privateKey },
      );

      log.info(`Manual intervention email sent to ${this.userEmail} (status: ${response.status})`);
    } catch (error: any) {
      log.error('Failed to send manual intervention email', {
        error: error?.text || error?.message || error,
      });
      throw error;
    }
  }
}
