/**
 * Query tool handlers for AI on-demand database queries
 */
import { createClient } from '@supabase/supabase-js';

interface QueryFilters {
	project_id?: string;
	status?: string;
	search_query?: string;
	conversation_id?: string;
	mime_type_prefix?: string;
	is_hidden_from_library?: boolean;
	include_archived?: boolean;
}

export async function executeQueryTool(
	toolName: string,
	toolInput: { filters?: QueryFilters; limit?: number },
	authToken: string,
	env: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string }
): Promise<string> {
	try {
		// Initialize Supabase client with user's auth token for RLS
		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
			global: {
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			}
		});

		// Conservative limits: default 50, max 100 (per user feedback on token usage)
		const limit = Math.min(toolInput.limit || 50, 100);

		switch (toolName) {
			case 'query_tasks': {
				let query = supabase.from('tasks').select('*');

				if (toolInput.filters?.project_id) {
					query = query.eq('project_id', toolInput.filters.project_id);
				}
				if (toolInput.filters?.status) {
					query = query.eq('status', toolInput.filters.status);
				}
				if (toolInput.filters?.search_query) {
					query = query.or(
						`title.ilike.%${toolInput.filters.search_query}%,description.ilike.%${toolInput.filters.search_query}%`
					);
				}

				query = query.order('created_at', { ascending: false }).limit(limit);

				const { data, error } = await query;
				if (error) throw error;

				return JSON.stringify({ count: data.length, tasks: data }, null, 2);
			}

			case 'query_notes': {
				let query = supabase.from('notes').select('*');

				if (toolInput.filters?.project_id) {
					query = query.eq('project_id', toolInput.filters.project_id);
				}
				if (toolInput.filters?.search_query) {
					query = query.or(
						`title.ilike.%${toolInput.filters.search_query}%,content.ilike.%${toolInput.filters.search_query}%`
					);
				}

				query = query.order('created_at', { ascending: false }).limit(limit);

				const { data, error } = await query;
				if (error) throw error;

				// Note: select('*') includes full content. If token usage becomes an issue,
				// consider selecting only id, title, project_id, updated_at by default.
				// For now, keeping it simple as requested.
				return JSON.stringify({ count: data.length, notes: data }, null, 2);
			}

			case 'query_projects': {
				let query = supabase.from('projects').select('*');

				if (!toolInput.filters?.include_archived) {
					query = query.eq('is_archived', false);
				}
				if (toolInput.filters?.search_query) {
					query = query.or(
						`name.ilike.%${toolInput.filters.search_query}%,description.ilike.%${toolInput.filters.search_query}%`
					);
				}

				query = query.order('created_at', { ascending: false });

				const { data, error } = await query;
				if (error) throw error;

				return JSON.stringify({ count: data.length, projects: data }, null, 2);
			}

			case 'query_files': {
				let query = supabase.from('files').select('*');

				if (toolInput.filters?.project_id) {
					query = query.eq('project_id', toolInput.filters.project_id);
				}
				if (toolInput.filters?.conversation_id) {
					query = query.eq('conversation_id', toolInput.filters.conversation_id);
				}
				if (toolInput.filters?.search_query) {
					// Search in filename, title, AND description (per user clarification)
					query = query.or(
						`filename.ilike.%${toolInput.filters.search_query}%,title.ilike.%${toolInput.filters.search_query}%,description.ilike.%${toolInput.filters.search_query}%`
					);
				}
				if (toolInput.filters?.mime_type_prefix) {
					query = query.like('mime_type', `${toolInput.filters.mime_type_prefix}%`);
				}
				if (toolInput.filters?.is_hidden_from_library !== undefined) {
					query = query.eq('is_hidden_from_library', toolInput.filters.is_hidden_from_library);
				}

				query = query.order('created_at', { ascending: false }).limit(limit);

				const { data, error } = await query;
				if (error) throw error;

				return JSON.stringify({ count: data.length, files: data }, null, 2);
			}

			default:
				throw new Error(`Unknown query tool: ${toolName}`);
		}
	} catch (error) {
		// Return clear, user-friendly error message (per user feedback on error handling)
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		return JSON.stringify({
			error: true,
			message: `Query failed: ${errorMessage}. Please try again or refine your query.`,
			details: errorMessage
		});
	}
}
