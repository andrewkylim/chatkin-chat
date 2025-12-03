<script lang="ts">
	import { handleError } from '$lib/utils/error-handler';
	import { onDestroy } from 'svelte';

	export let onTranscriptUpdate: ((transcript: string) => void) | undefined = undefined;
	export let onTranscriptComplete: ((transcript: string) => void) | undefined = undefined;
	export let onAutoSend: ((transcript: string) => void) | undefined = undefined;
	export let onRecordingChange: ((recording: boolean) => void) | undefined = undefined;
	export let autoSendEnabled: boolean = false;
	export let talkModeActive: boolean = false;

	let isRecording = false;

	// Watch for recording state changes
	$: if (onRecordingChange) {
		onRecordingChange(isRecording);
	}
	let error: string | null = null;
	let status: string = '';
	let fullTranscript = '';

	let mediaStream: MediaStream | null = null;
	let socket: WebSocket | null = null;
	let silenceTimeout: number | null = null;
	let audioContext: AudioContext | null = null;
	let processor: ScriptProcessorNode | null = null;

	const SILENCE_DURATION = 5000; // 5 seconds of silence to auto-stop
	const MAX_RECORDING_TIME = 60000; // 60 seconds max

	async function startRecording() {
		try {
			error = null;
			fullTranscript = '';

			// Get API key from server
			const keyResponse = await fetch('/api/deepgram-key');
			if (!keyResponse.ok) {
				throw new Error('Failed to get API key');
			}
			const { apiKey } = await keyResponse.json();

			// Request microphone access
			mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

			// Connect to Deepgram WebSocket
			socket = new WebSocket(
				'wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&encoding=linear16&sample_rate=16000',
				['token', apiKey]
			);

			socket.onopen = () => {
				isRecording = true;
				status = 'Listening...';

				// Start streaming audio
				streamAudio();

				// Set maximum recording time
				setTimeout(() => {
					if (isRecording) {
						stopRecording();
					}
				}, MAX_RECORDING_TIME);
			};

			socket.onmessage = (event) => {
				const data = JSON.parse(event.data);
				const transcript = data.channel?.alternatives?.[0]?.transcript || '';
				const isFinal = data.is_final;

				if (transcript) {
					if (isFinal) {
						// Final result - accumulate it
						fullTranscript = fullTranscript ? fullTranscript + ' ' + transcript : transcript;
					// Update input box with the accumulated transcript
					if (onTranscriptUpdate) {
						onTranscriptUpdate(fullTranscript);
					}
					} else {
						// Interim result - show accumulated + current interim
						const displayTranscript = fullTranscript ? fullTranscript + ' ' + transcript : transcript;
						if (onTranscriptUpdate) {
							onTranscriptUpdate(displayTranscript);
						}
					}

					// Reset silence timeout on new speech
					resetSilenceTimeout();
				}
			};

			socket.onerror = (err) => {
				console.error('WebSocket error:', err);
				error = 'Connection error';
				stopRecording();
			};

			socket.onclose = () => {
				// WebSocket closed
			};

		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to start recording';
			handleError(err, { operation: 'Start recording', component: 'VoiceInput' });
			isRecording = false;
		}
	}

	function streamAudio() {
		if (!mediaStream || !socket) return;

		// Create audio context for processing
		audioContext = new AudioContext({ sampleRate: 16000 });
		const source = audioContext.createMediaStreamSource(mediaStream);
		processor = audioContext.createScriptProcessor(4096, 1, 1);

		processor.onaudioprocess = (e) => {
			if (socket?.readyState === WebSocket.OPEN) {
				const inputData = e.inputBuffer.getChannelData(0);

				// Convert Float32Array to Int16Array for Deepgram
				const int16Data = new Int16Array(inputData.length);
				for (let i = 0; i < inputData.length; i++) {
					int16Data[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32768)));
				}

				// Send audio data to Deepgram
				socket.send(int16Data.buffer);
			}
		};

		source.connect(processor);
		processor.connect(audioContext.destination);
	}

	function resetSilenceTimeout() {
		if (silenceTimeout) {
			clearTimeout(silenceTimeout);
		}

		silenceTimeout = window.setTimeout(() => {
			if (isRecording) {
				stopRecording();
			}
		}, SILENCE_DURATION);
	}

	function stopRecording() {
		isRecording = false;
		status = '';

		// Clear silence timeout
		if (silenceTimeout) {
			clearTimeout(silenceTimeout);
			silenceTimeout = null;
		}

		// Close WebSocket
		if (socket) {
			socket.close();
			socket = null;
		}

		// Stop audio processing
		if (processor) {
			processor.disconnect();
			processor = null;
		}

		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}

		// Stop media stream
		if (mediaStream) {
			mediaStream.getTracks().forEach(track => track.stop());
			mediaStream = null;
		}

		// Send final transcript
		if (fullTranscript) {
			if (autoSendEnabled && onAutoSend) {
				onAutoSend(fullTranscript);  // Auto-send mode
			} else if (onTranscriptComplete) {
				onTranscriptComplete(fullTranscript);  // Manual mode
			}
		} else {
			if (onTranscriptUpdate) {
				onTranscriptUpdate('');
			}
		}

		fullTranscript = '';
	}

	// Export method to programmatically start recording (for auto-listen)
	export function startListening() {
		if (!isRecording) {
			startRecording();
		}
	}

	// Export method to programmatically stop recording
	export function stopListening() {
		if (isRecording) {
			stopRecording();
		}
	}

	function toggleRecording() {
		if (isRecording) {
			stopRecording();
		} else {
			startRecording();
		}
	}

	// Cleanup on component destroy
	onDestroy(() => {
		if (isRecording) {
			stopRecording();
		}
	});
</script>

<div class="voice-input">
	<button
		type="button"
		class="mic-btn"
		class:recording={isRecording}
		class:processing={status === 'Transcribing...'}
		class:talk-mode-active={talkModeActive}
		on:click={toggleRecording}
		disabled={status === 'Transcribing...'}
		aria-label={isRecording ? 'Stop recording' : 'Start recording'}
		title={isRecording ? 'Click to stop recording' : (talkModeActive ? 'Talk Mode: Will auto-send' : 'Click to speak')}
	>
		{#if isRecording}
			<!-- Stop icon (square) -->
			<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<rect x="5" y="5" width="10" height="10" rx="2"/>
			</svg>
		{:else}
			<!-- Microphone icon -->
			<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path d="M10 1a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
				<path d="M5 9a5 5 0 0 0 10 0"/>
				<path d="M10 14v5"/>
				<path d="M7 19h6"/>
			</svg>
		{/if}
	</button>

	{#if error}
		<div class="error-message">{error}</div>
	{/if}
</div>

<style>
	.voice-input {
		position: relative;
	}

	.mic-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.mic-btn:hover:not(:disabled) {
		color: var(--text-primary);
	}

	.mic-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.mic-btn.recording {
		color: #ef4444;
	}

	.mic-btn.recording:hover:not(:disabled) {
		color: #ef4444;
	}

	.mic-btn.talk-mode-active:not(.recording) {
		background: var(--accent-primary);
		color: white;
		padding: 6px;
	}

	.mic-btn.talk-mode-active:not(.recording):hover:not(:disabled) {
		background: var(--accent-hover);
		color: white;
	}

	.mic-btn.processing svg {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.error-message {
		position: absolute;
		bottom: -24px;
		left: 0;
		font-size: 0.75rem;
		color: #ef4444;
		white-space: nowrap;
	}
</style>
