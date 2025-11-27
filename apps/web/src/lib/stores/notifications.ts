import { writable } from 'svelte/store';
import { logger } from '$lib/utils/logger';

type Section = 'tasks' | 'notes' | 'projects';

interface NotificationCounts {
	tasks: number;
	notes: number;
	projects: number;
}

// Track which page we're currently on
let currentSection: Section | null = null;

// Simple counter-based notification store
function createNotificationStore() {
	const { subscribe, set, update } = writable<NotificationCounts>({
		tasks: 0,
		notes: 0,
		projects: 0
	});

	return {
		subscribe,
		// Set the current section (called when visiting a page)
		setCurrentSection: (section: Section | null) => {
			currentSection = section;
		},
		// Increment count for a section when an item is created (only if not on that page)
		incrementCount: (section: Section) => {
			logger.debug('Notification increment called', { section, currentSection });
			// Only increment if we're not currently on that page
			if (currentSection !== section) {
				update(state => {
					const newState = {
						...state,
						[section]: state[section] + 1
					};
					logger.debug('Notification count incremented', { section, count: newState[section] });
					return newState;
				});
			} else {
				logger.debug('Skipped notification increment - already on page', { section });
			}
		},
		// Clear count for a section when user visits it
		clearCount: (section: Section) => {
			update(state => ({
				...state,
				[section]: 0
			}));
		},
		// Reset all counts
		reset: () => {
			set({ tasks: 0, notes: 0, projects: 0 });
			currentSection = null;
		}
	};
}

export const notificationCounts = createNotificationStore();
