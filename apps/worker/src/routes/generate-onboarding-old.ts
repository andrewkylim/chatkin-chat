/**
 * Generate onboarding content endpoint
 * Creates comprehensive life plan with projects, tasks, and notes based on assessment
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Env, CorsHeaders } from '../types';
import { createAnthropicClient } from '../ai/client';
import { requireAuth } from '../middleware/auth';
import { handleError, WorkerError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { createSupabaseAdmin } from '../utils/supabase-admin';

interface OnboardingContent {
	projects: Array<{
		name: string;
		description: string;
		color: string;
	}>;
	tasks: Array<{
		project_name: string;
		title: string;
		description: string;
		priority: 'low' | 'medium' | 'high';
		status: 'todo';
	}>;
	notes: Array<{
		project_name: string;
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

		// Fetch all responses for detailed context
		const { data: responses, error: responsesError } = await supabaseAdmin
			.from('assessment_responses')
			.select(
				`
				response_value,
				response_text,
				assessment_questions (
					question_text,
					domain
				)
			`
			)
			.eq('user_id', user.userId);

		if (responsesError) {
			logger.error('Failed to fetch responses', { error: responsesError });
			throw new WorkerError('Failed to fetch questionnaire responses', 500);
		}

		// Generate onboarding content
		const client = createAnthropicClient(env.ANTHROPIC_API_KEY);
		const onboardingContent = await generateOnboardingContent(
			client,
			profile.profile_summary,
			results.domain_scores,
			responses || []
		);

		// Create projects first
		const projectMap = new Map<string, string>(); // project_name -> project_id

		for (const project of onboardingContent.projects) {
			const { data: createdProject, error: projectError } = await supabaseAdmin
				.from('projects')
				.insert({
					user_id: user.userId,
					name: project.name,
					description: project.description,
					color: project.color
				})
				.select('id, name')
				.single();

			if (projectError) {
				logger.error('Failed to create project', { error: projectError, project });
				continue;
			}

			if (createdProject) {
				projectMap.set(project.name, createdProject.id);
			}
		}

		// Create tasks
		const tasksToCreate = onboardingContent.tasks
			.map((task) => {
				const projectId = projectMap.get(task.project_name);
				if (!projectId) return null;

				return {
					user_id: user.userId,
					project_id: projectId,
					title: task.title,
					description: task.description,
					priority: task.priority,
					status: task.status
				};
			})
			.filter((t) => t !== null);

		if (tasksToCreate.length > 0) {
			const { error: tasksError } = await supabaseAdmin.from('tasks').insert(tasksToCreate);

			if (tasksError) {
				logger.error('Failed to create tasks', { error: tasksError });
			}
		}

		// Create notes
		const notesToCreate = onboardingContent.notes
			.map((note) => {
				const projectId = projectMap.get(note.project_name);
				if (!projectId) return null;

				return {
					user_id: user.userId,
					project_id: projectId,
					title: note.title,
					content: note.content
				};
			})
			.filter((n) => n !== null);

		if (notesToCreate.length > 0) {
			const { error: notesError } = await supabaseAdmin.from('notes').insert(notesToCreate);

			if (notesError) {
				logger.error('Failed to create notes', { error: notesError });
			}
		}

		logger.info('Onboarding content generated successfully', {
			userId: user.userId,
			projects: onboardingContent.projects.length,
			tasks: tasksToCreate.length,
			notes: notesToCreate.length
		});

		return new Response(
			JSON.stringify({
				success: true,
				created: {
					projects: onboardingContent.projects.length,
					tasks: tasksToCreate.length,
					notes: notesToCreate.length
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
	responses: any[]
): Promise<OnboardingContent> {
	const domainScoresText = Object.entries(domainScores)
		.map(([domain, score]) => `- ${domain}: ${score}/10`)
		.join('\n');

	const responsesText = responses
		.slice(0, 20) // Include first 20 responses for context
		.map((r: any) => {
			const answer = r.response_value || r.response_text || 'No response';
			return `Q: ${r.assessment_questions?.question_text}\nA: ${answer}`;
		})
		.join('\n\n');

	const prompt = `You are a professional life strategist creating a comprehensive life organization system based on a detailed psychological assessment.

## USER PROFILE (Full Analysis):
${profileSummary}

## DOMAIN SCORES:
${domainScoresText}

## SAMPLE USER RESPONSES:
${responsesText}

---

Create a COMPREHENSIVE LIFE PLAN that addresses ALL 6 domains with genuinely useful, actionable content.

Generate a multi-project system with detailed tasks and strategic notes:

### PROJECTS (Create 6-8 projects covering all domains):

1. **Life Foundation Project** - "Organizing My Life with Chatkin"
   - Meta-project for overall system setup
   - Onboarding tasks, system customization

2. **Body Domain Project** - Based on their physical health needs
   - Title reflects their specific situation (e.g., "Building Sustainable Fitness Habits", "Energy & Vitality Recovery")

3. **Mind Domain Project** - Mental/emotional wellbeing
   - Title reflects their needs (e.g., "Stress Management System", "Emotional Resilience Building")

4. **Purpose Domain Project** - Career/work/meaning
   - Title reflects their situation (e.g., "Career Direction & Alignment", "Work-Life Integration Strategy")

5. **Connection Domain Project** - Relationships/community
   - Title reflects their needs (e.g., "Strengthening Core Relationships", "Building Community Connections")

6. **Growth Domain Project** - Learning/development
   - Title reflects their goals (e.g., "Skill Development Roadmap", "Personal Growth Journey")

7. **Finance Domain Project** - Financial/stability
   - Title reflects their situation (e.g., "Financial Stability Plan", "Resource Management Framework")

### TASKS (40-60 total across all projects):

Each project should have 5-10 tasks that are:
- **Specific and actionable**: Not "improve health" but "Schedule annual physical exam this week"
- **Personalized**: Based on their actual responses and situation
- **Varied in scope**: Quick wins (15min) to major initiatives (ongoing)
- **Prioritized thoughtfully**: High for urgent/impactful, medium for important, low for nice-to-have
- **Sequential where needed**: Some tasks unlock others
- **Genuinely useful**: Each task should move the needle on their life

Priority distribution:
- ~20% High priority (critical/urgent)
- ~50% Medium priority (important, strategic)
- ~30% Low priority (beneficial, aspirational)

### NOTES (15-25 strategic notes across projects):

Create comprehensive reference notes:
- **Frameworks**: Mental models, decision-making frameworks
- **Resources**: Curated tools, apps, books, services
- **Strategies**: Detailed approaches for common challenges
- **Templates**: Planning templates, reflection prompts
- **Insights**: Key insights from their assessment
- **Action Plans**: Step-by-step guides for complex goals

Each note should be 200-500 words of genuinely useful content in markdown format.

---

Return as JSON:
{
  "projects": [
    {
      "name": "...",
      "description": "...",
      "color": "blue/green/purple/orange/red/yellow"
    }
  ],
  "tasks": [
    {
      "project_name": "...",
      "title": "...",
      "description": "...",
      "priority": "high/medium/low",
      "status": "todo"
    }
  ],
  "notes": [
    {
      "project_name": "...",
      "title": "...",
      "content": "..."
    }
  ]
}

CRITICAL: This is their first impression of Chatkin's AI capabilities. Every task and note should demonstrate deep understanding of their situation and provide genuine value. Avoid generic advice - everything should feel tailored to THEIR specific assessment responses.`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 8000,
		messages: [{ role: 'user', content: prompt }]
	});

	// Extract JSON from response
	const responseText = message.content[0].text;
	const jsonMatch = responseText.match(/\{[\s\S]*\}/);

	if (!jsonMatch) {
		throw new WorkerError('Failed to parse onboarding content from AI response', 500);
	}

	return JSON.parse(jsonMatch[0]);
}
