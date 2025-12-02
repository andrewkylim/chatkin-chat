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
		onNext: (autoValue?: string) => void;
		onBack: () => void;
		canGoBack?: boolean;
		isLast?: boolean;
	} = $props();

	let textValue = $state('');
	let _selectedSuggestion = $state<string | null>(null);
	let showCustomInput = $state(false);

	// Initialize text value when question changes
	$effect(() => {
		// Only run effect when question changes, not when value changes during auto-advance
		const _questionId = question.id;

		if (question.question_type === 'open_ended') {
			textValue = value || '';
			// Check if value matches a suggestion
			const suggestions = question.options as Array<{ value: string; label: string }> | null;
			if (suggestions && value) {
				const matchingSuggestion = suggestions.find((s) => s.value === value);
				if (matchingSuggestion) {
					_selectedSuggestion = value;
					showCustomInput = false;
				} else {
					_selectedSuggestion = null;
					showCustomInput = true;
				}
			} else {
				_selectedSuggestion = null;
				showCustomInput = false;
			}
		} else {
			textValue = '';
			_selectedSuggestion = null;
			showCustomInput = false;
		}
	});

	function handleScaleSelect(scaleValue: number) {
		onNext(scaleValue.toString());
	}

	function handleEmojiSelect(emojiValue: number) {
		onNext(emojiValue.toString());
	}

	function handleMultipleChoice(choiceValue: string) {
		onNext(choiceValue);
	}

	function handleTextSubmit() {
		value = textValue;
		onNext();
	}

	function handleSuggestionSelect(suggestionValue: string) {
		onNext(suggestionValue);
	}

	function handleOtherSelect() {
		_selectedSuggestion = null;
		showCustomInput = true;
		textValue = '';
		value = '';
	}

	// Get domain color
	function getDomainColor(domain: string): string {
		const colorMap: Record<string, string> = {
			Body: 'var(--domain-body)',
			Mind: 'var(--domain-mind)',
			Purpose: 'var(--domain-purpose)',
			Connection: 'var(--domain-connection)',
			Growth: 'var(--domain-growth)',
			Finance: 'var(--domain-finance)'
		};
		return colorMap[domain] || 'var(--accent-primary)';
	}

	// Circle fill percentages for emoji_scale (progressive satisfaction)
	const _fillPercentages = [0, 25, 50, 75, 100];

	// Parse multiple choice options (reactive)
	const multipleChoiceOptions = $derived(
		question.question_type === 'multiple_choice' && question.options
			? (question.options as Array<{ value: string; label: string; score: number }>)
			: []
	);

	// Parse open-ended suggestions (reactive)
	const openEndedSuggestions = $derived(
		question.question_type === 'open_ended' && question.options
			? (question.options as Array<{ value: string; label: string }>)
			: null
	);
</script>

