/**
 * Project notes logic helper module
 *
 * This module extracts all note-related business logic from the project chat page,
 * providing utility functions for formatting dates, extracting previews, and counting words.
 * The component remains responsible only for UI state and rendering.
 */

import type { Note, NoteBlock } from '@chatkin/types';

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
 * @param note - Note (may or may not have blocks)
 * @returns Preview text (max 200 chars) or placeholder message
 */
export function getContentPreview(note: Note | NoteWithBlocks): string {
	const noteWithBlocks = note as NoteWithBlocks;
	if (!noteWithBlocks.note_blocks || noteWithBlocks.note_blocks.length === 0) return 'No content yet...';

	const firstTextBlock = noteWithBlocks.note_blocks.find((block: NoteBlock) => block.type === 'text');
	if (!firstTextBlock || !firstTextBlock.content?.text) return 'No content yet...';

	const text = firstTextBlock.content.text as string;
	return text.length > 200 ? text.substring(0, 200) + '...' : text;
}

/**
 * Counts total words across all text blocks in a note
 * @param note - Note (may or may not have blocks)
 * @returns Total word count
 */
export function getWordCount(note: Note | NoteWithBlocks): number {
	const noteWithBlocks = note as NoteWithBlocks;
	if (!noteWithBlocks.note_blocks || noteWithBlocks.note_blocks.length === 0) return 0;

	let allText = '';
	for (const block of noteWithBlocks.note_blocks) {
		if (block.type === 'text' && block.content?.text) {
			allText += (block.content.text as string) + ' ';
		}
	}

	if (!allText.trim()) return 0;
	return allText.trim().split(/\s+/).length;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Main hook that provides all note-related utilities and functions
 * @returns Object with all utilities
 */
export function useProjectNotes() {
	return {
		// Utilities
		formatDate,
		getContentPreview,
		getWordCount
	};
}
