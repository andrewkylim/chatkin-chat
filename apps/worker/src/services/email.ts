import { Resend } from 'resend';
import type { Env } from '../types';

export interface EmailNotification {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

export class EmailService {
	private resend: Resend;
	private fromEmail = 'Chatkin <notifications@mail.chatkin.ai>';

	constructor(env: Env) {
		this.resend = new Resend(env.RESEND_API_KEY);
	}

	async sendEmail(notification: EmailNotification): Promise<{ success: boolean; error?: string }> {
		try {
			const result = await this.resend.emails.send({
				from: this.fromEmail,
				to: notification.to,
				subject: notification.subject,
				html: notification.html,
				text: notification.text
			});

			if (result.error) {
				console.error('Failed to send email', result.error);
				return { success: false, error: result.error.message };
			}

			console.log('Email sent successfully', { id: result.data?.id, to: notification.to });
			return { success: true };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error('Email service error', errorMessage);
			return { success: false, error: errorMessage };
		}
	}

	taskDueSoonEmail(taskTitle: string, dueDate: string, actionUrl: string): string {
		const formattedDate = new Date(dueDate).toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});

		return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #C77C5C 0%, #A86645 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #C77C5C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Task Due Soon</h1>
            </div>
            <div class="content">
              <p><strong>${taskTitle}</strong> is due on ${formattedDate}.</p>
              <p>Don't forget to complete it on time!</p>
              <a href="${actionUrl}" class="button">View Task</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you have task reminders enabled in your Chatkin notification settings.</p>
            </div>
          </div>
        </body>
      </html>
    `;
	}

	aiProposalEmail(summary: string, operationCount: number, actionUrl: string): string {
		return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #C77C5C 0%, #A86645 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #C77C5C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">AI Has a Suggestion</h1>
            </div>
            <div class="content">
              <p>${summary}</p>
              <p>Your AI assistant has proposed ${operationCount} operation(s) for your review.</p>
              <a href="${actionUrl}" class="button">Review Proposal</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you have AI proposal notifications enabled in your Chatkin notification settings.</p>
            </div>
          </div>
        </body>
      </html>
    `;
	}

	aiInsightEmail(insight: string, actionUrl: string): string {
		return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #C77C5C 0%, #A86645 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #C77C5C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">New AI Insight</h1>
            </div>
            <div class="content">
              <p>${insight}</p>
              <a href="${actionUrl}" class="button">View Details</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you have AI insight notifications enabled in your Chatkin notification settings.</p>
            </div>
          </div>
        </body>
      </html>
    `;
	}
}
