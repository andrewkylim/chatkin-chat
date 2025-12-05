import { Resend } from 'resend';
import type { Env } from '../types';
import { logger } from '../utils/logger';

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
				logger.error('Failed to send email', result.error);
				return { success: false, error: result.error.message };
			}

			logger.info('Email sent successfully', { id: result.data?.id, to: notification.to });
			return { success: true };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error('Email service error', errorMessage);
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
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background: #ffffff; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #C77C5C 0%, #A86645 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .logo { width: 48px; height: 48px; margin: 0 auto 16px; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; }
            .task-box { background: white; border-left: 4px solid #C77C5C; padding: 16px; margin: 20px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .task-title { font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 8px 0; }
            .task-date { font-size: 14px; color: #6b7280; margin: 0; }
            .button { display: inline-block; background: #C77C5C; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin-top: 24px; font-weight: 600; transition: background 0.2s; }
            .button:hover { background: #A86645; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; }
            .footer a { color: #C77C5C; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://chatkin.ai/logo.webp" alt="Chatkin" class="logo" />
              <h1>Task Due Soon</h1>
            </div>
            <div class="content">
              <div class="task-box">
                <p class="task-title">${taskTitle}</p>
                <p class="task-date">📅 Due ${formattedDate}</p>
              </div>
              <p>Don't forget to complete it on time!</p>
              <a href="${actionUrl}" class="button">View Task →</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you have task reminders enabled in your <a href="https://chatkin.ai/settings">notification settings</a>.</p>
              <p style="margin-top: 12px; color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} Chatkin. All rights reserved.</p>
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
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background: #ffffff; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #C77C5C 0%, #A86645 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .logo { width: 48px; height: 48px; margin: 0 auto 16px; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .ai-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 13px; margin-top: 8px; font-weight: 500; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; }
            .proposal-box { background: white; border-left: 4px solid #8b5cf6; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .operation-count { display: inline-flex; align-items: center; gap: 8px; background: #ede9fe; color: #6b21a8; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 12px; }
            .button { display: inline-block; background: #C77C5C; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin-top: 24px; font-weight: 600; transition: background 0.2s; }
            .button:hover { background: #A86645; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; }
            .footer a { color: #C77C5C; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://chatkin.ai/logo.webp" alt="Chatkin" class="logo" />
              <h1>🤖 AI Has a Suggestion</h1>
              <div class="ai-badge">AI Proposal</div>
            </div>
            <div class="content">
              <div class="proposal-box">
                <p style="margin: 0 0 12px 0; font-size: 16px;">${summary}</p>
                <div class="operation-count">
                  <span>📋</span>
                  <span>${operationCount} operation${operationCount !== 1 ? 's' : ''} proposed</span>
                </div>
              </div>
              <p>Your AI assistant has analyzed your workspace and prepared these suggestions for your review.</p>
              <a href="${actionUrl}" class="button">Review Proposal →</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you have AI proposal notifications enabled in your <a href="https://chatkin.ai/settings">notification settings</a>.</p>
              <p style="margin-top: 12px; color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} Chatkin. All rights reserved.</p>
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
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background: #ffffff; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #C77C5C 0%, #A86645 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .logo { width: 48px; height: 48px; margin: 0 auto 16px; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .ai-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 13px; margin-top: 8px; font-weight: 500; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; }
            .insight-box { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .insight-icon { font-size: 32px; margin-bottom: 12px; }
            .button { display: inline-block; background: #C77C5C; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin-top: 24px; font-weight: 600; transition: background 0.2s; }
            .button:hover { background: #A86645; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px; }
            .footer a { color: #C77C5C; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://chatkin.ai/logo.webp" alt="Chatkin" class="logo" />
              <h1>💡 New AI Insight</h1>
              <div class="ai-badge">AI Analysis</div>
            </div>
            <div class="content">
              <div class="insight-box">
                <div class="insight-icon">💡</div>
                <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #1e40af;">${insight}</p>
              </div>
              <p>Your AI assistant has analyzed your workspace and discovered something worth sharing.</p>
              <a href="${actionUrl}" class="button">View Details →</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you have AI insight notifications enabled in your <a href="https://chatkin.ai/settings">notification settings</a>.</p>
              <p style="margin-top: 12px; color: #9ca3af; font-size: 12px;">© ${new Date().getFullYear()} Chatkin. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
	}

	profileReadyEmail(actionUrl: string): string {
		return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1f2937; background: #fafafa; margin: 0; padding: 0; }
            .container { max-width: 560px; margin: 40px auto; padding: 0; background: #ffffff; text-align: center; }
            .header { padding: 48px 40px 32px; border-bottom: 1px solid #e5e7eb; }
            .circle { width: 80px; height: 80px; margin: 0 auto 24px; background: #10B981; border-radius: 50%; animation: colorCycle 6s linear infinite; }
            @keyframes colorCycle {
              0% { background-color: #10B981; }
              16.66% { background-color: #3B82F6; }
              33.33% { background-color: #8B5CF6; }
              50% { background-color: #F59E0B; }
              66.66% { background-color: #EAB308; }
              83.33% { background-color: #EF4444; }
              100% { background-color: #10B981; }
            }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #111827; letter-spacing: -0.3px; }
            .content { padding: 40px; }
            .content p { font-size: 16px; margin: 0 0 32px 0; color: #4b5563; line-height: 1.5; }
            .button { display: inline-block; background: #111827; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 15px; }
            .footer { text-align: center; padding: 32px 40px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="circle"></div>
              <h1>Your assessment is ready</h1>
            </div>
            <div class="content">
              <p>Your personalized plan and AI coach are now available.</p>
              <a href="${actionUrl}" class="button">View Your Plan</a>
            </div>
            <div class="footer">
              <p style="margin: 0;">© ${new Date().getFullYear()} Chatkin</p>
            </div>
          </div>
        </body>
      </html>
    `;
	}
}
