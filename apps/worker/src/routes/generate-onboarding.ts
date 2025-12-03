/**
 * Generate onboarding content endpoint - Multi-call optimized version
 * Creates comprehensive life plan with projects, tasks, and notes via multiple fast AI calls
 */

import type { Env, CorsHeaders } from '../types';
import { createAnthropicClient } from '../ai/client';
import { requireAuth } from '../middleware/auth';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { createSupabaseAdmin } from '../utils/supabase-admin';

interface OnboardingContent {
	starterTasks: Array<{
		domain: 'Body' | 'Mind' | 'Purpose' | 'Connection' | 'Growth' | 'Finance';
		title: string;
		description: string;
		priority: 'low' | 'medium' | 'high';
		status: 'todo';
	}>;
	domainPrimers: Array<{
		domain: 'Body' | 'Mind' | 'Purpose' | 'Connection' | 'Growth' | 'Finance';
		title: string;
		content: string;
	}>;
}

export async function handleGenerateOnboarding(
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
		logger.debug('Generating onboarding content', { userId: user.userId });

		const supabaseAdmin = createSupabaseAdmin(env);

		// Fetch user profile and assessment results
		const { data: profile, error: profileError } = await supabaseAdmin
			.from('user_profiles')
			.select('profile_summary, focus_areas')
			.eq('user_id', user.userId)
			.single();

		if (profileError || !profile) {
			logger.error('Failed to fetch user profile', { error: profileError });
			throw new WorkerError('User profile not found', 404);
		}

		const { data: results, error: resultsError } = await supabaseAdmin
			.from('assessment_results')
			.select('domain_scores')
			.eq('user_id', user.userId)
			.single();

		if (resultsError || !results) {
			logger.error('Failed to fetch assessment results', { error: resultsError });
			throw new WorkerError('Assessment results not found', 404);
		}


		// Generate onboarding content (starter tasks + domain primers)
		const client = createAnthropicClient(env.ANTHROPIC_API_KEY);
		const onboardingContent = await generateOnboardingContent(
			client,
			profile.profile_summary,
			results.domain_scores,
		);

		// 1. Create 3-5 starter tasks (using domain directly)
		const tasksToCreate = onboardingContent.starterTasks.map((task) => ({
			user_id: user.userId,
			domain: task.domain,
			title: task.title,
			description: task.description,
			priority: task.priority,
			status: task.status
		}));

		if (tasksToCreate.length > 0) {
			const { error: tasksError } = await supabaseAdmin.from('tasks').insert(tasksToCreate);

			if (tasksError) {
				logger.error('Failed to create starter tasks', { error: tasksError });
			}
		}

		// 2. Create 6 domain primer notes with note_blocks (using domain directly)
		for (const note of onboardingContent.domainPrimers) {
			// Insert note first
			const { data: createdNote, error: noteError } = await supabaseAdmin
				.from('notes')
				.insert({
					user_id: user.userId,
					domain: note.domain,
					title: note.title,
					is_system_generated: true
				})
				.select()
				.single();

			if (noteError) {
				logger.error('Failed to create domain primer note', { error: noteError });
				continue;
			}

			// Then insert note_block with content
			const { error: blockError } = await supabaseAdmin.from('note_blocks').insert({
				note_id: createdNote.id,
				type: 'text',
				content: { text: note.content },
				position: 0
			});

			if (blockError) {
				logger.error('Failed to create note block', { error: blockError });
			}
		}

		logger.info('Onboarding content generated successfully', {
			userId: user.userId,
			starterTasks: tasksToCreate.length,
			domainPrimers: onboardingContent.domainPrimers.length
		});

		return new Response(
			JSON.stringify({
				success: true,
				created: {
					tasks: tasksToCreate.length,
					notes: onboardingContent.domainPrimers.length
				}
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		return handleError(error, 'generate-onboarding', corsHeaders);
	}
}

async function generateOnboardingContent(
	client: any,
	profileSummary: string,
	domainScores: any,
): Promise<OnboardingContent> {
	const domainScoresText = Object.entries(domainScores)
		.map(([domain, score]) => `- ${domain}: ${score}/10`)
		.join('\n');

	// Generate starter tasks and domain primers in parallel for speed
	logger.info('Generating onboarding content (tasks + primers)...');

	const [starterTasks, domainPrimers] = await Promise.all([
		generateStarterTasks(client, profileSummary, domainScoresText, domainScores),
		generateDomainPrimers(client, profileSummary, domainScoresText)
	]);

	return { starterTasks, domainPrimers };
}

async function generateStarterTasks(
	client: any,
	profileSummary: string,
	domainScoresText: string,
	domainScores: any
): Promise<OnboardingContent['starterTasks']> {
	// Identify focus areas (lowest 3 scoring domains)
	const focusAreas = Object.entries(domainScores)
		.sort(([, a]: any, [, b]: any) => a - b)
		.slice(0, 3)
		.map(([domain]) => domain);

	const prompt = `You are creating a comprehensive life plan with up to 5 tasks per domain (up to 30 tasks total). These are ACTUAL tasks that will appear in their workspace.

PROFILE SUMMARY:
${profileSummary.substring(0, 800)}

DOMAIN SCORES:
${domainScoresText}

FOCUS AREAS (lowest scoring): ${focusAreas.join(', ')}

**Task Distribution by Score:**
- Low-scoring domains (1-4): Create 5 tasks, mostly medium/high priority
- Mid-scoring domains (5-7): Create 3-4 tasks, mixed priority
- High-scoring domains (8-10): Create 2-3 tasks, mostly low priority

**Task Types to Mix:**
- **Quick wins** (5-10 min actions): "Schedule doctor appointment", "Text [friend] to reconnect"
- **Experiments** (low-commitment tests): "Try 10-min walk after dinner Mon/Wed/Fri"
- **Reflections** (structured thinking): "Journal: What am I avoiding in [domain]?"
- **Deep work** (significant but important): "Research financial advisors", "Draft career vision"
- **Habits** (recurring patterns): "Daily 5-min meditation", "Weekly budget review"

**Requirements:**
1. **Specific and actionable** (never vague like "exercise more")
2. **Connect to their assessment** (use actual insights from profile)
3. **Prioritized by domain score** (struggling domains get urgent/important tasks)
4. **Varied difficulty** (mix of easy wins and deeper work)
5. **Realistic** (they should feel empowered, not overwhelmed)

Return ONLY JSON array (20-30 tasks distributed across all 6 domains):
[
  {"domain": "Body|Mind|Purpose|Connection|Growth|Finance", "title": "Task title (max 60 chars)", "description": "What and why (max 150 chars)", "priority": "low|medium|high", "status": "todo"}
]

CRITICAL: Use EXACT domain names. Create 20-30 tasks total. Weight toward lower-scoring domains.`;

	const message = await client.messages.create({
		model: 'claude-3-5-haiku-20241022',
		max_tokens: 3000,
		messages: [{ role: 'user', content: prompt }]
	});

	const responseText = message.content[0].text.trim();
	const jsonMatch = responseText.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		logger.error('Failed to parse starter tasks', { responseText: responseText.substring(0, 500) });
		throw new WorkerError('Failed to parse starter tasks', 500);
	}

	return JSON.parse(jsonMatch[0]);
}

async function generateDomainPrimers(
	client: any,
	profileSummary: string,
	domainScoresText: string
): Promise<OnboardingContent['domainPrimers']> {
	const prompt = `You are creating 6 detailed domain analysis notes—one for each wellness domain. These are comprehensive (500-800 words) notes that serve as a personalized guide for each area of their life.

PROFILE SUMMARY:
${profileSummary.substring(0, 1200)}

DOMAIN SCORES:
${domainScoresText}

Create 6 detailed domain notes (one per domain: Body, Mind, Purpose, Connection, Growth, Finance) that each contain:

**Structure for each note:**
1. **Current State** (2-3 paragraphs, ~200 words)
   - What their assessment reveals about this domain
   - Their score and what it actually means
   - Specific patterns, behaviors, or struggles they mentioned

2. **Key Insights** (2-3 paragraphs, ~150 words)
   - Patterns or contradictions you noticed
   - What's working and what's not
   - Connections between their answers
   - Blind spots or avoidance areas

3. **What Matters Here** (1-2 paragraphs, ~100 words)
   - Why this domain is important for their specific situation
   - How it connects to other domains
   - What changes here could ripple elsewhere

4. **Recommendations** (2-3 paragraphs, ~150 words)
   - Specific, actionable suggestions based on their profile
   - Quick wins and longer-term strategies
   - What to start, stop, or change
   - Not generic advice—tailored to what they actually said

**Tone:** Direct, honest, insightful. Not cheerleading or therapy-speak. More like a smart friend who sees the whole picture.

**Length:** 500-800 words per note (substantial, not brief)

Return ONLY JSON array (exactly 6 notes, one per domain):
[
  {"domain": "Body|Mind|Purpose|Connection|Growth|Finance", "title": "[Domain]: Your Current Reality", "content": "500-800 word detailed analysis following the structure above"}
]

CRITICAL: Use EXACT domain names. Generate exactly 6 detailed notes. Make them personal and specific using their actual assessment data.`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 8000,
		messages: [{ role: 'user', content: prompt }]
	});

	const responseText = message.content[0].text.trim();
	const jsonMatch = responseText.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		logger.error('Failed to parse domain primers', { responseText: responseText.substring(0, 500) });
		throw new WorkerError('Failed to parse domain primers', 500);
	}

	return JSON.parse(jsonMatch[0]);
}
