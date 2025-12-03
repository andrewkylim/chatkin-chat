/**
 * Talk Mode Service
 *
 * Handles audio playback, TTS, and voice interaction management.
 */

import { logger } from '$lib/utils/logger';

export interface TTSOptions {
	onComplete?: () => void;
}

export class TalkModeService {
	private audioUnlocked = false;
	private currentAudio: HTMLAudioElement | null = null;
	private ttsAudioElement: HTMLAudioElement | null = null;
	private keepAliveInterval: number | null = null;

	/**
	 * Unlock audio playback (required for iOS/mobile autoplay)
	 */
	async unlockAudio(): Promise<void> {
		if (this.audioUnlocked) return;

		try {
			// Pre-create audio element for iOS with looping silent audio
			if (!this.ttsAudioElement) {
				this.ttsAudioElement = new Audio();
				this.ttsAudioElement.preload = 'auto';
				this.ttsAudioElement.loop = true; // Loop to keep it "warm"
				this.ttsAudioElement.volume = 0.01; // Very low volume

				// Set a looping silent audio source
				this.ttsAudioElement.src =
					'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/////////////////';

				// Start playing to unlock and keep the element "warm"
				await this.ttsAudioElement.play();
				this.audioUnlocked = true;
			}
		} catch (error) {
			// Silently fail - audio unlock not needed on desktop browsers
			// Only log if it's not a "NotSupportedError" which is expected on desktop
			const err = error as Error;
			if (err.name !== 'NotSupportedError') {
				logger.error('Failed to unlock audio', error);
			}
		}
	}

	/**
	 * Play text-to-speech audio
	 */
	async playTTS(text: string, options?: TTSOptions): Promise<void> {
		try {
			// Use pre-created audio element for iOS, or create new one as fallback
			let audio: HTMLAudioElement;
			if (this.ttsAudioElement) {
				audio = this.ttsAudioElement;
			} else {
				// Fallback: create new audio element (for desktop or if unlockAudio wasn't called)
				audio = new Audio();
			}
			this.currentAudio = audio;

			// Call TTS API endpoint
			const response = await fetch('/api/tts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text })
			});

			if (!response.ok) {
				throw new Error('TTS request failed');
			}

			const audioBlob = await response.blob();

			if (audioBlob.size === 0) {
				throw new Error('Received empty audio blob');
			}

			const audioUrl = URL.createObjectURL(audioBlob);

			// For iOS: Stop looping, set new source, then restart playback
			if (this.ttsAudioElement) {
				audio.loop = false;
				audio.volume = 1.0;
			}

			audio.src = audioUrl;

			// For iOS warm element: Explicitly call play() after changing src
			if (this.ttsAudioElement && audio.paused) {
				await audio.play();
			}

			// Wait for audio to finish
			await new Promise<void>((resolve, reject) => {
				audio.onended = () => {
					URL.revokeObjectURL(audioUrl);
					this.currentAudio = null;
					resolve();
				};
				audio.onerror = () => {
					URL.revokeObjectURL(audioUrl);
					this.currentAudio = null;
					reject(new Error('Audio playback error'));
				};
			});

			options?.onComplete?.();
		} catch (error) {
			logger.error('Failed to play TTS audio', error);
			// Still trigger onComplete even if TTS fails
			options?.onComplete?.();
			throw error;
		}
	}

	/**
	 * Stop any currently playing audio
	 */
	stopAudio(): void {
		if (this.currentAudio) {
			this.currentAudio.pause();
			this.currentAudio = null;
		}
	}

	/**
	 * Cleanup all audio resources
	 */
	cleanup(): void {
		this.stopAudio();
		if (this.ttsAudioElement) {
			this.ttsAudioElement.pause();
			this.ttsAudioElement.src = '';
			this.ttsAudioElement = null;
		}
	}

	/**
	 * Check if audio is unlocked
	 */
	get isAudioUnlocked(): boolean {
		return this.audioUnlocked;
	}
}

// Singleton instance
export const talkModeService = new TalkModeService();
