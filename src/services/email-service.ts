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
  reviewFeedback: string;
}

export class EmailService {
  constructor() {
    // Nothing to initialize — EmailJS uses per-request auth
  }

  /**
   * Sends a consolidated email notification about all created PRs
   * via the EmailJS service.
   */
  async sendPRNotification(prs: PRInfo[]): Promise<void> {
    const { serviceId, templateId, publicKey, privateKey } = config.emailjs;

    if (!serviceId || !templateId || !publicKey) {
      log.warn('EmailJS not fully configured, skipping notification');
      return;
    }

    const repoFullName = `${config.github.owner}/${config.github.repo}`;
    const prCount = prs.length;

    // Build a plain-text summary for the template
    const prSummaryLines = prs.map((pr) => {
      const status = pr.reviewApproved ? '✅ Approved' : '⚠️ Needs review';
      return `• Issue #${pr.issueNumber}: ${pr.issueTitle}\n  PR #${pr.prNumber}: ${pr.prUrl}\n  Status: ${status}`;
    });

    const feedbackLines = prs.map((pr) => {
      return `Issue #${pr.issueNumber} — ${pr.issueTitle}:\n${pr.reviewFeedback}`;
    });

    // These template params map to variables in your EmailJS template.
    // Create a template at https://dashboard.emailjs.com with these variables.
    const templateParams = {
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
        {
          publicKey,
          privateKey,
        }
      );

      log.info(`EmailJS notification sent successfully (status: ${response.status})`);
    } catch (error: any) {
      log.error('Failed to send EmailJS notification', {
        error: error?.text || error?.message || error,
      });
      throw error;
    }
  }
}
