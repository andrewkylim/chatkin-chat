import { createClient } from '@supabase/supabase-js';
import type { Env } from '../types';
import { EmailService } from '../services/email';
import { logger } from '../utils/logger';

/**
 * Format time string (HH:MM:SS or HH:MM) to 12-hour format
 */
function formatTime(time: string | null): string {
	if (!time) return '';
	const parts = time.split(':');
	const hours = parseInt(parts[0], 10);
	const minutes = parseInt(parts[1], 10);
	const period = hours >= 12 ? 'PM' : 'AM';
	const displayHours = hours % 12 || 12;
	return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export async function checkTaskReminders(env: Env): Promise<void> {
	logger.info('Running task reminder cron job');

	// Create admin Supabase client with service role key
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	// Get all users with task reminders enabled
	const { data: usersWithPrefs, error: prefsError } = await supabase
		.from('user_notification_preferences')
		.select('user_id, notification_email, email_task_due_soon, browser_task_due_soon, task_reminder_times')
		.or('email_task_due_soon.eq.true,browser_task_due_soon.eq.true');

	if (prefsError) {
		logger.error('Failed to fetch notification preferences', prefsError);
		return;
	}

	if (!usersWithPrefs || usersWithPrefs.length === 0) {
		logger.info('No users with task reminders enabled');
		return;
	}

	logger.info(`Checking reminders for ${usersWithPrefs.length} users`);

	const emailService = new EmailService(env);
	const now = new Date();

	// Process each user
	for (const userPref of usersWithPrefs) {
		try {
			// For each reminder time the user has enabled
			const reminderTimes = userPref.task_reminder_times || [24];

			for (const hoursAhead of reminderTimes) {
				const reminderTime = new Date(now);
				reminderTime.setHours(reminderTime.getHours() + hoursAhead);

				// Find tasks due within this reminder window
				const { data: dueTasks, error: tasksError } = await supabase
					.from('tasks')
					.select('id, title, due_date, due_time, is_all_day, user_id')
					.eq('user_id', userPref.user_id)
					.neq('status', 'completed')
					.not('due_date', 'is', null);

				if (tasksError || !dueTasks) {
					logger.error('Failed to fetch tasks for user', { userId: userPref.user_id, error: tasksError?.message });
					continue;
				}

				// Filter tasks that fall within this reminder window
				const tasksToRemind = dueTasks.filter(task => {
					const dueDate = new Date(task.due_date!);

					if (task.is_all_day) {
						// For all-day tasks, use end of day
						dueDate.setHours(23, 59, 59, 999);
					} else if (task.due_time) {
						// For timed tasks, use exact time
						const [hours, minutes, seconds = 0] = task.due_time.split(':').map(Number);
						dueDate.setHours(hours, minutes, seconds);
					}

					// Check if due time is within ±30 minutes of reminder window
					const timeDiff = Math.abs(dueDate.getTime() - reminderTime.getTime());
					const thirtyMinutes = 30 * 60 * 1000;

					return timeDiff <= thirtyMinutes && dueDate > now;
				});

				// Send reminders for filtered tasks
				for (const task of tasksToRemind) {
					// Check for duplicates
					const { data: existingNotif } = await supabase
						.from('notification_queue')
						.select('id')
						.eq('user_id', userPref.user_id)
						.eq('task_id', task.id)
						.eq('notification_type', 'task_due_soon')
						.eq('status', 'sent')
						.gte('created_at', new Date(Date.now() - hoursAhead * 60 * 60 * 1000).toISOString())
						.single();

					if (existingNotif) {
						logger.info('Reminder already sent for task', task.id);
						continue;
					}

					// Get user email
					const { data: userData } = await supabase.auth.admin.getUserById(userPref.user_id);
					const userEmail = userPref.notification_email || userData?.user?.email;
					if (!userEmail) {
						console.warn('No email found for user', userPref.user_id);
						continue;
					}

					// Format due date/time for display
					const dueDateTime = task.is_all_day
						? new Date(task.due_date!).toLocaleDateString()
						: `${new Date(task.due_date!).toLocaleDateString()} at ${formatTime(task.due_time)}`;

					// Send email if enabled
					if (userPref.email_task_due_soon) {
						const actionUrl = `https://chatkin.ai/tasks?task=${task.id}`;
						const emailHtml = emailService.taskDueSoonEmail(task.title, dueDateTime, actionUrl);

						const emailResult = await emailService.sendEmail({
							to: userEmail,
							subject: `Reminder: ${task.title} due soon`,
							html: emailHtml,
							text: `${task.title} is due on ${dueDateTime}`
						});

						await supabase.from('notification_queue').insert({
							user_id: userPref.user_id,
							notification_type: 'task_due_soon',
							channel: 'email',
							task_id: task.id,
							title: `Reminder: ${task.title} due soon`,
							body: `${task.title} is due on ${dueDateTime}`,
							action_url: actionUrl,
							status: emailResult.success ? 'sent' : 'failed',
							sent_at: emailResult.success ? new Date().toISOString() : null,
							error_message: emailResult.error
						});

						logger.info('Task reminder sent', { taskId: task.id, userId: userPref.user_id, success: emailResult.success });
					}

					// Create browser notification entry
					if (userPref.browser_task_due_soon) {
						await supabase.from('notification_queue').insert({
							user_id: userPref.user_id,
							notification_type: 'task_due_soon',
							channel: 'browser',
							task_id: task.id,
							title: `Task Due Soon`,
							body: `${task.title} is due on ${dueDateTime}`,
							action_url: `/tasks?task=${task.id}`,
							status: 'pending'
						});
					}
				}
			}
		} catch (error) {
			logger.error('Error processing reminders for user', { userId: userPref.user_id, error: error instanceof Error ? error.message : String(error) });
		}
	}

	logger.info('Task reminder cron job completed');
}
