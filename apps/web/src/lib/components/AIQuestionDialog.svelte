<script lang="ts">
	export let questions: Question[] = [];
	export let onSubmit: (answers: Record<string, string>) => void;
	export let onCancel: () => void;

	interface Question {
		question: string;
		options: string[];
	}

	// Store answers for each question
	let answers: Record<number, string> = {};

	// Allow "Other" option
	let customAnswers: Record<number, string> = {};
	let showCustomInput: Record<number, boolean> = {};

	function selectOption(questionIndex: number, option: string) {
		if (option === 'Other') {
			showCustomInput[questionIndex] = true;
			answers[questionIndex] = '';
		} else {
			showCustomInput[questionIndex] = false;
			answers[questionIndex] = option;
		}
		answers = answers;
		showCustomInput = showCustomInput;
	}

	function handleSubmit() {
		// Build answers object
		const finalAnswers: Record<string, string> = {};
		questions.forEach((q, i) => {
			const answer = showCustomInput[i] ? customAnswers[i] : answers[i];
			if (answer) {
				finalAnswers[q.question] = answer;
			}
		});
		onSubmit(finalAnswers);
	}

	$: canSubmit = questions.every((q, i) => {
		if (showCustomInput[i]) {
			return customAnswers[i] && customAnswers[i].trim();
		}
		return answers[i];
	});
</script>

<div class="modal-overlay" role="button" tabindex="0" on:click={onCancel} on:keydown={(e) => e.key === 'Escape' && onCancel()}>
	<div class="modal-content" role="dialog" tabindex="0" on:click|stopPropagation on:keydown|stopPropagation>
		<div class="modal-header">
			<h2>I need some more information</h2>
			<button class="close-button" on:click={onCancel}>×</button>
		</div>

		<div class="questions-container">
			{#each questions as question, questionIndex}
				<div class="question-block">
					<h3>{question.question}</h3>
					<div class="options-grid">
						{#each [...question.options, 'Other'] as option}
							<button
								class="option-button"
								class:selected={answers[questionIndex] === option || (option === 'Other' && showCustomInput[questionIndex])}
								on:click={() => selectOption(questionIndex, option)}
							>
								{option}
							</button>
						{/each}
					</div>

					{#if showCustomInput[questionIndex]}
						<input
							type="text"
							class="custom-input"
							placeholder="Type your answer..."
							bind:value={customAnswers[questionIndex]}
						/>
					{/if}
				</div>
			{/each}
		</div>

		<div class="modal-footer">
			<button class="button-secondary" on:click={onCancel}>Cancel</button>
			<button class="button-primary" on:click={handleSubmit} disabled={!canSubmit}>
				Submit
			</button>
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(2px);
	}

	.modal-content {
		background: white;
		border-radius: 12px;
		max-width: 600px;
		width: 90%;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: #6b7280;
		line-height: 1;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
	}

	.close-button:hover {
		background: #f3f4f6;
	}

	.questions-container {
		flex: 1;
		overflow-y: auto;
		padding: 24px;
	}

	.question-block {
		margin-bottom: 32px;
	}

	.question-block:last-child {
		margin-bottom: 0;
	}

	.question-block h3 {
		font-size: 1rem;
		font-weight: 500;
		margin: 0 0 16px 0;
		color: #111827;
	}

	.options-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 12px;
	}

	.option-button {
		padding: 12px 16px;
		border: 2px solid #e5e7eb;
		border-radius: 8px;
		background: white;
		color: #374151;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		text-align: center;
	}

	.option-button:hover {
		border-color: #3b82f6;
		background: #eff6ff;
	}

	.option-button.selected {
		border-color: #3b82f6;
		background: #3b82f6;
		color: white;
	}

	.custom-input {
		width: 100%;
		padding: 12px;
		border: 2px solid #3b82f6;
		border-radius: 8px;
		font-size: 0.95rem;
		margin-top: 12px;
		outline: none;
	}

	.modal-footer {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		padding: 16px 24px;
		border-top: 1px solid #e5e7eb;
	}

	.button-primary,
	.button-secondary {
		padding: 10px 20px;
		border-radius: 8px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
		font-size: 0.95rem;
	}

	.button-primary {
		background: #3b82f6;
		color: white;
	}

	.button-primary:hover:not(:disabled) {
		background: #2563eb;
	}

	.button-primary:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.button-secondary {
		background: #f3f4f6;
		color: #374151;
	}

	.button-secondary:hover {
		background: #e5e7eb;
	}
</style>
