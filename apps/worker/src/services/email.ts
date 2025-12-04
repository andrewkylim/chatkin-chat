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

	profileReadyEmail(tasksCreated: number, notesCreated: number, actionUrl: string): string {
		return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background: #f9fafb; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #C77C5C 0%, #A86645 100%); color: white; padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .logo { width: 56px; height: 56px; margin: 0 auto 20px; background: white; border-radius: 50%; padding: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            .header h1 { margin: 0 0 12px 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; }
            .header p { margin: 0; font-size: 17px; opacity: 0.95; line-height: 1.5; }
            .content { background: white; padding: 40px 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; }
            .domains-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 32px 0; }
            .domain-icon { width: 100%; aspect-ratio: 1; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.2s; }
            .domain-icon:hover { transform: translateY(-2px); }
            .highlight-box { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 4px solid #3b82f6; padding: 24px; margin: 32px 0; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .button { display: inline-block; background: #C77C5C; color: white; padding: 18px 40px; text-decoration: none; border-radius: 10px; margin-top: 28px; font-weight: 600; font-size: 17px; transition: all 0.3s; box-shadow: 0 4px 14px rgba(199, 124, 92, 0.35); }
            .button:hover { background: #A86645; box-shadow: 0 6px 20px rgba(199, 124, 92, 0.45); transform: translateY(-2px); }
            .footer { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">
                <img src="https://chatkin.ai/logo.webp" alt="Chatkin" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>
              <h1>✨ Your Lifeboard is Ready</h1>
              <p>Your personalized assessment and lifeboard awaits</p>
            </div>
            <div class="content">
              <p style="font-size: 17px; margin: 0 0 24px 0; color: #374151; line-height: 1.7;">Great news! We've finished analyzing your assessment and your personalized lifeboard is ready to explore.</p>

              <div class="domains-grid">
                <div class="domain-icon" style="background: #10B981;">💪</div>
                <div class="domain-icon" style="background: #3B82F6;">🧠</div>
                <div class="domain-icon" style="background: #8B5CF6;">🎯</div>
                <div class="domain-icon" style="background: #F59E0B;">🤝</div>
                <div class="domain-icon" style="background: #EAB308;">📈</div>
                <div class="domain-icon" style="background: #EF4444;">💰</div>
              </div>

              <div class="highlight-box">
                <p style="margin: 0; font-size: 16px; line-height: 1.8; color: #1e40af;">
                  <strong style="font-size: 17px;">What's inside:</strong><br/>
                  Your comprehensive wellness assessment with insights across all 6 life domains: Body, Mind, Purpose, Connection, Growth, and Finance. Plus personalized recommendations to help you thrive.
                </p>
              </div>

              <p style="font-size: 16px; color: #6b7280; margin: 32px 0 0 0; text-align: center;">Ready to explore your lifeboard?</p>
              <center>
                <a href="${actionUrl}" class="button">View Your Lifeboard →</a>
              </center>
            </div>
            <div class="footer">
              <p style="margin: 0 0 12px 0;">Start your wellness journey with personalized insights</p>
              <p style="margin: 0; color: #9ca3af; font-size: 13px;">© ${new Date().getFullYear()} Chatkin. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
	}
}
