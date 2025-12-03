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
				logger.debug('Audio playback unlocked and kept warm with looping silent audio');
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
			logger.debug('playTTS called', {
				text: text.substring(0, 50),
				audioUnlocked: this.audioUnlocked,
				hasTtsElement: !!this.ttsAudioElement
			});

			// Use pre-created audio element for iOS, or create new one as fallback
			let audio: HTMLAudioElement;
			if (this.ttsAudioElement) {
				audio = this.ttsAudioElement;
				// Stop looping and restore full volume
				audio.loop = false;
				audio.volume = 1.0;
				logger.debug('Using warm pre-created audio element for TTS');
			} else {
				// Fallback: create new audio element (for desktop or if unlockAudio wasn't called)
				audio = new Audio();
				logger.debug('Creating new audio element for TTS');
			}
			this.currentAudio = audio;

			// Call TTS API endpoint
			logger.debug('Fetching TTS audio from API');
			const response = await fetch('/api/tts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text })
			});

			if (!response.ok) {
				logger.error('TTS API request failed', { status: response.status });
				throw new Error('TTS request failed');
			}

			const audioBlob = await response.blob();
			logger.debug('Received audio blob', { size: audioBlob.size, type: audioBlob.type });

			if (audioBlob.size === 0) {
				throw new Error('Received empty audio blob');
			}

			const audioUrl = URL.createObjectURL(audioBlob);
			logger.debug('Created object URL');

			// Set the new source - audio element is already "warm" and playing
			audio.src = audioUrl;
			logger.debug('Set new TTS source on warm audio element', {
				hasAudio: !!audio,
				hasSrc: !!audio.src,
				readyState: audio.readyState,
				paused: audio.paused
			});

			// Wait for audio to finish
			await new Promise<void>((resolve, reject) => {
				audio.onended = () => {
					logger.debug('Audio playback ended normally');
					URL.revokeObjectURL(audioUrl);
					this.currentAudio = null;
					resolve();
				};
				audio.onerror = (e) => {
					logger.error('Audio playback error event', e);
					URL.revokeObjectURL(audioUrl);
					this.currentAudio = null;
					reject(new Error('Audio playback error'));
				};
			});

			logger.debug('TTS playback completed successfully');
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
