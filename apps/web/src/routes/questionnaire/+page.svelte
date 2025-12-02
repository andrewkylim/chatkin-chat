<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { auth } from '$lib/stores/auth';
	import { PUBLIC_WORKER_URL } from '$env/static/public';
	import QuestionCard from '$lib/components/questionnaire/QuestionCard.svelte';
	import ProgressBar from '$lib/components/questionnaire/ProgressBar.svelte';
	import DomainHeader from '$lib/components/questionnaire/DomainHeader.svelte';
	import IntroPage from '$lib/components/questionnaire/IntroPage.svelte';
	import type { Database} from '$lib/types/database';

	type Question = Database['public']['Tables']['assessment_questions']['Row'];

	let questions: Question[] = $state([]);
	let currentQuestionIndex = $state(0);
	let responses = $state(new Map<string, string>());
	let loading = $state(true);
	let saving = $state(false);
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let showDomainTransition = $state(false);
	let previousDomain = $state<string | null>(null);
	let pendingSaves: Promise<any>[] = [];
	let showIntro = $state(true); // Show intro by default
	let canExit = $state(false);  // Can user exit mid-assessment?
	let existingResponseCount = $state(0); // Track progress for resume notification

	const currentQuestion = $derived(questions[currentQuestionIndex]);
	const currentDomain = $derived(currentQuestion?.domain);
	const currentResponse = $derived(
		currentQuestion ? responses.get(currentQuestion.id) || '' : ''
	);

	onMount(async () => {
		if (!$auth.user) {
			goto('/login');
			return;
		}

		// Check if user wants to skip intro
		const skipIntro = localStorage.getItem('skip_questionnaire_intro');
		if (skipIntro === 'true') {
			showIntro = false;
		}

		// Check if this is a retake (user has existing results)
		const { data: existingResults } = await supabase
			.from('assessment_results')
			.select('id')
			.eq('user_id', $auth.user.id)
			.maybeSingle();

		canExit = existingResults !== null;

		await loadQuestions();
		await loadExistingResponses();

		// Count existing responses for progress tracking
		existingResponseCount = responses.size;
	});

	async function loadQuestions() {
		try {
			loading = true;
			const { data, error: fetchError } = await supabase
				.from('assessment_questions')
				.select('*')
				.order('position');

			if (fetchError) throw fetchError;

			questions = data || [];
		} catch (err) {
			console.error('Error loading questions:', err);
			error = 'Failed to load questionnaire. Please refresh the page.';
		} finally {
			loading = false;
		}
	}

	async function loadExistingResponses() {
		if (!$auth.user) return;

		try {
			const { data, error: fetchError } = await supabase
				.from('assessment_responses')
				.select('question_id, response_value, response_text')
				.eq('user_id', $auth.user.id);

			if (fetchError) throw fetchError;

			if (data) {
				const responseMap = new Map<string, string>();
				data.forEach((response) => {
					const value = response.response_value || response.response_text || '';
					responseMap.set(response.question_id, value);
				});
				responses = responseMap;
			}
		} catch (err) {
			console.error('Error loading existing responses:', err);
		}
	}

	async function saveResponse(questionId: string, value: string) {
		if (!$auth.user) return;

		try {
			saving = true;

			const question = questions.find((q) => q.id === questionId);
			const isOpenEnded = question?.question_type === 'open_ended';

			const responseData = {
				user_id: $auth.user.id,
				question_id: questionId,
				response_value: isOpenEnded ? null : value,
				response_text: isOpenEnded ? value : null,
				updated_at: new Date().toISOString()
			};

			const { error: upsertError } = await supabase
				.from('assessment_responses')
				.upsert(responseData, { onConflict: 'user_id,question_id' });

			if (upsertError) throw upsertError;

			// Update local state
			responses.set(questionId, value);
		} catch (err) {
			console.error('Error saving response:', err);
			error = 'Failed to save your answer. Please try again.';
		} finally {
			saving = false;
		}
	}

	async function handleNext(autoValue?: string) {
		// Use autoValue if provided (from auto-advance), otherwise use currentResponse
		const responseValue = autoValue || currentResponse;

		// Update local responses map immediately for instant UI feedback
		if (currentQuestion && responseValue) {
			responses.set(currentQuestion.id, responseValue);
		}

		if (currentQuestionIndex < questions.length - 1) {
			// Not the last question - save in background and track the promise
			if (currentQuestion && responseValue) {
				const question = questions.find((q) => q.id === currentQuestion.id);
				const isOpenEnded = question?.question_type === 'open_ended';

				const savePromise = supabase.from('assessment_responses').upsert({
					user_id: $auth.user!.id,
					question_id: currentQuestion.id,
					response_value: isOpenEnded ? null : responseValue,
					response_text: isOpenEnded ? responseValue : null,
					updated_at: new Date().toISOString()
				}, { onConflict: 'user_id,question_id' });

				pendingSaves.push(savePromise);
			}

			// Advance to next question immediately
			currentQuestionIndex++;
		} else {
			// Last question - save and wait for ALL saves to complete
			if (currentQuestion && responseValue) {
				await saveResponse(currentQuestion.id, responseValue);
			}

			// Wait for all background saves to complete
			if (pendingSaves.length > 0) {
				await Promise.all(pendingSaves);
			}

			await submitQuestionnaire();
		}
	}

	function handleBack() {
		if (currentQuestionIndex > 0) {
			currentQuestionIndex--;
		}
	}

	async function handleExit() {
		const confirmed = confirm(
			'Exit assessment?\n\n' +
			'Your progress has been saved. You can return anytime to continue where you left off.\n\n' +
			'Your previous results will remain visible until you complete the new assessment.'
		);

		if (!confirmed) return;

		if (!$auth.user) return;

		try {
			// Restore has_completed_questionnaire flag
			const { error } = await supabase
				.from('user_profiles')
				.update({
					has_completed_questionnaire: true,
					updated_at: new Date().toISOString()
				})
				.eq('user_id', $auth.user.id);

			if (error) throw error;

			goto('/profile');
		} catch (err) {
			console.error('Error exiting questionnaire:', err);
			alert('Failed to exit. Please try again.');
		}
	}

	async function handleReset() {
		if (!$auth.user) return;

		try {
			loading = true;

			// Delete all responses
			const { error: deleteError } = await supabase
				.from('assessment_responses')
				.delete()
				.eq('user_id', $auth.user.id);

			if (deleteError) throw deleteError;

			// Clear local state
			responses.clear();
			currentQuestionIndex = 0;
			existingResponseCount = 0;
			localStorage.removeItem('skip_questionnaire_intro');

			// Reload the page to show intro again
			window.location.reload();
		} catch (err) {
			console.error('Error resetting questionnaire:', err);
			alert('Failed to reset questionnaire. Please try again.');
			loading = false;
		}
	}

	async function submitQuestionnaire() {
		if (!$auth.user) return;

		try {
			submitting = true;

			// Generate assessment report
			// Use direct worker URL to avoid routing conflicts with Pages
			const workerUrl = import.meta.env.DEV
				? 'http://localhost:8787'
				: 'https://chatkin-os-worker.andrewkylim.workers.dev';
			const response = await fetch(`${workerUrl}/api/generate-assessment-report`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
				}
			});

			if (!response.ok) {
				throw new Error('Failed to generate assessment report');
			}

			// Update profile to mark questionnaire as completed
			const { error: updateError } = await supabase
				.from('user_profiles')
				.update({
					has_completed_questionnaire: true,
					updated_at: new Date().toISOString()
				})
				.eq('user_id', $auth.user.id);

			if (updateError) throw updateError;

			// Navigate to profile to see results
			goto('/profile');
		} catch (err) {
			console.error('Error submitting questionnaire:', err);
			error = 'Failed to submit questionnaire. Please try again.';
			submitting = false;
		}
	}
