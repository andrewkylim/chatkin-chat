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
import { EmailService } from '../services/email';
import { handleGenerateOnboarding } from './generate-onboarding';
import { handleGenerateNotes } from './generate-notes';

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

		// Generate onboarding content (projects + tasks) - fast
		logger.info('Starting onboarding content generation', { userId: user.userId });

		let tasksCreated = 0;
		let notesCreated = 0;

		try {
			const onboardingResponse = await handleGenerateOnboarding(request, env, corsHeaders);

			if (onboardingResponse.ok) {
				const result = (await onboardingResponse.json()) as {
					success: boolean;
					created?: { tasks: number; notes: number };
				};
				logger.info('Onboarding content generated successfully', {
					userId: user.userId,
					created: result.created
				});

				tasksCreated = result.created?.tasks || 0;
				notesCreated = result.created?.notes || 0;

				// Now trigger notes generation in background
				logger.info('Starting notes generation', { userId: user.userId });
				try {
					const notesResponse = await handleGenerateNotes(request, env, corsHeaders);

					if (notesResponse.ok) {
						const notesResult = (await notesResponse.json()) as {
							success: boolean;
							created?: { notes: number };
						};
						logger.info('Notes generated successfully', {
							userId: user.userId,
							created: notesResult.created
						});
					} else {
						const errorText = await notesResponse.text();
						logger.error('Notes generation failed', {
							userId: user.userId,
							status: notesResponse.status,
							error: errorText
						});
					}
				} catch (notesErr) {
					logger.error('Failed to generate notes', {
						userId: user.userId,
						error: notesErr
					});
				}
			} else {
				const errorText = await onboardingResponse.text();
				logger.error('Onboarding generation failed', {
					userId: user.userId,
					status: onboardingResponse.status,
					error: errorText
				});
				// Don't throw - profile was created successfully
			}
		} catch (err) {
			logger.error('Failed to generate onboarding content', {
				userId: user.userId,
				error: err
			});
			// Don't throw - profile was created successfully
		}

		// Send email notification that profile is ready
		if (user.email) {
			try {
				const emailService = new EmailService(env);

				const profileUrl = `${env.PUBLIC_WORKER_URL}/profile`;
				const emailHtml = emailService.profileReadyEmail(tasksCreated, notesCreated, profileUrl);

				await emailService.sendEmail({
					to: user.email,
					subject: '✨ Your Profile is Ready!',
					html: emailHtml
				});

				logger.info('Profile ready email sent', { userId: user.userId, email: user.email });
			} catch (emailErr) {
				logger.error('Failed to send profile ready email', {
					userId: user.userId,
					error: emailErr
				});
				// Don't throw - profile was created successfully
			}
		} else {
			logger.warn('No email address for user, skipping profile ready email', { userId: user.userId });
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

	const prompt = `You are a direct, honest coach analyzing life assessment responses. Your job is to tell the truth about what you see—patterns, contradictions, strengths, and blind spots.

DOMAIN SCORES:
${domainScoresText}

USER RESPONSES:
${responsesText}

Write an assessment report (800-1200 words) that speaks like a direct friend who tells the truth:

**Your Tone:**
- Direct and honest, not cheerleading or sycophantic
- Use the user's actual words, not euphemisms
- Name patterns clearly: "You say X but you're doing Y"
- Ask provocative questions that create self-awareness
- Acknowledge real struggles without toxic positivity
- Celebrate wins without inflating them

**What to Include:**

1. **What I'm Seeing** (3-4 sentences)
   - The big picture truth about where they are
   - Main pattern or theme across domains
   - What's working vs what's stuck

2. **Domain Breakdown** (each domain, be specific)
   For each domain (Body, Mind, Purpose, Connection, Growth, Finance):
   - What they said (use their words)
   - What that actually means (read between the lines)
   - The real blocker or pattern (not just symptoms)
   - One concrete thing to try (not vague advice)

3. **Patterns Worth Naming**
   - Contradictions between domains (e.g., "You say you want X but you're avoiding Y")
   - Avoidance patterns ("You didn't answer X questions directly")
   - Systemic issues ("This shows up in Body, Mind, AND Purpose")
   - Strengths being underused

4. **What to Try**
   - 2-3 specific experiments (not grand plans)
   - Why these, given what you see
   - What might get in the way

**Tone Examples:**
✅ "You scored low on sleep but high on work satisfaction. That math doesn't work long-term."
✅ "You say you want connection but you're 'uncomfortable being vulnerable.' Can't have one without the other."
✅ "Your Body and Finance domains are tanking while Purpose is thriving. That's not sustainable."

❌ "You're doing amazing! Just keep up the great work!" (too cheerleader-y)
❌ "Your challenges are completely valid and you're on a beautiful journey" (too therapy-speak)
❌ "I see tremendous growth potential in all your domains!" (too corporate coach-y)

FORMATTING RULES:
- No title or document heading
- Use ## for section headings
- Use bullet points with - for lists
- Use **bold** for emphasis
- NO horizontal rules (---)
- Start directly with content`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 4000,
		messages: [{ role: 'user', content: prompt }]
	});

	let report = message.content[0].text;

	// Ensure consistent spacing before "Try this:" and bold action items
	// Add line break before "Try this:" if it's not already there
	report = report.replace(/([^\n])\nTry this:/g, '$1\n\nTry this:');

	// Add line break before bold text that starts a sentence (action items)
	// but only if it's not already preceded by a line break
	report = report.replace(/([^\n])\n(\*\*[A-Z][^*]+\*\*)/g, '$1\n\n$2');

	return report;
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

	const prompt = `You are an expert psychologist and coach creating an internal psychological profile. This will be used by an AI assistant to coach this person effectively. Be direct, pattern-focused, and insightful.

DOMAIN SCORES (0-10 scale):
${domainScoresText}

COMPLETE USER RESPONSES (all questions):
${responsesText}

Create a psychological profile (400-600 words) that enables smart, personalized coaching. This is INTERNAL—the user won't see this. Be frank about patterns, blockers, and what's really going on.

**Profile Structure:**

1. **Current State** (2-3 sentences)
   - Life stage, circumstances, context
   - Primary roles and responsibilities
   - Current pressure points

2. **Psychological Patterns**
   - Core personality indicators (use their words as evidence)
   - How they handle stress, challenge, discomfort
   - Motivation drivers (what actually moves them vs what they say)
   - Self-talk and identity beliefs (growth vs fixed mindset)
   - Avoidance patterns (what they're not addressing)

3. **Domain Analysis** (be specific, use scores + responses)
   - **Body**: Health state, energy, barriers (score: X/10)
   - **Mind**: Emotional wellbeing, stress patterns, self-awareness (score: X/10)
   - **Purpose**: Work alignment, meaning, direction (score: X/10)
   - **Connection**: Relationship quality, support, vulnerability (score: X/10)
   - **Growth**: Learning orientation, challenge response (score: X/10)
   - **Finance**: Stability, resource concerns (score: X/10)

4. **Core Blockers** (root causes, not symptoms)
   - Primary obstacles preventing progress
   - Systemic patterns across domains
   - Identity/belief barriers ("I'm not the kind of person who...")
   - What they've tried before and why it failed

5. **What They Actually Want** (stated + implied)
   - Explicit goals they mentioned
   - Implicit needs (read between the lines)
   - Values driving their choices
   - How they define success

6. **Coaching Strategy** (how AI should work with them)
   - Priority focus areas (lowest-hanging fruit + highest leverage)
   - Tone that will land (direct challenge vs gentle support)
   - What questions to ask to create awareness
   - Experiments to suggest (given their blockers)
   - Timing considerations (what's ready now vs later)

**Guidelines:**
- Use their actual language as evidence ("They said 'X' which suggests Y")
- Name contradictions ("Says X but scored low on Y")
- Be specific about patterns ("Avoids vulnerability in Connection + Mind")
- Note what's NOT said ("Didn't mention support system at all")
- Identify leverage points ("If we fix sleep, everything else improves")

This profile informs: task creation, note suggestions, conversation tone, pattern detection, and strategic guidance.`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 2000,
		messages: [{ role: 'user', content: prompt }]
	});

	return message.content[0].text;
}
