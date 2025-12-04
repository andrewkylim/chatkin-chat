<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any */
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
	let _canExit = $state(false);  // Can user exit mid-assessment?
	let existingResponseCount = $state(0); // Track progress for resume notification
	let showRetakeWarning = $state(false); // Show retake warning modal
	let deletingContent = $state(false); // Deleting content state
	let deleteStatus = $state(''); // Status message during deletion
	let showTimeoutMessage = $state(false); // Show timeout message if polling takes too long

	const currentQuestion = $derived(questions[currentQuestionIndex]);
	const currentDomain = $derived(currentQuestion?.domain);
	const currentResponse = $derived(
		currentQuestion ? responses.get(currentQuestion.id) || '' : ''
	);

	onMount(async () => {
		// Wait for auth to finish loading
		if ($auth.loading) {
			const unsubscribe = auth.subscribe((state) => {
				if (!state.loading) {
					unsubscribe();
					if (!state.user) {
						goto('/login');
					} else {
						loadQuestionnaire();
					}
				}
			});
		} else {
			if (!$auth.user) {
				goto('/login');
				return;
			}
			await loadQuestionnaire();
		}
	});

	async function loadQuestionnaire() {
		if (!$auth.user) return;

		// Check if user wants to skip intro
		const skipIntro = localStorage.getItem('skip_questionnaire_intro');
		if (skipIntro === 'true') {
			showIntro = false;
		}

		// Check if user has completed the assessment
		const { data: assessmentResults } = await supabase
			.from('assessment_results')
			.select('user_id')
			.eq('user_id', $auth.user.id)
			.maybeSingle();

		const { data: profile } = await supabase
			.from('user_profiles')
			.select('has_completed_questionnaire')
			.eq('user_id', $auth.user.id)
			.maybeSingle();

		const hasCompletedBefore = profile?.has_completed_questionnaire === true;

		// If assessment_results exists AND user hasn't explicitly started a retake,
		// redirect to profile (results are ready)
		if (assessmentResults !== null && hasCompletedBefore) {
			goto('/profile');
			return;
		}

		// If assessment_results exists but has_completed_questionnaire is false,
		// user is retaking - show retake warning
		if (assessmentResults !== null && !hasCompletedBefore) {
			_canExit = true;
			showRetakeWarning = true;
			return;
		}

		// Load questions and check for partial progress
		await loadQuestions();
		await loadExistingResponses();

		// Count existing responses for progress tracking
		existingResponseCount = responses.size;

		// Allow exit if user has any existing responses (partial progress)
		_canExit = existingResponseCount > 0;

		// Check if all questions are answered (but no assessment_results yet)
		const firstUnansweredIndex = questions.findIndex(q => !responses.has(q.id));
		const allQuestionsAnswered = firstUnansweredIndex === -1 && questions.length > 0;

		if (allQuestionsAnswered) {
			// User finished all questions but processing isn't complete yet
			// Show processing page
			submitting = true;
			loading = false;
			showIntro = false;
			return;
		}

		// Jump to first unanswered question if returning with partial progress
		if (existingResponseCount > 0) {
			currentQuestionIndex = firstUnansweredIndex;
			showIntro = false;
		}
	}

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
				}, { onConflict: 'user_id,question_id' })
					.then(({ error }) => {
						if (error) {
							console.error('[Questionnaire] Error saving response:', error);
						}
					}) as unknown as Promise<any>;

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
		if (!$auth.user) return;

		// Check if this is a first-time user or a retake
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('has_completed_questionnaire')
			.eq('user_id', $auth.user.id)
			.maybeSingle();

		const hasCompletedBefore = profile?.has_completed_questionnaire === true;

		if (hasCompletedBefore) {
			// Retaking - can exit and come back later
			const confirmed = confirm(
				'Exit assessment?\n\n' +
				'Your progress has been saved. You can return anytime to continue where you left off.'
			);

			if (!confirmed) return;

			// Go back to profile (old results still visible)
			goto('/profile');
		} else {
			// First-time user - must complete assessment
			const confirmed = confirm(
				'Exit assessment?\n\n' +
				'You must complete the assessment to access Chatkin.\n\n' +
				'Do you want to log out?'
			);

			if (!confirmed) return;

			// Log out
			await supabase.auth.signOut();
			goto('/login');
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
			const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : PUBLIC_WORKER_URL;
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

			// Poll until onboarding is complete
			await pollForOnboardingComplete();
		} catch (err) {
			console.error('Error submitting questionnaire:', err);
			error = 'Failed to submit questionnaire. Please try again.';
			submitting = false;
		}
	}

	async function pollForOnboardingComplete() {
		if (!$auth.user) return;

		const maxAttempts = 60; // 10 minutes (60 × 10 seconds)
		let attempts = 0;

		const pollInterval = setInterval(async () => {
			attempts++;

			try {
				const { data } = await supabase
					.from('assessment_results')
					.select('onboarding_processed')
					.eq('user_id', $auth.user!.id)
					.single();

				if (data?.onboarding_processed) {
					// Success! Tasks and notes are ready
					clearInterval(pollInterval);
					goto('/profile');
				} else if (attempts >= maxAttempts) {
					// Timeout after 10 minutes
					clearInterval(pollInterval);
					showTimeoutMessage = true;
				}
			} catch (err) {
				console.error('Error polling onboarding status:', err);
			}
		}, 10000); // Poll every 10 seconds
	}

	async function handleCancelRetake() {
		// User cancelled retake, restore has_completed_questionnaire to true
		if (!$auth.user) return;

		const { error } = await supabase
			.from('user_profiles')
			.update({
				has_completed_questionnaire: true,
				updated_at: new Date().toISOString()
			})
			.eq('user_id', $auth.user.id);

		if (error) {
			console.error('Error restoring profile:', error);
		}

		// Navigate back to profile
		goto('/profile');
	}

	async function handleConfirmRetake() {
		// User confirmed retake, delete all content
		await deleteAllContent();
	}

	async function deleteAllContent() {
		if (!$auth.user) return;

		try {
			deletingContent = true;
			const user = $auth.user;

			// Get session for authentication
			const { data: { session } } = await supabase.auth.getSession();
			const accessToken = session?.access_token;

			// Delete files from storage
			deleteStatus = 'Deleting files...';
			const { data: files } = await supabase
				.from('files')
				.select('id, r2_key')
				.eq('user_id', user.id);

			const { error: filesError } = await supabase
				.from('files')
				.delete()
				.eq('user_id', user.id);

			if (filesError) throw filesError;

			// Delete files from R2 storage
			if (files && files.length > 0) {
				const workerUrl = import.meta.env.DEV ? 'http://localhost:8787' : PUBLIC_WORKER_URL;
				await Promise.allSettled(
					files.map((file) =>
						fetch(`${workerUrl}/api/delete-file`, {
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
								...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
							},
							body: JSON.stringify({ r2_key: file.r2_key }),
						})
					)
				);
			}

			// Note: We do NOT delete projects - the 6 domain projects are fixed and will be reused

			// Delete tasks
			deleteStatus = 'Deleting tasks...';
			const { error: tasksError } = await supabase
				.from('tasks')
				.delete()
				.eq('user_id', user.id);

			if (tasksError) throw tasksError;

			// Delete notes
			deleteStatus = 'Deleting notes...';
			const { error: notesError } = await supabase
				.from('notes')
				.delete()
				.eq('user_id', user.id);

			if (notesError) throw notesError;

			// Delete assessment responses
			deleteStatus = 'Deleting assessment responses...';
			const { error: responsesError } = await supabase
				.from('assessment_responses')
				.delete()
				.eq('user_id', user.id);

			if (responsesError) throw responsesError;

			// Delete assessment results
			deleteStatus = 'Deleting assessment results...';
			const { error: resultsError } = await supabase
				.from('assessment_results')
				.delete()
				.eq('user_id', user.id);

			if (resultsError) throw resultsError;

			// Delete user profile
			deleteStatus = 'Deleting user profile...';
			const { error: profileError} = await supabase
				.from('user_profiles')
				.delete()
				.eq('user_id', user.id);

			if (profileError) throw profileError;

			deleteStatus = 'Content deleted. Loading questionnaire...';

			// Close modal and proceed with questionnaire
			showRetakeWarning = false;
			deletingContent = false;

			// Load questions and start fresh
			await loadQuestions();
			await loadExistingResponses();
			existingResponseCount = 0;

		} catch (err) {
			console.error('Error deleting content:', err);
			deleteStatus = `Error: ${err instanceof Error ? err.message : String(err)}`;
			deletingContent = false;
		}
	}
