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
