/**
 * Generate notes endpoint - Runs after onboarding to create detailed notes
 * Takes longer but generates high-quality, comprehensive content
 */

import type { Env, CorsHeaders } from '../types';
import { createAnthropicClient } from '../ai/client';
import { requireAuth } from '../middleware/auth';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { createSupabaseAdmin } from '../utils/supabase-admin';

interface Note {
	domain: 'Body' | 'Mind' | 'Purpose' | 'Connection' | 'Growth' | 'Finance';
	title: string;
	content: string;
}

export async function handleGenerateNotes(
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
		logger.debug('Generating notes for user projects', { userId: user.userId });

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

		// Fetch user's 6 domain projects
		const { data: projects, error: projectsError } = await supabaseAdmin
			.from('projects')
			.select('id, domain')
			.eq('user_id', user.userId)
			.order('created_at', { ascending: true });

		if (projectsError || !projects || projects.length === 0) {
			logger.error('Failed to fetch projects', { error: projectsError });
			throw new WorkerError('No projects found for user', 404);
		}

		// Create domain -> project_id mapping
		const domainMap = new Map<string, string>();
		for (const project of projects) {
			domainMap.set(project.domain, project.id);
		}

		// Generate all notes in one call (faster for 6 domains)
		const client = createAnthropicClient(env.ANTHROPIC_API_KEY);

		logger.info('Generating notes for all 6 domains');

		const allNotes = await generateAllNotes(
			client,
			profile.profile_summary,
			results.domain_scores
		);

		// Create notes in database with note_blocks
		for (const note of allNotes) {
			const projectId = domainMap.get(note.domain);
			if (!projectId) {
				logger.warn('Project not found for note', { domain: note.domain });
				continue;
			}

			// Create note entry
			const { data: createdNote, error: noteError } = await supabaseAdmin
				.from('notes')
				.insert({
					user_id: user.userId,
					project_id: projectId,
					title: note.title
				})
				.select('id')
				.single();

			if (noteError) {
				logger.error('Failed to create note', { error: noteError, note });
				continue;
			}

			// Create note_block with content
			if (createdNote) {
				const { error: blockError } = await supabaseAdmin
					.from('note_blocks')
					.insert({
						note_id: createdNote.id,
						type: 'text',
						content: { text: note.content },
						position: 0
					});

				if (blockError) {
					logger.error('Failed to create note block', { error: blockError, noteId: createdNote.id });
					// Don't throw - note was created successfully
				}
			}
		}

		logger.info('Notes generated successfully', {
			userId: user.userId,
			notes: allNotes.length
		});

		return new Response(
			JSON.stringify({
				success: true,
				created: {
					notes: allNotes.length
				}
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		return handleError(error, 'generate-notes', corsHeaders);
	}
}

async function generateAllNotes(
	client: any,
	profileSummary: string,
	domainScores: any
): Promise<Note[]> {
	const domainScoresText = Object.entries(domainScores)
		.map(([domain, score]) => `- ${domain}: ${score}/10`)
		.join('\n');

	const notesPerDomain = 2;
	const expectedNotes = 6 * notesPerDomain; // 12 notes total

	const prompt = `Generate ${expectedNotes} strategic, actionable reference notes across the 6 wellness domains (${notesPerDomain} notes per domain):

1. Body - Physical health, fitness, nutrition, sleep
2. Mind - Mental & emotional wellbeing, stress management
3. Purpose - Career, work, goals, meaning, productivity
4. Connection - Relationships, family, friends, community
5. Growth - Learning, education, skills, hobbies
6. Finance - Money, budgets, investments, savings

USER PROFILE CONTEXT:
${profileSummary.substring(0, 600)}

DOMAIN SCORES:
${domainScoresText}

Create notes that provide genuine value:
- Frameworks & Mental Models (decision-making tools, strategic approaches)
- Resources & Tools (specific apps, books, services, templates)
- Action Plans & Strategies (step-by-step guides for common challenges)
- Key Insights (personalized takeaways from their assessment)

CONTENT REQUIREMENTS:
- Each note: 200-400 words of genuinely useful, detailed content
- Use markdown formatting (headers, lists, bold for emphasis)
- Make it actionable and specific to their situation and domain scores
- ${notesPerDomain} comprehensive notes per domain
- Total: ${expectedNotes} notes

Return ONLY a valid JSON array:
[
  {
    "domain": "Body|Mind|Purpose|Connection|Growth|Finance",
    "title": "Clear, descriptive note title (max 60 chars)",
    "content": "Detailed markdown content (200-400 words)"
  }
]

CRITICAL REQUIREMENTS:
1. Use EXACT domain names (Body, Mind, Purpose, Connection, Growth, Finance)
2. Generate exactly ${expectedNotes} notes (${notesPerDomain} per domain)
3. Each note should be 200-400 words of useful content
4. Return ONLY valid JSON - start with [ and end with ]
5. Ensure complete, parseable JSON (don't truncate)`;

	const message = await client.messages.create({
		model: 'claude-3-5-haiku-20241022',
		max_tokens: 8000, // Higher limit for quality content
		messages: [{ role: 'user', content: prompt }]
	});

	const responseText = message.content[0].text.trim();
	let jsonText = responseText;

	// Remove markdown code blocks if present
	if (responseText.startsWith('```')) {
		jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
	}

	// Find the JSON array
	const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		logger.error('Failed to parse notes response', {
			responseText: responseText.substring(0, 500)
		});
		throw new WorkerError('Failed to parse notes', 500);
	}

	try {
		const parsed = JSON.parse(jsonMatch[0]);
		logger.info('Notes generated successfully', {
			count: parsed.length,
			expected: expectedNotes
		});
		return parsed;
	} catch (err) {
		logger.error('Failed to parse notes JSON', {
			error: err,
			json: jsonMatch[0].substring(0, 500)
		});
		throw new WorkerError('Failed to parse notes JSON', 500);
	}
}
