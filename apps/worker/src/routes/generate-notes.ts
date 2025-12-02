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
	project_name: string;
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

		// Fetch user's projects
		const { data: projects, error: projectsError } = await supabaseAdmin
			.from('projects')
			.select('id, name')
			.eq('user_id', user.userId)
			.order('created_at', { ascending: true });

		if (projectsError || !projects || projects.length === 0) {
			logger.error('Failed to fetch projects', { error: projectsError });
			throw new WorkerError('No projects found for user', 404);
		}

		// Generate notes in batches (3-4 projects per batch)
		const client = createAnthropicClient(env.ANTHROPIC_API_KEY);
		const batchSize = 3;
		const batches = Math.ceil(projects.length / batchSize);

		const allNotes: Note[] = [];

		for (let i = 0; i < batches; i++) {
			const start = i * batchSize;
			const end = Math.min(start + batchSize, projects.length);
			const batchProjects = projects.slice(start, end);

			logger.info(`Generating notes batch ${i + 1}/${batches}`, {
				projects: batchProjects.length
			});

			const batchNotes = await generateNotesBatch(
				client,
				profile.profile_summary,
				results.domain_scores,
				batchProjects,
				i + 1
			);

			allNotes.push(...batchNotes);
		}

		// Create notes in database with note_blocks
		for (const note of allNotes) {
			const project = projects.find((p) => p.name === note.project_name);
			if (!project) {
				logger.warn('Project not found for note', { project_name: note.project_name });
				continue;
			}

			// Create note entry
			const { data: createdNote, error: noteError } = await supabaseAdmin
				.from('notes')
				.insert({
					user_id: user.userId,
					project_id: project.id,
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

async function generateNotesBatch(
	client: any,
	profileSummary: string,
	domainScores: any,
	projects: Array<{ id: string; name: string }>,
	batchNumber: number
): Promise<Note[]> {
	const domainScoresText = Object.entries(domainScores)
		.map(([domain, score]) => `- ${domain}: ${score}/10`)
		.join('\n');

	const projectNames = projects.map((p) => p.name).join('\n- ');
	const notesPerProject = 2;
	const expectedNotes = projects.length * notesPerProject;

	const prompt = `Generate ${expectedNotes} strategic, actionable reference notes for these ${projects.length} projects (${notesPerProject} notes per project):
- ${projectNames}

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
- Make it actionable and specific to their situation
- ${notesPerProject} comprehensive notes per project
- Total: ${expectedNotes} notes

Return ONLY a valid JSON array:
[
  {
    "project_name": "exact project name from list above",
    "title": "Clear, descriptive note title (max 60 chars)",
    "content": "Detailed markdown content (200-400 words)"
  }
]

CRITICAL REQUIREMENTS:
1. Use EXACT project names from the list
2. Generate exactly ${expectedNotes} notes (${notesPerProject} per project)
3. Each note should be 200-400 words of useful content
4. Return ONLY valid JSON - start with [ and end with ]
5. Ensure complete, parseable JSON (don't truncate)`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4-20250514',
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
		logger.error(`Failed to parse notes batch ${batchNumber}`, {
			responseText: responseText.substring(0, 500),
			batchNumber
		});
		throw new WorkerError(`Failed to parse notes batch ${batchNumber}`, 500);
	}

	try {
		const parsed = JSON.parse(jsonMatch[0]);
		logger.info(`Notes batch ${batchNumber} generated successfully`, {
			count: parsed.length,
			expected: expectedNotes
		});
		return parsed;
	} catch (err) {
		logger.error(`Failed to parse notes batch ${batchNumber} JSON`, {
			error: err,
			json: jsonMatch[0].substring(0, 500),
			batchNumber
		});
		throw new WorkerError(`Failed to parse notes batch ${batchNumber} JSON`, 500);
	}
}
