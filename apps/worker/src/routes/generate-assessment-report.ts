/**
 * Generate assessment report endpoint
 * Calculates domain scores and generates AI-powered profile analysis
 */

import type { Env, CorsHeaders } from '../types';
import { createAnthropicClient } from '../ai/client';
import { requireAuth } from '../middleware/auth';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { createSupabaseAdmin } from '../utils/supabase-admin';

interface QuestionResponse {
	question_id: string;
	response_value: string | null;
	response_text: string | null;
	assessment_questions: {
		domain: string;
		question_text: string;
		question_type: string;
		weight: number;
		options: any;
	} | null;
}

interface DomainScores {
	[domain: string]: number;
}

export async function handleGenerateAssessmentReport(
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
		logger.debug('Generating assessment report', { userId: user.userId });

		const supabaseAdmin = createSupabaseAdmin(env);

		// Fetch all user responses with questions
		const { data: responses, error: responsesError } = await supabaseAdmin
			.from('assessment_responses')
			.select(
				`
				question_id,
				response_value,
				response_text,
				assessment_questions (
					domain,
					question_text,
					question_type,
					weight,
					options
				)
			`
			)
			.eq('user_id', user.userId);

		if (responsesError) {
			logger.error('Failed to fetch responses', { error: responsesError });
			throw new WorkerError('Failed to fetch questionnaire responses', 500);
		}

		if (!responses || responses.length === 0) {
			throw new WorkerError('No questionnaire responses found', 404);
		}

		// Calculate domain scores
		const domainScores = calculateDomainScores(responses as unknown as QuestionResponse[]);
		logger.debug('Calculated domain scores', { domainScores });

		// Generate AI report
		const client = createAnthropicClient(env.ANTHROPIC_API_KEY);
		const aiReport = await generateAIReport(client, responses as unknown as QuestionResponse[], domainScores);

		// Generate profile summary for AI context
		const profileSummary = await generateProfileSummary(
			client,
			responses as unknown as QuestionResponse[],
			domainScores
		);

		// Determine communication tone
		const avgScore =
			Object.values(domainScores).reduce((sum, score) => sum + score, 0) /
			Object.keys(domainScores).length;
		const tone = avgScore < 5 ? 'supportive' : avgScore < 7 ? 'encouraging' : 'motivational';

		// Identify focus areas (lowest 3 scoring domains)
		const focusAreas = Object.entries(domainScores)
			.sort(([, a], [, b]) => a - b)
			.slice(0, 3)
			.map(([domain]) => domain);

		// Save results
		const { error: resultsError } = await supabaseAdmin.from('assessment_results').upsert(
			{
				user_id: user.userId,
				domain_scores: domainScores,
				ai_report: aiReport,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'user_id' }
		);

		if (resultsError) {
			logger.error('Failed to save assessment results', { error: resultsError });
			throw new WorkerError('Failed to save assessment results', 500);
		}

		// Update user profile
		const { error: profileError } = await supabaseAdmin.from('user_profiles').upsert(
			{
				user_id: user.userId,
				profile_summary: profileSummary,
				communication_tone: tone,
				focus_areas: focusAreas,
				last_profile_update: new Date().toISOString(),
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'user_id' }
		);

		if (profileError) {
			logger.error('Failed to update user profile', { error: profileError });
			throw new WorkerError('Failed to update user profile', 500);
		}

		logger.info('Assessment report generated successfully', { userId: user.userId });

		// Trigger onboarding content generation in background
		try {
			// Create a new request to the onboarding endpoint
			const onboardingUrl = new URL(request.url);
			onboardingUrl.pathname = '/api/generate-onboarding';

			// Get auth token from original request
			const authHeader = request.headers.get('Authorization');

			fetch(onboardingUrl.toString(), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(authHeader ? { Authorization: authHeader } : {})
				}
			}).catch((err) => {
				logger.error('Failed to trigger onboarding generation', { error: err });
			});
		} catch (err) {
			logger.warn('Could not trigger onboarding generation', { error: err });
		}

		return new Response(
			JSON.stringify({
				success: true,
				domain_scores: domainScores,
				communication_tone: tone,
				focus_areas: focusAreas
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		return handleError(error, 'generate-assessment-report', corsHeaders);
	}
}

function calculateDomainScores(responses: QuestionResponse[]): DomainScores {
	const domainGroups: { [domain: string]: QuestionResponse[] } = {};

	// Group responses by domain
	responses.forEach((response) => {
		if (!response.assessment_questions) return;
		const domain = response.assessment_questions.domain;
		if (!domainGroups[domain]) {
			domainGroups[domain] = [];
		}
		domainGroups[domain].push(response);
	});

	const domainScores: DomainScores = {};

	// Calculate score for each domain
	Object.entries(domainGroups).forEach(([domain, domainResponses]) => {
		let totalWeightedScore = 0;
		let totalWeight = 0;

		domainResponses.forEach((response) => {
			const question = response.assessment_questions;
			if (!question) return;
			let score = 0;

			// Get score based on question type
			if (question.question_type === 'scale' || question.question_type === 'emoji_scale') {
				// Direct numeric value (1-5)
				score = parseFloat(response.response_value || '0');
			} else if (question.question_type === 'multiple_choice' && question.options) {
				// Find the score from the selected option
				const options = question.options as Array<{ value: string; score: number }>;
				const selectedOption = options.find((opt) => opt.value === response.response_value);
				score = selectedOption ? selectedOption.score : 0;
			}
			// open_ended questions don't contribute to numeric score

			// Apply weight
			const weight = question.weight || 1.0;
			totalWeightedScore += score * weight;
			totalWeight += weight;
		});

		// Calculate average score (normalized to 0-10 scale)
		// Assuming max score per question is 5, so multiply by 2 to get 0-10
		const avgScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 2 : 0;
		domainScores[domain] = Math.round(avgScore * 10) / 10; // Round to 1 decimal place
	});

	return domainScores;
}

async function generateAIReport(
	client: any,
	responses: QuestionResponse[],
	domainScores: DomainScores
): Promise<string> {
	const responsesText = responses
		.filter((r) => r.assessment_questions)
		.map((r) => {
			const answer = r.response_value || r.response_text || 'No response';
			return `Q: ${r.assessment_questions!.question_text}\nA: ${answer}`;
		})
		.join('\n\n');

	const domainScoresText = Object.entries(domainScores)
		.map(([domain, score]) => `- ${domain}: ${score.toFixed(1)}/10`)
		.join('\n');

	const prompt = `You are a life assessment expert analyzing wellness questionnaire responses.

DOMAIN SCORES:
${domainScoresText}

USER RESPONSES:
${responsesText}

Generate a comprehensive, personalized wellness report (800-1200 words) with:
1. Overall assessment and key insights
2. Detailed analysis for each domain (Body, Mind, Purpose, Connection, Growth, Security)
3. Specific, actionable recommendations
4. Patterns and connections across domains
5. Encouraging tone that acknowledges strengths and growth areas

Format with clear sections and bullet points for readability.`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4',
		max_tokens: 4000,
		messages: [{ role: 'user', content: prompt }]
	});

	return message.content[0].text;
}

