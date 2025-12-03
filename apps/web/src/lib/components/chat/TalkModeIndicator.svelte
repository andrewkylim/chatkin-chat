<script lang="ts">
	export let isListening: boolean = false;
	export let isSpeaking: boolean = false;
	export let talkModeActive: boolean = false;
	export let onStopTalkMode: (() => void) | undefined = undefined;

	$: isActive = talkModeActive; // Always show when talk mode is active
	$: statusText = isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : '';
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
		background: var(--accent-primary);
		border-radius: 0.5rem;
		transform-origin: center;
	}

	/* Set default heights for all bars */
	.bar:nth-child(1),
	.bar:nth-child(5) {
		height: 1.5rem;
	}

	.bar:nth-child(2),
	.bar:nth-child(4) {
		height: 2rem;
	}

	.bar:nth-child(3) {
		height: 2.5rem;
	}

	/* Idle state - flat colored bars */
	.wave.idle .bar {
		background: linear-gradient(90deg, #3b82f6, #8b5cf6);
		animation: none !important;
		height: 0.375rem !important;
	}

	/* Listening state - orange animated bars */
	.wave.listening .bar {
		background: linear-gradient(180deg, var(--accent-primary), var(--accent-hover));
		animation: wave 1.2s ease-in-out infinite;
	}

	.wave.listening .bar:nth-child(1) {
		animation-delay: 0s;
	}

	.wave.listening .bar:nth-child(2) {
		animation-delay: 0.1s;
	}

	.wave.listening .bar:nth-child(3) {
		animation-delay: 0.2s;
	}

	.wave.listening .bar:nth-child(4) {
		animation-delay: 0.3s;
	}

	.wave.listening .bar:nth-child(5) {
		animation-delay: 0.4s;
	}

	/* Speaking state - green animated bars */
	.wave.speaking .bar {
		background: linear-gradient(180deg, #4caf50, #81c784);
		animation: wave 1.2s ease-in-out infinite;
	}

	.wave.speaking .bar:nth-child(1) {
		animation-delay: 0s;
	}

	.wave.speaking .bar:nth-child(2) {
		animation-delay: 0.1s;
	}

	.wave.speaking .bar:nth-child(3) {
		animation-delay: 0.2s;
	}

	.wave.speaking .bar:nth-child(4) {
		animation-delay: 0.3s;
	}

	.wave.speaking .bar:nth-child(5) {
		animation-delay: 0.4s;
	}

	@keyframes wave {
		0%,
		100% {
			transform: scaleY(0.5);
		}
		50% {
			transform: scaleY(1.5);
		}
	}

	.status-text {
		margin: 0;
		color: white;
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
		background: rgba(0, 0, 0, 0.2);
		border: 1.5px solid rgba(0, 0, 0, 0.4);
		border-radius: 0.5rem;
		color: rgba(0, 0, 0, 0.8);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.stop-btn:hover {
		background: rgba(0, 0, 0, 0.3);
		border-color: rgba(0, 0, 0, 0.6);
		color: rgba(0, 0, 0, 0.95);
	}

	.stop-btn:active {
		background: rgba(0, 0, 0, 0.35);
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
			height: 4.5rem;
			gap: 0.5rem;
		}

		.bar {
			width: 0.4rem;
		}

		/* Mobile idle state - same size as active states */
		.wave.idle .bar:nth-child(1),
		.wave.idle .bar:nth-child(5) {
			height: 1.25rem;
		}

		.wave.idle .bar:nth-child(2),
		.wave.idle .bar:nth-child(4) {
			height: 1.75rem;
		}

		.wave.idle .bar:nth-child(3) {
			height: 2.25rem;
		}

		/* Mobile listening/speaking states */
		.wave.listening .bar:nth-child(1),
		.wave.speaking .bar:nth-child(1),
		.wave.listening .bar:nth-child(5),
		.wave.speaking .bar:nth-child(5) {
			height: 1.25rem;
		}

		.wave.listening .bar:nth-child(2),
		.wave.speaking .bar:nth-child(2),
		.wave.listening .bar:nth-child(4),
		.wave.speaking .bar:nth-child(4) {
			height: 1.75rem;
		}

		.wave.listening .bar:nth-child(3),
		.wave.speaking .bar:nth-child(3) {
			height: 2.25rem;
		}

		.status-text {
			font-size: 0.9375rem;
		}
	}
</style>
