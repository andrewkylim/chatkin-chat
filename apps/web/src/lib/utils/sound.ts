/* eslint-disable no-console */
import { browser } from '$app/environment';

let clickSound: HTMLAudioElement | null = null;

function initSound() {
	if (!browser) return;

	if (!clickSound) {
		clickSound = new Audio('/sounds/click.wav');
		clickSound.volume = 0.4; // Subtle volume
		clickSound.preload = 'auto';
	}
}

export function playClick() {
	if (!browser) return;

	try {
		// Initialize sound on first call
		if (!clickSound) {
			initSound();
		}

		if (clickSound) {
			// Reset to start if already playing (for rapid clicks)
			clickSound.currentTime = 0;
			clickSound.play().catch((error: unknown) => {
				// Silently handle autoplay restrictions
				console.debug('Audio play prevented:', error);
			});
		}
	} catch (error) {
		// Silently handle any errors
		console.debug('Error playing sound:', error);
	}
}