<div class="question-card">
	<div class="domain-badge" style="background-color: {getDomainColor(question.domain)}">
		{question.domain}
	</div>

	<h2 class="question-text">{question.question_text}</h2>

	<div class="answer-section">
		{#if question.question_type === 'scale'}
			<!-- Standard 1-5 scale with circle icons -->
			<div class="scale-container">
				<div class="scale-options">
					{#each Array.from({ length: (question.scale_max || 5) - (question.scale_min || 1) + 1 }, (__, i) => i + (question.scale_min || 1)) as num, index}
						{@const fillPercent = _fillPercentages[index]}
						<button
							type="button"
							class="scale-button"
							class:selected={value === num.toString()}
							onclick={() => handleScaleSelect(num)}
						>
							<svg class="circle-icon" viewBox="0 0 24 24" fill="none">
								<!-- Outer circle -->
								<circle
									cx="12"
									cy="12"
									r="9"
									stroke="currentColor"
									stroke-width="2"
									fill="none"
									class="circle-stroke"
								/>
								<!-- Inner filled circle based on satisfaction level -->
								{#if fillPercent > 0}
									<circle
										cx="12"
										cy="12"
										r={9 * (fillPercent / 100)}
										fill="currentColor"
										opacity="0.6"
										class="circle-fill"
									/>
								{/if}
							</svg>
						</button>
					{/each}
				</div>
				<div class="scale-labels">
					{#if question.scale_min_label}
						<span class="scale-label">{question.scale_min_label}</span>
					{/if}
					{#if question.scale_max_label}
						<span class="scale-label">{question.scale_max_label}</span>
					{/if}
				</div>
			</div>
		{:else if question.question_type === 'emoji_scale'}
			<!-- Emoji scale with circle icons -->
			<div class="emoji-scale-container">
				<div class="emoji-container">
					{#each Array.from({ length: (question.scale_max || 5) - (question.scale_min || 1) + 1 }, (__, i) => i + (question.scale_min || 1)) as num, index}
						{@const fillPercent = _fillPercentages[index]}
						<button
							type="button"
							class="emoji-button"
							class:selected={value === num.toString()}
							onclick={() => handleEmojiSelect(num)}
						>
							<svg class="circle-icon" viewBox="0 0 24 24" fill="none">
								<!-- Outer circle -->
								<circle
									cx="12"
									cy="12"
									r="9"
									stroke="currentColor"
									stroke-width="2"
									fill="none"
									class="circle-stroke"
								/>
								<!-- Inner filled circle based on satisfaction level -->
								{#if fillPercent > 0}
									<circle
										cx="12"
										cy="12"
										r={9 * (fillPercent / 100)}
										fill="currentColor"
										opacity="0.6"
										class="circle-fill"
									/>
								{/if}
							</svg>
						</button>
					{/each}
				</div>
				<!-- Labels -->
				<div class="scale-labels">
					{#if question.scale_min_label}
						<span class="scale-label">{question.scale_min_label}</span>
					{/if}
					{#if question.scale_max_label}
						<span class="scale-label">{question.scale_max_label}</span>
					{/if}
				</div>
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
			<!-- Open-ended text response with optional suggestions -->
			<div class="text-container">
				{#if openEndedSuggestions && openEndedSuggestions.length > 0}
					<!-- Show suggestions first -->
					<div class="suggestions-container">
						{#each openEndedSuggestions as suggestion}
							<button
								type="button"
								class="suggestion-button"
								onclick={() => handleSuggestionSelect(suggestion.value)}
							>
								{suggestion.label}
							</button>
						{/each}
						<button
							type="button"
							class="suggestion-button other-button"
							onclick={handleOtherSelect}
						>
							Other (write your own)
						</button>
					</div>

					{#if showCustomInput}
						<textarea
							bind:value={textValue}
							placeholder="Share your thoughts..."
							rows="4"
							class="text-input"
						></textarea>

						<div class="button-row">
							{#if canGoBack}
								<button type="button" class="back-button" onclick={onBack}> ← Back </button>
							{/if}
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
				{:else}
					<!-- No suggestions, show text area only -->
					<textarea
						bind:value={textValue}
						placeholder="Share your thoughts..."
						rows="6"
						class="text-input"
					></textarea>

					<div class="button-row">
						{#if canGoBack}
							<button type="button" class="back-button" onclick={onBack}> ← Back </button>
						{/if}
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
		{/if}

		{#if canGoBack && question.question_type !== 'open_ended'}
			<button type="button" class="back-button" onclick={onBack}> ← Back </button>
		{/if}
	</div>
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
		display: flex;
		flex-direction: column;
		margin-bottom: 24px;
	}

	/* Scale (1-5) Styles */
	.scale-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
	}

	.scale-options {
		display: flex;
		gap: 8px;
	}

	.scale-button {
		flex: 1;
		padding: 24px 16px;
		border: 2px solid var(--border-color);
		border-radius: var(--radius-lg);
		background: var(--bg-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 60px;
	}

	.scale-button:hover {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
		transform: scale(1.05);
	}

	.scale-button.selected {
		border-color: var(--accent-primary);
		background: var(--accent-primary);
		transform: scale(1.1);
	}

	.scale-button .circle-icon {
		width: 40px;
		height: 40px;
		margin: 0 auto;
		color: var(--accent-primary);
	}

	.scale-button.selected .circle-icon {
		color: white;
	}

	.scale-button.selected .circle-stroke {
		stroke: white;
	}

	.scale-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
		text-align: center;
		max-width: 400px;
	}

	/* Emoji Scale Styles (with circle icons) */
	.emoji-scale-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
	}

	.emoji-container {
		display: flex;
		gap: 8px;
		justify-content: center;
		flex-wrap: wrap;
		width: 100%;
	}

	.emoji-button {
		flex: 1;
		padding: 24px 16px;
		border: 2px solid var(--border-color);
		border-radius: var(--radius-lg);
		background: var(--bg-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 60px;
	}

	.emoji-button:hover {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
		transform: scale(1.05);
	}

	.emoji-button.selected {
		border-color: var(--accent-primary);
		background: var(--accent-primary);
		transform: scale(1.1);
	}

	.circle-icon {
		width: 40px;
		height: 40px;
		margin: 0 auto;
		color: var(--accent-primary);
	}

	.emoji-button.selected .circle-icon {
		color: white;
	}

	.emoji-button.selected .circle-stroke {
		stroke: white;
	}

	.scale-labels {
		display: flex;
		justify-content: space-between;
		width: 100%;
	}

	/* Scale labels for emoji scale - align with button edges */
	.emoji-scale-container .scale-labels {
		padding: 0;
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

	.suggestions-container {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 8px;
	}

	.suggestion-button {
		padding: 14px 20px;
		border: 2px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.suggestion-button:hover {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
	}

	.suggestion-button.selected {
		border-color: var(--accent-primary);
		background: var(--accent-primary);
		color: white;
	}

	.other-button {
		font-style: italic;
		color: var(--text-secondary);
	}

	.other-button.selected {
		color: white;
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

	.button-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}

	.submit-button {
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

	/* Back button for non-open-ended questions (below content) */
	.answer-section > .back-button {
		align-self: flex-start;
		margin-top: 24px;
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