async function generateProfileSummary(
	client: any,
	responses: QuestionResponse[],
	domainScores: DomainScores
): Promise<string> {
	const responsesText = responses
		.filter((r) => r.assessment_questions)
		.map((r) => {
			const answer = r.response_value || r.response_text || 'No response';
			return `Q: ${r.assessment_questions!.question_text}\nA: ${answer}`;
		})
		.join('\n\n');

	const domainScoresText = Object.entries(domainScores)
		.map(([domain, score]) => `- ${domain}: ${score.toFixed(1)}/10`)
		.join('\n');

	const prompt = `You are an expert psychologist, life strategist, and executive coach analyzing a comprehensive wellness assessment.

DOMAIN SCORES (0-10 scale):
${domainScoresText}

COMPLETE USER RESPONSES (all 35 questions):
${responsesText}

Create a comprehensive psychological profile (400-600 words) suitable for AI assistant context. This will be stored and used to inform ALL future AI interactions.

Analyze like a professional would:

1. **Current Life Situation** (2-3 sentences)
   - Overall life stage and circumstances
   - Primary responsibilities and roles
   - Key environmental/contextual factors

2. **Psychological Profile**
   - Core personality indicators from responses
   - Emotional patterns and coping mechanisms
   - Motivation drivers and values
   - Cognitive/behavioral tendencies

3. **Domain Analysis** (ALL 6 domains - don't skip any)
   - Body: Physical health state, energy patterns, barriers
   - Mind: Mental/emotional wellbeing, stress patterns, self-awareness
   - Purpose: Career/work alignment, meaning-making, direction
   - Connection: Relationship quality, support systems, social needs
   - Growth: Learning orientation, development areas, potential
   - Security: Financial/stability concerns, resource management

4. **Core Challenges & Blockers**
   - Primary obstacles across domains
   - Systemic issues or patterns
   - Root causes (not just symptoms)

5. **Goals & Aspirations**
   - Stated and implied objectives
   - Areas of desired growth
   - Success definitions

6. **Strategic Recommendations**
   - Priority focus areas (ranked by impact)
   - Intervention points for maximum leverage
   - Timing and sequencing considerations

This profile will inform personalized task/note creation, communication style, and strategic recommendations. Be specific, insightful, and actionable.`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4',
		max_tokens: 2000,
		messages: [{ role: 'user', content: prompt }]
	});

	return message.content[0].text;
}
