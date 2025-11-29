import type { Env, CorsHeaders } from '../types';
import { requireAuth } from '../middleware/auth';
import { EmailService } from '../services/email';
import { createClient } from '@supabase/supabase-js';

interface SendNotificationRequest {
	notification_type: 'task_due_soon' | 'ai_proposal' | 'ai_insight';
	channels: Array<'email' | 'browser'>;
	title: string;
	body: string;
	action_url?: string;
	task_id?: string;
	message_id?: string;
	email_content_html?: string;
	operation_count?: number;
}

export async function handleSendNotification(
	request: Request,
	env: Env,
	corsHeaders: CorsHeaders
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	try {
		const user = await requireAuth(request, env);
		const body = (await request.json()) as SendNotificationRequest;

		// Initialize Supabase client with user's auth token
		const authHeader = request.headers.get('Authorization');
		const token = authHeader?.replace('Bearer ', '');
		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
			global: { headers: { Authorization: `Bearer ${token}` } }
		});

		// Get user's notification preferences
		const { data: prefs, error: prefsError } = await supabase
			.from('user_notification_preferences')
			.select('*')
			.eq('user_id', user.userId)
			.single();

		if (prefsError || !prefs) {
			console.warn('No notification preferences found for user', user.userId);
			return new Response(
				JSON.stringify({ success: false, message: 'No preferences configured' }),
				{
					status: 200,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				}
			);
		}

		// Check if notifications are enabled for this type
		const emailEnabled =
			body.channels.includes('email') && prefs[`email_${body.notification_type}`];
		const browserEnabled =
			body.channels.includes('browser') && prefs[`browser_${body.notification_type}`];

		const results: any[] = [];

		// Send email notification
		if (emailEnabled) {
			const emailService = new EmailService(env);
			const { data: userData } = await supabase.auth.getUser(token!);
			const userEmail = prefs.notification_email || userData.user?.email;

			if (userEmail) {
				let emailHtml = body.email_content_html;

				// Generate HTML if not provided
				if (!emailHtml) {
					if (body.notification_type === 'task_due_soon' && body.task_id) {
						const { data: task } = await supabase
							.from('tasks')
							.select('title, due_date')
							.eq('id', body.task_id)
							.single();

						if (task) {
							emailHtml = emailService.taskDueSoonEmail(
								task.title,
								task.due_date!,
								body.action_url || `https://chatkin.ai/tasks?task=${body.task_id}`
							);
						}
					} else if (body.notification_type === 'ai_proposal') {
						emailHtml = emailService.aiProposalEmail(
							body.body,
							body.operation_count || 1,
							body.action_url || 'https://chatkin.ai'
						);
					} else if (body.notification_type === 'ai_insight') {
						emailHtml = emailService.aiInsightEmail(
							body.body,
							body.action_url || 'https://chatkin.ai'
						);
					}
				}

				if (emailHtml) {
					const emailResult = await emailService.sendEmail({
						to: userEmail,
						subject: body.title,
						html: emailHtml,
						text: body.body
					});

					// Log to notification queue
					await supabase.from('notification_queue').insert({
						user_id: user.userId,
						notification_type: body.notification_type,
						channel: 'email',
						task_id: body.task_id,
						message_id: body.message_id,
						title: body.title,
						body: body.body,
						action_url: body.action_url,
						status: emailResult.success ? 'sent' : 'failed',
						sent_at: emailResult.success ? new Date().toISOString() : null,
						error_message: emailResult.error
					});

					results.push({ channel: 'email', success: emailResult.success });
				}
			}
		}

		// Browser notification would be handled client-side
		if (browserEnabled) {
			results.push({
				channel: 'browser',
				success: true,
				message: 'Client should trigger browser notification'
			});
		}

		return new Response(JSON.stringify({ success: true, results }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Send notification failed', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
}
