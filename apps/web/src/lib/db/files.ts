import { supabase } from '$lib/supabase';
import type { File as FileType } from '@chatkin/types';

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

export async function createFile(file: Omit<FileInsert, 'user_id'>) {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	const { data, error } = await supabase
		.from('files')
		.insert({ ...file, user_id: user.id })
		.select()
		.single();

	if (error) throw error;
	return data as FileType;
}

export async function deleteFile(id: string) {
	const { error } = await supabase
		.from('files')
		.delete()
		.eq('id', id);

	if (error) throw error;
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
export async function bulkDeleteFiles(fileIds: string[]): Promise<void> {
	const { error } = await supabase
		.from('files')
		.delete()
		.in('id', fileIds);

	if (error) throw error;
}
