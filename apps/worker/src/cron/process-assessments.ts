/**
 * Cron job to process unprocessed assessment onboarding
 * Runs every 5 minutes to check for assessments that need tasks/notes generated
 */

import type { Env } from '../types';
import { logger } from '../utils/logger';
import { createSupabaseAdmin } from '../utils/supabase-admin';
import { handleGenerateOnboarding } from '../routes/generate-onboarding';
import { handleGenerateNotes } from '../routes/generate-notes';
import { EmailService } from '../services/email';

export async function processUnprocessedAssessments(env: Env): Promise<void> {
	logger.info('Checking for unprocessed assessments...');

	const supabaseAdmin = createSupabaseAdmin(env);

	// Find assessments that haven't been processed yet (within last 24 hours to avoid old ones)
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

	const { data: unprocessed, error } = await supabaseAdmin
		.from('assessment_results')
		.select('user_id, updated_at')
		.eq('onboarding_processed', false)
		.gte('updated_at', oneDayAgo)
		.order('updated_at', { ascending: true })
		.limit(10); // Process up to 10 at a time

	if (error) {
		logger.error('Failed to fetch unprocessed assessments', { error });
		return;
	}

	if (!unprocessed || unprocessed.length === 0) {
		logger.info('No unprocessed assessments found');
		return;
	}

	logger.info('Found unprocessed assessments', { count: unprocessed.length });

	// Process each assessment
	for (const assessment of unprocessed) {
		try {
			const userId = assessment.user_id;
			logger.info('Processing assessment onboarding', { userId });

			// Get user email
			const { data: _profile } = await supabaseAdmin
				.from('user_profiles')
				.select('user_id')
				.eq('user_id', userId)
				.single();

			// Get user email from auth
			const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();

			if (authError) {
				logger.error('Failed to get user email', { userId, error: authError });
				continue;
			}

			const user = users.find(u => u.id === userId);
			const userEmail = user?.email || null;

			let tasksCreated = 0;
			let notesCreated = 0;

			// Create fake request/CORS headers for the handlers
			const fakeRequest = new Request('http://internal/cron', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Internal-User-ID': userId
				}
			});

			const corsHeaders = {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				'Access-Control-Allow-Credentials': 'true'
			};

			// Generate onboarding content (tasks + notes)
			try {
				const onboardingResponse = await handleGenerateOnboarding(fakeRequest, env, corsHeaders);

				if (onboardingResponse.ok) {
					const result = await onboardingResponse.json() as {
						success: boolean;
						created?: { tasks: number; notes: number };
					};
					tasksCreated = result.created?.tasks || 0;
					notesCreated = result.created?.notes || 0;
					logger.info('Onboarding content generated', { userId, tasksCreated, notesCreated });
				} else {
					logger.error('Onboarding generation failed', {
						userId,
						status: onboardingResponse.status,
						error: await onboardingResponse.text()
					});
				}
			} catch (err) {
				logger.error('Failed to generate onboarding', { userId, error: err });
			}

			// Generate notes
			try {
				const notesResponse = await handleGenerateNotes(fakeRequest, env, corsHeaders);

				if (notesResponse.ok) {
					logger.info('Notes generated successfully', { userId });
				} else {
					logger.error('Notes generation failed', {
						userId,
						status: notesResponse.status
					});
				}
			} catch (err) {
				logger.error('Failed to generate notes', { userId, error: err });
			}

			// Send email notification
			if (userEmail) {
				try {
					const emailService = new EmailService(env);
					const profileUrl = `${env.PUBLIC_WORKER_URL}/profile`;
					const emailHtml = emailService.profileReadyEmail(tasksCreated, notesCreated, profileUrl);

					await emailService.sendEmail({
						to: userEmail,
						subject: '✨ Your Profile is Ready!',
						html: emailHtml
					});

					logger.info('Profile ready email sent', { userId });
				} catch (emailErr) {
					logger.error('Failed to send email', { userId, error: emailErr });
				}
			}

			// Mark as processed
			const { error: updateError } = await supabaseAdmin
				.from('assessment_results')
				.update({
					onboarding_processed: true,
					onboarding_processed_at: new Date().toISOString()
				})
				.eq('user_id', userId);

			if (updateError) {
				logger.error('Failed to mark assessment as processed', { userId, error: updateError });
			} else {
				logger.info('Assessment processing completed', { userId, tasksCreated, notesCreated });
			}

		} catch (err) {
			logger.error('Failed to process assessment', { error: err });
		}
	}

	logger.info('Assessment processing batch completed', { processed: unprocessed.length });
}
