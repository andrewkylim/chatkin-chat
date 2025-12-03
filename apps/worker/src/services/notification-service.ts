/**
 * Notification Service
 * Handles 3-tier notification strategy:
 * 1. Task reminders (always)
 * 2. High-priority observations (if inactive 3+ days)
 * 3. Check-ins (if inactive 7+ days)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export interface NotificationPayload {
	user_id: string;
	type: 'task_reminder' | 'observation' | 'check_in';
	title: string;
	message: string;
	data?: any;
}

export class NotificationService {
	constructor(private supabase: SupabaseClient) {}

	/**
	 * Send notifications to users based on activity and observations
	 */
	async sendNotifications(): Promise<void> {
		logger.info('Starting notification dispatch...');

		try {
			// Get all user profiles with activity data
			const { data: profiles, error } = await this.supabase
				.from('user_profiles')
				.select('user_id, last_active, has_completed_questionnaire');

			if (error) {
				logger.error('Failed to fetch user profiles', { error });
				return;
			}

			if (!profiles || profiles.length === 0) {
				logger.info('No user profiles found');
				return;
			}

			for (const profile of profiles) {
				if (!profile.has_completed_questionnaire) continue;

				await this.processUserNotifications(
					profile.user_id,
					profile.last_active ? new Date(profile.last_active) : null
				);
			}

			logger.info('Notification dispatch complete', {
				usersProcessed: profiles.length
			});
		} catch (error) {
			logger.error('Notification dispatch failed', { error });
		}
	}

	/**
	 * Process notifications for a single user
	 */
	private async processUserNotifications(
		userId: string,
		lastActive: Date | null
	): Promise<void> {
		const daysSinceActive = lastActive
			? Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
			: 999;

		const notifications: NotificationPayload[] = [];

		// 1. Task reminders (always, regardless of activity)
		const taskReminders = await this.getTaskReminders(userId);
		notifications.push(...taskReminders);

		// 2. High-priority observations (if inactive 3+ days)
		if (daysSinceActive >= 3) {
			const observations = await this.getHighPriorityObservations(userId);
			notifications.push(...observations);
		}

		// 3. Check-ins (if inactive 7+ days)
		if (daysSinceActive >= 7) {
			const checkIn = await this.getCheckIn(userId, daysSinceActive);
			if (checkIn) {
				notifications.push(checkIn);
			}
		}

		// Send notifications (log for now, can be extended to push/email)
		for (const notification of notifications) {
			await this.sendNotification(notification);
		}

		logger.debug('User notifications processed', {
			userId,
			daysSinceActive,
			notificationsSent: notifications.length
		});
	}

	/**
	 * Get task reminder notifications (due today or overdue)
	 */
	private async getTaskReminders(userId: string): Promise<NotificationPayload[]> {
		const today = new Date().toISOString().split('T')[0];

		const { data: tasks, error } = await this.supabase
			.from('tasks')
			.select('id, title, due_date, priority')
			.eq('user_id', userId)
			.eq('status', 'todo')
			.lte('due_date', today)
			.order('due_date', { ascending: true })
			.limit(5);

		if (error || !tasks || tasks.length === 0) {
			return [];
		}

		// Group by due status
		const overdueTasks = tasks.filter((t) => t.due_date < today);
		const dueTodayTasks = tasks.filter((t) => t.due_date === today);

		const notifications: NotificationPayload[] = [];

		if (overdueTasks.length > 0) {
			notifications.push({
				user_id: userId,
				type: 'task_reminder',
				title: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`,
				message:
					overdueTasks.length === 1
						? overdueTasks[0].title
						: `${overdueTasks[0].title} and ${overdueTasks.length - 1} more`,
				data: { task_ids: overdueTasks.map((t) => t.id) }
			});
		}

		if (dueTodayTasks.length > 0) {
			notifications.push({
				user_id: userId,
				type: 'task_reminder',
				title: `${dueTodayTasks.length} task${dueTodayTasks.length > 1 ? 's' : ''} due today`,
				message:
					dueTodayTasks.length === 1
						? dueTodayTasks[0].title
						: `${dueTodayTasks[0].title} and ${dueTodayTasks.length - 1} more`,
				data: { task_ids: dueTodayTasks.map((t) => t.id) }
			});
		}

		return notifications;
	}

	/**
	 * Get high-priority coach observations (not yet surfaced)
	 */
	private async getHighPriorityObservations(
		userId: string
	): Promise<NotificationPayload[]> {
		const { data: observations, error } = await this.supabase
			.from('coach_observations')
			.select('id, content, observation_type')
			.eq('user_id', userId)
			.eq('priority', 'high')
			.is('surfaced_at', null)
			.eq('dismissed', false)
			.order('created_at', { ascending: false })
			.limit(1);

		if (error || !observations || observations.length === 0) {
			return [];
		}

		const obs = observations[0];
		return [
			{
				user_id: userId,
				type: 'observation',
				title: 'Pattern detected',
				message: obs.content,
				data: { observation_id: obs.id, observation_type: obs.observation_type }
			}
		];
	}

	/**
	 * Get check-in notification for inactive users
	 */
	private async getCheckIn(userId: string, daysSinceActive: number): Promise<NotificationPayload | null> {
		// Check if we've already sent a check-in recently
		const { data: recentCheckIns, error } = await this.supabase
			.from('coach_observations')
			.select('id')
			.eq('user_id', userId)
			.eq('observation_type', 'pattern')
			.gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
			.limit(1);

		if (error || (recentCheckIns && recentCheckIns.length > 0)) {
			return null; // Already checked in recently
		}

		return {
			user_id: userId,
			type: 'check_in',
			title: `It's been ${daysSinceActive} days`,
			message: "What's been going on? I'm here when you're ready.",
			data: { days_since_active: daysSinceActive }
		};
	}

	/**
	 * Send notification (placeholder - can be extended to push/email/SMS)
	 */
	private async sendNotification(notification: NotificationPayload): Promise<void> {
		// For now, just log
		// TODO: Integrate with push notification service (e.g., Firebase, OneSignal)
		logger.info('Notification sent', {
			userId: notification.user_id,
			type: notification.type,
			title: notification.title
		});

		// Could store notifications in a table for in-app display
		// await this.supabase.from('notifications').insert({
		//   user_id: notification.user_id,
		//   type: notification.type,
		//   title: notification.title,
		//   message: notification.message,
		//   data: notification.data
		// });
	}
}

/**
 * Factory function
 */
export function createNotificationService(supabase: SupabaseClient): NotificationService {
	return new NotificationService(supabase);
}
