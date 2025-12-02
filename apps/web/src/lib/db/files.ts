import { supabase } from '$lib/supabase';
import type { File as FileType } from '@chatkin/types';
import { PUBLIC_WORKER_URL } from '$env/static/public';

type FileInsert = Omit<FileType, 'id' | 'created_at'>;

export async function getFiles(conversationId?: string) {
	let query = supabase
		.from('files')
		.select('*')
		.order('created_at', { ascending: false });

	if (conversationId) {
		query = query.eq('conversation_id', conversationId);
	}

	const { data, error } = await query;

	if (error) throw error;
	return data as FileType[];
}

export async function getFile(id: string) {
	const { data, error } = await supabase
		.from('files')
		.select('*')
		.eq('id', id)
		.single();

	if (error) throw error;
	return data as FileType;
}

export async function createFile(file: Omit<FileInsert, 'user_id' | 'project_id'> & Partial<Pick<FileInsert, 'project_id'>>) {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	// Provide defaults for optional fields
	const fileData = {
		project_id: null,
		...file,
		user_id: user.id
	};

	const { data, error } = await supabase
		.from('files')
		.insert(fileData)
		.select()
		.single();

	if (error) throw error;
	return data as FileType;
}

export async function deleteFile(id: string, accessToken?: string) {
	// First, get the file to retrieve r2_key
	const { data: file, error: fetchError } = await supabase
		.from('files')
		.select('r2_key, r2_url')
		.eq('id', id)
		.single();

	if (fetchError) throw fetchError;
	if (!file) throw new Error('File not found');

	// Delete from database first
	const { error: dbError } = await supabase
		.from('files')
		.delete()
		.eq('id', id);

	if (dbError) throw dbError;

	// Delete from R2 storage
	try {
		const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : PUBLIC_WORKER_URL;
		const response = await fetch(`${workerUrl}/api/delete-file`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
			},
			body: JSON.stringify({ r2_key: file.r2_key }),
		});

		if (!response.ok) {
			console.error('Failed to delete file from R2:', await response.text());
			// Don't throw - database record is already deleted
		}
	} catch (error) {
		console.error('Error deleting file from R2:', error);
		// Don't throw - database record is already deleted
	}
}

/**
 * Get all library files for current user (not hidden)
 */
export async function getLibraryFiles(options?: { limit?: number; offset?: number }): Promise<FileType[]> {
	let query = supabase
		.from('files')
		.select('*')
		.eq('is_hidden_from_library', false)
		.order('created_at', { ascending: false });

	if (options?.limit) {
		query = query.limit(options.limit);
	}

	if (options?.offset) {
		query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
	}

	const { data, error } = await query;

	if (error) throw error;
	return data as FileType[];
}

/**
 * Get total storage used by current user
 */
export async function getUserStorageUsage(): Promise<number> {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	const { data, error } = await supabase
		.from('files')
		.select('size_bytes')
		.eq('user_id', user.id);

	if (error) throw error;

	return data.reduce((total, file) => total + file.size_bytes, 0);
}

/**
 * Update file metadata (title, description)
 */
export async function updateFileMetadata(
	fileId: string,
	updates: { title?: string; description?: string }
): Promise<void> {
	const { error } = await supabase
		.from('files')
		.update({
			...updates,
			ai_generated_metadata: false // User edited, no longer AI-generated
		})
		.eq('id', fileId);

	if (error) throw error;
}

/**
 * Bulk delete files
 */
export async function bulkDeleteFiles(fileIds: string[], accessToken?: string): Promise<void> {
	// Get all files to retrieve r2_keys
	const { data: files, error: fetchError } = await supabase
		.from('files')
		.select('id, r2_key')
		.in('id', fileIds);

	if (fetchError) throw fetchError;

	// Delete from database
	const { error: dbError } = await supabase
		.from('files')
		.delete()
		.in('id', fileIds);

	if (dbError) throw dbError;

	// Delete from R2 in parallel
	const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : PUBLIC_WORKER_URL;
	await Promise.allSettled(
		(files || []).map((file) =>
			fetch(`${workerUrl}/api/delete-file`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
				},
				body: JSON.stringify({ r2_key: file.r2_key }),
			})
		)
	);
	// Use allSettled so failures don't stop other deletions
}

/**
 * Update file project association
 */
export async function updateFileProject(
	fileId: string,
	projectId: string | null
): Promise<void> {
	const { error } = await supabase
		.from('files')
		.update({ project_id: projectId })
		.eq('id', fileId);

	if (error) throw error;
}

/**
 * Bulk update multiple files to add to project
 */
export async function bulkAddFilesToProject(
	fileIds: string[],
	projectId: string | null
): Promise<void> {
	const { error } = await supabase
		.from('files')
		.update({ project_id: projectId })
		.in('id', fileIds);

	if (error) throw error;
}

/**
 * Get all files for a specific project
 */
export async function getProjectFiles(projectId: string): Promise<FileType[]> {
	const { data, error } = await supabase
		.from('files')
		.select('*')
		.eq('project_id', projectId)
		.eq('is_hidden_from_library', false)
		.order('created_at', { ascending: false });

	if (error) throw error;
	return data as FileType[];
}
