import { supabase } from '$lib/supabase';
import type { Database } from '@chatkin/types';

type Note = Database['public']['Tables']['notes']['Row'];
type NoteInsert = Database['public']['Tables']['notes']['Insert'];
type NoteUpdate = Database['public']['Tables']['notes']['Update'];

export async function getNotes(projectId?: string) {
	let query = supabase
		.from('notes')
		.select('*')
		.order('updated_at', { ascending: false });

	if (projectId) {
		query = query.eq('project_id', projectId);
	}

	const { data, error } = await query;

	if (error) throw error;
	return data as Note[];
}

export async function getNote(id: string) {
	const { data, error } = await supabase
		.from('notes')
		.select(`
			*,
			note_blocks (
				id,
				type,
				content,
				position
			)
		`)
		.eq('id', id)
		.single();

	if (error) throw error;
	return data;
}

export async function createNote(note: Omit<NoteInsert, 'user_id'>) {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error('Not authenticated');

	const { data, error } = await supabase
		.from('notes')
		.insert({ ...note, user_id: user.id })
		.select()
		.single();

	if (error) throw error;
	return data as Note;
}

export async function updateNote(id: string, updates: NoteUpdate) {
	const { data, error } = await supabase
		.from('notes')
		.update({ ...updates, updated_at: new Date().toISOString() })
		.eq('id', id)
		.select()
		.single();

	if (error) throw error;
	return data as Note;
}

export async function deleteNote(id: string) {
	const { error } = await supabase
		.from('notes')
		.delete()
		.eq('id', id);

	if (error) throw error;
}
