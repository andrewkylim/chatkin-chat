<script lang="ts">
	import type { Database } from '$lib/types/database';

	type Question = Database['public']['Tables']['assessment_questions']['Row'];

	let {
		question,
		value = $bindable(),
		onNext,
		onBack,
		canGoBack = false,
		isLast = false
	}: {
		question: Question;
		value: string;
		onNext: () => void;
		onBack: () => void;
		canGoBack?: boolean;
		isLast?: boolean;
	} = $props();

	let textValue = $state('');

	// Initialize text value if it's an open-ended question
	$effect(() => {
		if (question.question_type === 'open_ended' && value) {
			textValue = value;
		}
	});

	function handleScaleSelect(scaleValue: number) {
		value = scaleValue.toString();
		setTimeout(onNext, 300); // Small delay for visual feedback
	}

	function handleEmojiSelect(emojiValue: number) {
		value = emojiValue.toString();
		setTimeout(onNext, 300);
	}

	function handleMultipleChoice(choiceValue: string) {
		value = choiceValue;
		setTimeout(onNext, 300);
	}

	function handleTextSubmit() {
		value = textValue;
		onNext();
	}

	// Get domain color
	function getDomainColor(domain: string): string {
		const colorMap: Record<string, string> = {
			Body: 'var(--domain-body)',
			Mind: 'var(--domain-mind)',
			Purpose: 'var(--domain-purpose)',
			Connection: 'var(--domain-connection)',
			Growth: 'var(--domain-growth)',
			Security: 'var(--domain-security)'
		};
		return colorMap[domain] || 'var(--accent-primary)';
	}

	// Emoji options for emoji_scale
	const emojiOptions = [
		{ value: 1, emoji: '😞', label: question.scale_min_label || 'Very low' },
		{ value: 2, emoji: '😟', label: 'Low' },
		{ value: 3, emoji: '😐', label: 'Neutral' },
		{ value: 4, emoji: '🙂', label: 'High' },
		{ value: 5, emoji: '😊', label: question.scale_max_label || 'Very high' }
	];

	// Parse multiple choice options
	let multipleChoiceOptions: Array<{ value: string; label: string; score: number }> = [];
	if (question.question_type === 'multiple_choice' && question.options) {
		multipleChoiceOptions = question.options as Array<{
			value: string;
			label: string;
			score: number;
		}>;
	}
</script>

