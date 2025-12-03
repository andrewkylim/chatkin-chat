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

	/**
	 * Unlock audio playback (required for iOS/mobile autoplay)
	 */
	async unlockAudio(): Promise<void> {
		if (this.audioUnlocked) return;

		try {
			// Create silent audio to unlock playback
			const silentAudio = new Audio(
				'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/////////////////'
			);
			await silentAudio.play();
			this.audioUnlocked = true;
			logger.debug('Audio playback unlocked');

			// Pre-create audio element for iOS
			if (!this.ttsAudioElement) {
				this.ttsAudioElement = new Audio();
				this.ttsAudioElement.preload = 'auto';
				logger.debug('Pre-created TTS audio element for iOS');
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
			// Use pre-created audio element for iOS
			let audio: HTMLAudioElement;
			if (this.ttsAudioElement) {
				audio = this.ttsAudioElement;
				logger.debug('Using pre-created audio element for TTS');
			} else {
				audio = new Audio();
				logger.debug('Creating new audio element for TTS');
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
			const audioUrl = URL.createObjectURL(audioBlob);

			audio.src = audioUrl;

			// On iOS, we must call play() immediately without load() in between
			logger.debug('Attempting to play TTS audio');
			await audio.play();
			logger.debug('TTS audio playback started successfully');

			// Wait for audio to finish
			await new Promise<void>((resolve) => {
				audio.onended = () => {
					URL.revokeObjectURL(audioUrl);
					this.currentAudio = null;
					resolve();
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
