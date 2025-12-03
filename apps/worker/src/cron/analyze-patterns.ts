/**
 * Pattern Analysis Cron Job
 * Runs daily at 2am UTC to detect behavioral patterns
 * Creates coach observations for proactive coaching
 */

import type { Env } from '../types';
import { createSupabaseAdmin } from '../utils/supabase-admin';
import { createPatternAnalyzer } from '../services/pattern-analyzer';
import { logger } from '../utils/logger';

export async function analyzePatterns(env: Env): Promise<void> {
	logger.info('Starting daily pattern analysis...');

	const supabase = createSupabaseAdmin(env);
	const analyzer = createPatternAnalyzer(supabase);

	try {
		// Get active users (engaged in last 30 days or have completed questionnaire)
		const { data: profiles, error } = await supabase
			.from('user_profiles')
			.select('user_id, last_active, has_completed_questionnaire')
			.eq('has_completed_questionnaire', true);

		if (error) {
			logger.error('Failed to fetch user profiles', { error });
			return;
		}

		if (!profiles || profiles.length === 0) {
			logger.info('No users to analyze');
			return;
		}

		let totalObservations = 0;

		for (const profile of profiles) {
			try {
				// Analyze patterns for this user
				const observations = await analyzer.analyzeUserPatterns(profile.user_id);

				if (observations.length > 0) {
					// Store observations in database
					const { error: insertError } = await supabase.from('coach_observations').insert(
						observations.map((obs) => ({
							user_id: profile.user_id,
							observation_type: obs.observation_type,
							content: obs.content,
							data_summary: obs.data_summary,
							priority: obs.priority
						}))
					);

					if (insertError) {
						logger.error('Failed to insert observations', {
							userId: profile.user_id,
							error: insertError
						});
					} else {
						totalObservations += observations.length;
						logger.debug('Observations created', {
							userId: profile.user_id,
							count: observations.length
						});
					}
				}
			} catch (error) {
				logger.error('Failed to analyze user patterns', {
					userId: profile.user_id,
					error
				});
			}
		}

		logger.info('Pattern analysis complete', {
			usersAnalyzed: profiles.length,
			observationsCreated: totalObservations
		});
	} catch (error) {
		logger.error('Pattern analysis failed', { error });
		throw error;
	}
}