<div class="question-card">
	<div class="domain-badge" style="background-color: {getDomainColor(question.domain)}">
		{question.domain}
	</div>

	<h2 class="question-text">{question.question_text}</h2>

	<div class="answer-section">
		{#if question.question_type === 'scale'}
			<!-- Standard 1-5 scale with labels -->
			<div class="scale-container">
				{#if question.scale_min_label}
					<span class="scale-label">{question.scale_min_label}</span>
				{/if}
				<div class="scale-options">
					{#each Array.from({ length: (question.scale_max || 5) - (question.scale_min || 1) + 1 }, (_, i) => i + (question.scale_min || 1)) as num}
						<button
							type="button"
							class="scale-button"
							class:selected={value === num.toString()}
							onclick={() => handleScaleSelect(num)}
						>
							{num}
						</button>
					{/each}
				</div>
				{#if question.scale_max_label}
					<span class="scale-label">{question.scale_max_label}</span>
				{/if}
			</div>
		{:else if question.question_type === 'emoji_scale'}
			<!-- Emoji scale (5 emojis) -->
			<div class="emoji-container">
				{#each emojiOptions as option}
					<button
						type="button"
						class="emoji-button"
						class:selected={value === option.value.toString()}
						onclick={() => handleEmojiSelect(option.value)}
						title={option.label}
					>
						<span class="emoji">{option.emoji}</span>
						<span class="emoji-label">{option.label}</span>
					</button>
				{/each}
			</div>
		{:else if question.question_type === 'multiple_choice'}
			<!-- Multiple choice options -->
			<div class="multiple-choice-container">
				{#each multipleChoiceOptions as option}
					<button
						type="button"
						class="choice-button"
						class:selected={value === option.value}
						onclick={() => handleMultipleChoice(option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		{:else if question.question_type === 'open_ended'}
			<!-- Open-ended text response -->
			<div class="text-container">
				<textarea
					bind:value={textValue}
					placeholder="Share your thoughts..."
					rows="6"
					class="text-input"
				></textarea>
				<button
					type="button"
					class="submit-button"
					onclick={handleTextSubmit}
					disabled={!textValue.trim()}
				>
					{isLast ? 'Complete Assessment' : 'Next'}
				</button>
			</div>
		{/if}
	</div>

	{#if canGoBack && question.question_type === 'open_ended'}
		<button type="button" class="back-button" onclick={onBack}> ← Back </button>
	{/if}
</div>

<style>
	.question-card {
		width: 100%;
		max-width: 700px;
		margin: 0 auto;
		padding: 32px 24px;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
	}

	.domain-badge {
		display: inline-block;
		padding: 6px 16px;
		border-radius: 20px;
		color: white;
		font-size: 0.875rem;
		font-weight: 600;
		margin-bottom: 24px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.question-text {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.4;
		margin-bottom: 32px;
	}

	.answer-section {
		margin-bottom: 24px;
	}

	/* Scale (1-5) Styles */
	.scale-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
		align-items: center;
	}

	.scale-options {
		display: flex;
		gap: 12px;
	}

	.scale-button {
		width: 60px;
		height: 60px;
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 1.25rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.scale-button:hover {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
	}

	.scale-button.selected {
		border-color: var(--accent-primary);
		background: var(--accent-primary);
		color: white;
	}

	.scale-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
		text-align: center;
		max-width: 400px;
	}

	/* Emoji Scale Styles */
	.emoji-container {
		display: flex;
		gap: 12px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.emoji-button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 16px 20px;
		border: 2px solid var(--border-color);
		border-radius: var(--radius-lg);
		background: var(--bg-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 100px;
	}

	.emoji-button:hover {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
		transform: translateY(-2px);
	}

	.emoji-button.selected {
		border-color: var(--accent-primary);
		background: var(--accent-primary);
	}

	.emoji-button.selected .emoji-label {
		color: white;
	}

	.emoji {
		font-size: 2.5rem;
		line-height: 1;
	}

	.emoji-label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 500;
		text-align: center;
	}

	/* Multiple Choice Styles */
	.multiple-choice-container {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.choice-button {
		padding: 18px 24px;
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 1rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.choice-button:hover {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
	}

	.choice-button.selected {
		border-color: var(--accent-primary);
		background: var(--accent-primary);
		color: white;
	}

	/* Open-Ended Text Styles */
	.text-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.text-input {
		width: 100%;
		padding: 16px;
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 1rem;
		font-family: inherit;
		line-height: 1.6;
		resize: vertical;
		transition: border-color 0.2s ease;
	}

	.text-input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.text-input::placeholder {
		color: var(--text-muted);
	}

	.submit-button {
		align-self: flex-end;
		padding: 14px 32px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--accent-primary);
		color: white;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.submit-button:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.submit-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.back-button {
		padding: 12px 24px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		color: var(--text-secondary);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.back-button:hover {
		background: var(--bg-tertiary);
		color: var(--text-primary);
	}

	/* Mobile Responsive */
	@media (max-width: 768px) {
		.question-card {
			padding: 24px 16px;
		}

		.question-text {
			font-size: 1.25rem;
		}

		.scale-options {
			gap: 8px;
		}

		.scale-button {
			width: 50px;
			height: 50px;
			font-size: 1.1rem;
		}

		.emoji-button {
			min-width: 80px;
			padding: 12px 16px;
		}

		.emoji {
			font-size: 2rem;
		}
	}
</style>