</script>

<div class="questionnaire-page">
	{#if showIntro}
		<IntroPage
			onBegin={() => { showIntro = false; }}
			onReset={handleReset}
			existingResponseCount={existingResponseCount}
			totalQuestions={questions.length}
		/>
	{:else}
		<!-- Exit button header (only if retaking) -->
		{#if canExit && !loading && !submitting}
			<div class="questionnaire-header">
				<button class="exit-button" onclick={handleExit}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12"/>
					</svg>
					Exit Assessment
				</button>
			</div>
		{/if}

		{#if loading}
			<div class="loading-container">
				<div class="spinner"></div>
				<p>Loading questionnaire...</p>
			</div>
		{:else if error}
			<div class="error-container">
				<p class="error-message">{error}</p>
				<button onclick={() => window.location.reload()} class="retry-button"> Retry </button>
			</div>
		{:else if submitting}
			<div class="analysis-container">
				<div class="spinner-large"></div>
				<h2 class="analysis-title">Creating Your Profile</h2>
				<p class="analysis-description">
					Analyzing your responses and generating a comprehensive report with personalized
					recommendations.
				</p>
				<p class="analysis-note">This may take up to 30 seconds</p>
			</div>
		{:else if showDomainTransition && previousDomain !== currentDomain}
			<div class="transition-container">
				<DomainHeader domain={questions[currentQuestionIndex + 1]?.domain || ''} />
			</div>
		{:else if currentQuestion}
			<div class="question-container">
				<ProgressBar
					current={currentQuestionIndex + 1}
					total={questions.length}
					domain={currentDomain}
				/>

				{#key currentQuestion.id}
					<QuestionCard
						question={currentQuestion}
						value={currentResponse}
						onNext={handleNext}
						onBack={handleBack}
						canGoBack={currentQuestionIndex > 0}
						isLast={currentQuestionIndex === questions.length - 1}
					/>
				{/key}

				{#if saving}
					<p class="saving-indicator">Saving...</p>
				{/if}

				<!-- Estimated time remaining -->
				{#if currentQuestionIndex < questions.length - 1}
					<p class="time-estimate">
						About {Math.ceil(((questions.length - currentQuestionIndex - 1) * 25) / 60)}
						{Math.ceil(((questions.length - currentQuestionIndex - 1) * 25) / 60) === 1 ? 'minute' : 'minutes'} remaining
					</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.questionnaire-page {
		min-height: 100vh;
		background: var(--bg-primary);
		padding: 40px 20px;
	}

	.questionnaire-header {
		max-width: 1200px;
		margin: 0 auto 24px;
		padding: 16px 20px;
		display: flex;
		justify-content: flex-end;
	}

	.exit-button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.exit-button:hover {
		background: var(--bg-tertiary);
		border-color: var(--text-muted);
		color: var(--text-primary);
	}

	.exit-button svg {
		width: 18px;
		height: 18px;
	}

	.time-estimate {
		text-align: center;
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-top: 16px;
	}

	.loading-container,
	.error-container,
	.transition-container,
	.analysis-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		gap: 24px;
		padding: 20px;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid var(--border-color);
		border-top-color: var(--accent-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.spinner-large {
		width: 64px;
		height: 64px;
		border: 5px solid var(--border-color);
		border-top-color: var(--accent-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-container p {
		font-size: 1.125rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.analysis-title {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		text-align: center;
	}

	.analysis-description {
		font-size: 1.125rem;
		color: var(--text-secondary);
		text-align: center;
		max-width: 500px;
		line-height: 1.6;
		margin: 0;
	}

	.analysis-note {
		font-size: 0.9375rem;
		color: var(--text-muted);
		text-align: center;
		font-style: italic;
		margin: 8px 0 0 0;
	}

	.sub-text {
		font-size: 0.9375rem !important;
		color: var(--text-secondary) !important;
		font-weight: 400 !important;
	}

	.error-container {
		padding: 32px;
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		max-width: 500px;
		margin: 0 auto;
	}

	.error-message {
		font-size: 1rem;
		color: var(--danger);
		text-align: center;
		margin-bottom: 20px;
	}

	.retry-button {
		padding: 12px 32px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--accent-primary);
		color: white;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.retry-button:hover {
		background: var(--accent-hover);
	}

	.question-container {
		animation: fadeIn 0.15s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.transition-container {
		animation: fadeInOut 2s ease-in-out;
	}

	@keyframes fadeInOut {
		0%,
		100% {
			opacity: 0;
		}
		50% {
			opacity: 1;
		}
	}

	.saving-indicator {
		text-align: center;
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-top: 16px;
		font-style: italic;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.questionnaire-page {
			padding: 20px 12px;
		}

		.questionnaire-header {
			padding: 12px;
			margin-bottom: 16px;
		}

		.exit-button {
			padding: 8px 16px;
			font-size: 0.875rem;
		}
	}
</style>