</script>

<!-- Retake Warning Modal -->
{#if showRetakeWarning}
	<div class="modal-overlay">
		<div class="modal-content">
			<div class="modal-header">
				<svg class="warning-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M12 2L2 20h20L12 2z" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
					<path d="M12 9v4" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/>
					<circle cx="12" cy="17" r="0.5" fill="#F59E0B" stroke="#F59E0B" stroke-width="1"/>
				</svg>
				<h2>Retake Assessment?</h2>
			</div>

			<div class="modal-body">
				<p>
					Retaking this assessment will <strong>delete all your existing content</strong>:
				</p>
				<ul>
					<li>All tasks</li>
					<li>All notes</li>
					<li>Your assessment results</li>
				</ul>
				<p>
					Your 6 domain projects will remain intact. New tasks and notes will be generated based on your updated responses.
				</p>

				{#if deletingContent}
					<div class="delete-status">
						<div class="spinner-small"></div>
						<p>{deleteStatus}</p>
					</div>
				{/if}
			</div>

			<div class="modal-actions">
				<button class="btn-secondary" onclick={handleCancelRetake} disabled={deletingContent}>
					Cancel
				</button>
				<button class="btn-danger" onclick={handleConfirmRetake} disabled={deletingContent}>
					{deletingContent ? 'Deleting...' : 'Continue & Delete All'}
				</button>
			</div>
		</div>
	</div>
{/if}

<div class="questionnaire-page">
	{#if showIntro}
		<IntroPage
			onBegin={() => { showIntro = false; }}
			onReset={handleReset}
			existingResponseCount={existingResponseCount}
			totalQuestions={questions.length}
		/>
	{:else}
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
				{#if !showTimeoutMessage}
					<div class="spinner-large"></div>
					<h2 class="analysis-title">Creating Your Profile</h2>
					<p class="analysis-description">
						Analyzing your responses and generating personalized tasks and notes.
					</p>
					<p class="analysis-note">This usually takes 2-5 minutes.</p>
				{:else}
					<h2 class="analysis-title">Taking Longer Than Expected</h2>
					<p class="analysis-description">
						Your profile is still being generated in the background.
					</p>
					<p class="analysis-note">
						We'll send you an email when it's ready. You can safely close this page.
					</p>
					<button class="retry-button" on:click={() => goto('/profile')}>
						Go to Profile Anyway
					</button>
				{/if}
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
			</div>

			<!-- Footer with time estimate and exit link -->
			<div class="questionnaire-footer">
				<div class="footer-left">
					{#if currentQuestionIndex < questions.length - 1}
						<span class="time-estimate">
							About {Math.ceil(((questions.length - currentQuestionIndex - 1) * 13) / 60)}
							{Math.ceil(((questions.length - currentQuestionIndex - 1) * 13) / 60) === 1 ? 'minute' : 'minutes'} remaining
						</span>
					{/if}
				</div>
				<div class="footer-right">
					{#if !submitting}
						<button class="exit-link" onclick={handleExit}>Exit Assessment</button>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	/* Modal styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal-content {
		background: var(--bg-secondary);
		border-radius: var(--radius-lg);
		max-width: 500px;
		width: 100%;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		animation: modalSlideIn 0.3s ease;
	}

	@keyframes modalSlideIn {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.modal-header {
		padding: 32px 32px 24px;
		text-align: center;
		border-bottom: 1px solid var(--border-color);
	}

	.warning-icon {
		color: var(--warning-color, #f59e0b);
		margin-bottom: 16px;
	}

	.modal-header h2 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.modal-body {
		padding: 24px 32px;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.modal-body p {
		margin: 0 0 16px 0;
	}

	.modal-body strong {
		color: var(--text-primary);
		font-weight: 600;
	}

	.modal-body ul {
		margin: 16px 0;
		padding-left: 24px;
	}

	.modal-body li {
		margin: 8px 0;
	}

	.delete-status {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
		margin-top: 16px;
	}

	.delete-status p {
		margin: 0;
		font-size: 0.9375rem;
		color: var(--text-primary);
	}

	.spinner-small {
		width: 20px;
		height: 20px;
		border: 2px solid var(--border-color);
		border-top-color: var(--accent-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.modal-actions {
		padding: 24px 32px 32px;
		display: flex;
		gap: 12px;
		justify-content: flex-end;
	}

	.btn-secondary {
		padding: 12px 24px;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
		color: var(--text-secondary);
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--bg-tertiary);
		border-color: var(--text-muted);
		color: var(--text-primary);
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-danger {
		padding: 12px 24px;
		border: none;
		border-radius: var(--radius-md);
		background: #dc2626;
		color: white;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-danger:hover:not(:disabled) {
		background: #b91c1c;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
	}

	.btn-danger:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

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

	.questionnaire-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 16px auto 0;
		max-width: 500px;
	}

	.footer-left,
	.footer-right {
		display: flex;
		align-items: center;
	}

	.time-estimate {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.exit-link {
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 0.875rem;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
		transition: color 0.2s ease;
	}

	.exit-link:hover {
		color: var(--text-primary);
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
