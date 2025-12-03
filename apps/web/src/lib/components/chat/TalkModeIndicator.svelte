<script lang="ts">
	export let isListening: boolean = false;
	export let isSpeaking: boolean = false;
	export let talkModeActive: boolean = false;
	export let onStopTalkMode: (() => void) | undefined = undefined;

	$: isActive = talkModeActive; // Always show when talk mode is active
	$: statusText = isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Processing...';
	$: waveClass = isListening ? 'listening' : isSpeaking ? 'speaking' : 'idle';
</script>

<div class="talk-mode-indicator" class:active={isActive}>
	<div class="indicator-content">
		<div class="wave-container">
			<div class="wave {waveClass}">
				<span class="bar"></span>
				<span class="bar"></span>
				<span class="bar"></span>
				<span class="bar"></span>
				<span class="bar"></span>
			</div>
			<p class="status-text">{statusText || '\u00A0'}</p>
			{#if onStopTalkMode}
				<button class="stop-btn" on:click={onStopTalkMode} type="button" title="Stop Talk Mode">
					Stop Talk Mode
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.talk-mode-indicator {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1000;
		display: none;
	}

	.talk-mode-indicator.active {
		display: flex;
		pointer-events: auto;
	}

	.indicator-content {
		background: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-radius: 2.5rem;
		padding: 5rem 7rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.25);
		/* Fixed dimensions to prevent jumping */
		width: 360px;
		height: 280px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}

	.wave-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		/* Fixed height to prevent container shifts */
		height: 180px;
		justify-content: center;
	}

	.wave {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.625rem;
		height: 5rem;
		flex-shrink: 0;
	}

	.bar {
		width: 0.5rem;
		border-radius: 0.5rem;
		transform-origin: center;
		transition: height 0.3s ease, background 0.3s ease;
	}

	/* Idle state - colored bars with gentle pulse */
	.wave.idle .bar {
		background: linear-gradient(180deg, #3b82f6, #8b5cf6);
		animation: idle-pulse 2s ease-in-out infinite;
	}

	.wave.idle .bar:nth-child(1) { height: 2rem; animation-delay: 0s; }
	.wave.idle .bar:nth-child(2) { height: 2.75rem; animation-delay: 0.1s; }
	.wave.idle .bar:nth-child(3) { height: 3.5rem; animation-delay: 0.2s; }
	.wave.idle .bar:nth-child(4) { height: 2.75rem; animation-delay: 0.3s; }
	.wave.idle .bar:nth-child(5) { height: 2rem; animation-delay: 0.4s; }

	/* Listening state - orange bars with active pulse */
	.wave.listening .bar {
		background: linear-gradient(180deg, var(--accent-primary), var(--accent-hover));
		animation: listening-pulse 1.8s ease-in-out infinite;
	}

	.wave.listening .bar:nth-child(1) { height: 2rem; animation-delay: 0s; }
	.wave.listening .bar:nth-child(2) { height: 2.5rem; animation-delay: 0.1s; }
	.wave.listening .bar:nth-child(3) { height: 3rem; animation-delay: 0.2s; }
	.wave.listening .bar:nth-child(4) { height: 2.5rem; animation-delay: 0.1s; }
	.wave.listening .bar:nth-child(5) { height: 2rem; animation-delay: 0s; }

	/* Speaking state - green bars with dynamic pulse */
	.wave.speaking .bar {
		background: linear-gradient(180deg, #4caf50, #81c784);
		animation: speaking-pulse 0.5s ease-in-out infinite;
	}

	.wave.speaking .bar:nth-child(1) { height: 2.25rem; animation-delay: 0s; }
	.wave.speaking .bar:nth-child(2) { height: 2.75rem; animation-delay: 0.08s; }
	.wave.speaking .bar:nth-child(3) { height: 3.25rem; animation-delay: 0.16s; }
	.wave.speaking .bar:nth-child(4) { height: 2.75rem; animation-delay: 0.08s; }
	.wave.speaking .bar:nth-child(5) { height: 2.25rem; animation-delay: 0s; }

	@keyframes idle-pulse {
		0%, 100% {
			transform: scaleY(1);
			opacity: 1;
		}
		50% {
			transform: scaleY(1);
			opacity: 1;
		}
	}

	@keyframes listening-pulse {
		0%, 100% {
			transform: scaleY(1);
		}
		50% {
			transform: scaleY(1.3);
		}
	}

	@keyframes speaking-pulse {
		0%, 100% {
			transform: scaleY(1);
		}
		50% {
			transform: scaleY(1.4);
		}
	}

	.status-text {
		margin: 0;
		color: rgba(0, 0, 0, 0.8);
		font-size: 1rem;
		font-weight: 500;
		text-align: center;
		letter-spacing: 0.5px;
		/* Fixed height to prevent layout shift */
		min-height: 1.5rem;
		line-height: 1.5rem;
	}

	.stop-btn {
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1.5px solid rgba(0, 0, 0, 0.5);
		border-radius: 0.5rem;
		color: rgba(0, 0, 0, 0.8);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.stop-btn:hover {
		background: rgba(0, 0, 0, 0.1);
		border-color: rgba(0, 0, 0, 0.7);
		color: rgba(0, 0, 0, 0.95);
	}

	.stop-btn:active {
		background: rgba(0, 0, 0, 0.15);
	}

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.indicator-content {
			padding: 4rem 5rem;
			/* Fixed dimensions for mobile */
			width: 320px;
			height: 240px;
		}

		.wave-container {
			/* Fixed height for mobile */
			height: 150px;
		}

		.wave {
			height: 4rem;
			gap: 0.5rem;
		}

		.bar {
			width: 0.4rem;
		}

		.wave.idle .bar:nth-child(1),
		.wave.idle .bar:nth-child(5) { height: 1.75rem; }
		.wave.idle .bar:nth-child(2),
		.wave.idle .bar:nth-child(4) { height: 2.25rem; }
		.wave.idle .bar:nth-child(3) { height: 3rem; }

		.wave.listening .bar:nth-child(1),
		.wave.listening .bar:nth-child(5) { height: 1.75rem; }
		.wave.listening .bar:nth-child(2),
		.wave.listening .bar:nth-child(4) { height: 2rem; }
		.wave.listening .bar:nth-child(3) { height: 2.5rem; }

		.wave.speaking .bar:nth-child(1),
		.wave.speaking .bar:nth-child(5) { height: 1.9rem; }
		.wave.speaking .bar:nth-child(2),
		.wave.speaking .bar:nth-child(4) { height: 2.25rem; }
		.wave.speaking .bar:nth-child(3) { height: 2.75rem; }

		.status-text {
			font-size: 0.9375rem;
		}
	}
</style>
