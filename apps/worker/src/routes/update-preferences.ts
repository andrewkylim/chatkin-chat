/**
 * Update user preferences endpoint
 */

import type { Env, CorsHeaders } from '../types';
import { requireAuth } from '../middleware/auth';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { createSupabaseAdmin } from '../utils/supabase-admin';

export async function handleUpdatePreferences(
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
		logger.debug('Updating user preferences', { userId: user.userId });

		const body = await request.json();
		const { ai_tone, proactivity_level, communication_style } = body as {
			ai_tone?: 'challenging' | 'supportive' | 'balanced';
			proactivity_level?: 'high' | 'medium' | 'low';
			communication_style?: 'brief' | 'detailed' | 'conversational';
		};

		// Validate at least one preference is provided
		if (!ai_tone && !proactivity_level && !communication_style) {
			throw new WorkerError('At least one preference must be provided', 400);
		}

		// Validate values
		if (ai_tone && !['challenging', 'supportive', 'balanced'].includes(ai_tone)) {
			throw new WorkerError('Invalid ai_tone value', 400);
		}
		if (proactivity_level && !['high', 'medium', 'low'].includes(proactivity_level)) {
			throw new WorkerError('Invalid proactivity_level value', 400);
		}
		if (communication_style && !['brief', 'detailed', 'conversational'].includes(communication_style)) {
			throw new WorkerError('Invalid communication_style value', 400);
		}

		const supabaseAdmin = createSupabaseAdmin(env);

		// Build update object with only provided fields
		const updates: Record<string, string> = {};
		if (ai_tone) updates.ai_tone = ai_tone;
		if (proactivity_level) updates.proactivity_level = proactivity_level;
		if (communication_style) updates.communication_style = communication_style;

		// Update user preferences
		const { error: updateError } = await supabaseAdmin
			.from('user_profiles')
			.update(updates)
			.eq('user_id', user.userId);

		if (updateError) {
			logger.error('Failed to update user preferences', { error: updateError });
			throw new WorkerError('Failed to update preferences', 500);
		}

		logger.info('User preferences updated successfully', {
			userId: user.userId,
			updates
		});

		return new Response(
			JSON.stringify({
				success: true,
				preferences: updates
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		return handleError(error, 'update-preferences', corsHeaders);
	}
}
