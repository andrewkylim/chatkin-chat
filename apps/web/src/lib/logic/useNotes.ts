/**
 * Notes page logic helper module
 *
 * This module extracts all the business logic from the notes page component,
 * providing utility functions and action handlers for note operations.
 * The component remains responsible only for UI state and rendering.
 */

import type { Note, NoteBlock, WellnessDomain } from '@chatkin/types';
import {
	createNote as dbCreateNote,
	updateNote as dbUpdateNote,
	deleteNote as dbDeleteNote,
	updateNoteBlock as dbUpdateNoteBlock
} from '$lib/db/notes';
import { handleError } from '$lib/utils/error-handler';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Note with its associated blocks
 */
export interface NoteWithBlocks extends Note {
	note_blocks: NoteBlock[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Truncates a title to a maximum length with ellipsis
 * @param title - The title to truncate
 * @param maxLength - Maximum length (default: 30)
 * @returns Truncated title with ellipsis if needed, or 'Untitled' if empty
 */
export function truncateTitle(title: string | null, maxLength: number = 30): string {
	if (!title) return 'Untitled';
	if (title.length <= maxLength) return title;
	return title.substring(0, maxLength) + '...';
}

/**
 * Formats a date string as relative time
 * @param dateString - ISO date string
 * @returns Formatted string like "Updated 5m ago", "Updated yesterday", etc.
 */
export function formatDate(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffInMs = now.getTime() - date.getTime();
	const diffInHours = diffInMs / (1000 * 60 * 60);

	if (diffInHours < 1) {
		const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
		return `Updated ${diffInMinutes}m ago`;
	} else if (diffInHours < 24) {
		return `Updated ${Math.floor(diffInHours)}h ago`;
	} else if (diffInHours < 48) {
		return 'Updated yesterday';
	} else if (diffInHours < 168) {
		return `Updated ${Math.floor(diffInHours / 24)} days ago`;
	} else if (diffInHours < 336) {
		return 'Updated last week';
	} else {
		return `Updated ${Math.floor(diffInHours / 168)} weeks ago`;
	}
}

/**
 * Gets a preview of the note's content from its first text block
 * @param note - Note with blocks
 * @returns Preview text (max 200 chars) or placeholder message
 */
export function getContentPreview(note: NoteWithBlocks): string {
	if (!note.note_blocks || note.note_blocks.length === 0) return 'No content yet...';

	const firstTextBlock = note.note_blocks.find((block: NoteBlock) => block.type === 'text');
	if (!firstTextBlock || !firstTextBlock.content?.text) return 'No content yet...';

	const text = firstTextBlock.content.text as string;
	return text.length > 200 ? text.substring(0, 200) + '...' : text;
}

/**
 * Counts total words across all text blocks in a note
 * @param note - Note with blocks
 * @returns Total word count
 */
export function getWordCount(note: NoteWithBlocks): number {
	if (!note.note_blocks || note.note_blocks.length === 0) return 0;

	let allText = '';
	for (const block of note.note_blocks) {
		if (block.type === 'text' && block.content?.text) {
			allText += (block.content.text as string) + ' ';
		}
	}

	if (!allText.trim()) return 0;
	return allText.trim().split(/\s+/).length;
}

// ============================================================================
// ACTION FUNCTIONS
// ============================================================================

/**
 * Creates a new note with error handling
 * @param params - Note creation parameters
 * @returns Promise that resolves when note is created
 */
export async function createNoteAction(params: {
	title: string;
	content?: string;
	domain: WellnessDomain;
	project_id: string | null;
}): Promise<void> {
	try {
		await dbCreateNote(params);
	} catch (error) {
		handleError(error, { operation: 'Create note', component: 'NotesPage' });
		throw error; // Re-throw so caller can handle UI updates
	}
}

/**
 * Updates a note with error handling
 * @param noteId - Note ID to update
 * @param updates - Partial note data to update
 * @returns Promise that resolves when note is updated
 */
export async function updateNoteAction(noteId: string, updates: Partial<Note>): Promise<void> {
	try {
		await dbUpdateNote(noteId, updates);
	} catch (error) {
		handleError(error, { operation: 'Update note', component: 'NotesPage' });
		throw error;
	}
}

/**
 * Deletes a note with error handling
 * @param noteId - Note ID to delete
 * @returns Promise that resolves when note is deleted
 */
export async function deleteNoteAction(noteId: string): Promise<void> {
	try {
		await dbDeleteNote(noteId);
	} catch (error) {
		handleError(error, { operation: 'Delete note', component: 'NotesPage' });
		throw error;
	}
}

/**
 * Updates a note block's content with error handling
 * @param blockId - Block ID to update
 * @param content - New content text
 * @returns Promise that resolves when block is updated
 */
export async function updateNoteBlockAction(blockId: string, content: string): Promise<void> {
	try {
		await dbUpdateNoteBlock(blockId, content);
	} catch (error) {
		handleError(error, { operation: 'Update note block', component: 'NotesPage' });
		throw error;
	}
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Main hook that provides all note-related utilities and functions
 * @returns Object with all utilities and action functions
 */
export function useNotes() {
	return {
		// Utilities
		truncateTitle,
		formatDate,
		getContentPreview,
		getWordCount,

		// Actions
		createNote: createNoteAction,
		updateNote: updateNoteAction,
		deleteNote: deleteNoteAction,
		updateNoteBlock: updateNoteBlockAction,
	};
}
