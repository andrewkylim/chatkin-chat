<script lang="ts">
	import type { AIQuestion } from '$lib/types/chat';

	export let questions: AIQuestion[];
	export let onSubmit: (answers: Record<string, string>) => void;
	export let onCancel: () => void;
	export let messageIndex: number;

	// Track answers in component state
	let answers: Record<string, string> = {};
	let showOtherInput: Record<string, boolean> = {};

	function handleSelectChange(questionIndex: number, question: string, value: string) {
		if (value === '__other__') {
			showOtherInput[questionIndex] = true;
			answers[question] = '';
		} else {
			showOtherInput[questionIndex] = false;
			answers[question] = value;
		}
	}

	function handleOtherInput(question: string, value: string) {
		answers[question] = value;
	}

	function handleSubmit() {
		if (Object.keys(answers).length === 0 || Object.keys(answers).length < questions.length) {
			alert('Please select an answer for each question');
			return;
		}
		// Check for empty "Other" responses
		for (const [question, answer] of Object.entries(answers)) {
			if (!answer || answer.trim() === '') {
				alert('Please provide an answer for all questions');
				return;
			}
		}
		onSubmit(answers);
	}
</script>

<div class="inline-questions">
	{#each questions as question, qIndex}
		{@const isProjectQuestion = question.question.toLowerCase().includes('project') ||
		                            question.question.toLowerCase().includes('domain')}
		<div class="question-block">
			<label class="question-label" for={`q${messageIndex}_${qIndex}`}>{question.question}</label>
			<select
				id={`q${messageIndex}_${qIndex}`}
				class="question-select"
				onchange={(e) => handleSelectChange(qIndex, question.question, e.currentTarget.value)}
			>
				<option value="">Select an option...</option>
				{#each (question.options || []).filter((opt) => opt.toLowerCase() !== 'other') as option}
					<option value={option}>{option}</option>
				{/each}
				{#if !isProjectQuestion}
					<option value="__other__">Other (specify below)</option>
				{/if}
			</select>

			{#if showOtherInput[qIndex]}
				<input
					type="text"
					class="other-input"
					placeholder="Please specify..."
					oninput={(e) => handleOtherInput(question.question, e.currentTarget.value)}
				/>
			{/if}
		</div>
	{/each}
</div>

<div class="confirmation-buttons">
	<button class="confirm-btn" type="button" onclick={handleSubmit}> Submit </button>
	<button class="cancel-btn" type="button" onclick={onCancel}> Cancel </button>
</div>

<style>
	.inline-questions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}

	.question-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.question-label {
		font-weight: 500;
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	.question-select {
		width: 100%;
		padding: 0.75rem 1rem;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		color: var(--text-primary);
		font-size: 0.9375rem;
		font-weight: 400;
		cursor: pointer;
		transition: all 0.2s ease;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 1rem center;
		padding-right: 2.5rem;
	}

	.question-select:hover {
		border-color: rgba(199, 124, 92, 0.5);
		background: rgba(0, 0, 0, 0.3);
	}

	.question-select:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
		background: rgba(0, 0, 0, 0.3);
	}

	.other-input {
		width: 100%;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 0.875rem;
		margin-top: 0.25rem;
	}

	.other-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 3px rgba(199, 124, 92, 0.1);
	}

	.confirmation-buttons {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.confirm-btn,
	.cancel-btn {
		flex: 1;
		padding: 0.625rem 1rem;
		border-radius: var(--radius-md);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.875rem;
	}

	.confirm-btn {
		background: var(--accent-primary);
		color: white;
		border: none;
	}

	.confirm-btn:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.confirm-btn:active {
		transform: translateY(0);
	}

	.cancel-btn {
		background: transparent;
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
	}

	.cancel-btn:hover {
		background: var(--bg-secondary);
		transform: translateY(-1px);
	}

	.cancel-btn:active {
		transform: translateY(0);
	}

	/* Mobile optimizations */
	@media (max-width: 768px) {
		.inline-questions {
			gap: 0.5rem;
		}

		.question-label {
			font-size: 0.8125rem;
		}

		.question-select {
			font-size: 0.9375rem;
			padding: 0.625rem 0.875rem;
			padding-right: 2.25rem;
		}

		.other-input {
			font-size: 0.8125rem;
			padding: 0.5rem 0.625rem;
		}

		.confirmation-buttons {
			margin-top: 0.5rem;
		}

		.confirm-btn,
		.cancel-btn {
			padding: 0.5rem 0.75rem;
			font-size: 0.8125rem;
		}
	}
</style>
