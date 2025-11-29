import { supabase } from '$lib/supabase';
import type { UserNotificationPreferences } from '@chatkin/types';

export async function getNotificationPreferences(): Promise<UserNotificationPreferences | null> {
	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	const { data, error } = await supabase
		.from('user_notification_preferences')
		.select('*')
		.eq('user_id', user.id)
		.single();

	if (error) {
		// If no preferences exist, create default ones
		if (error.code === 'PGRST116') {
			return await createDefaultPreferences();
		}
		throw error;
	}

	return data as UserNotificationPreferences;
}

export async function createDefaultPreferences(): Promise<UserNotificationPreferences> {
	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	const { data, error } = await supabase
		.from('user_notification_preferences')
		.insert({
			user_id: user.id,
			email_task_due_soon: true,
			email_ai_proposals: true,
			email_ai_insights: true,
			browser_task_due_soon: true,
			browser_ai_proposals: true,
			browser_ai_insights: true,
			task_reminder_times: [24] // Default to 1 day before
		})
		.select()
		.single();

	if (error) throw error;
	return data as UserNotificationPreferences;
}

export async function updateNotificationPreferences(
	updates: Partial<
		Omit<UserNotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>
	>
): Promise<UserNotificationPreferences> {
	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	const { data, error } = await supabase
		.from('user_notification_preferences')
		.update(updates)
		.eq('user_id', user.id)
		.select()
		.single();

	if (error) throw error;
	return data as UserNotificationPreferences;
}
