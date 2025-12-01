<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { auth } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { page } from '$app/stores';

	let { children } = $props();

	onMount(async () => {
		await auth.initialize();

		// Apply saved theme on load
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'dark') {
			document.documentElement.setAttribute('data-theme', 'dark');
		}

		// Check if user needs to complete questionnaire
		if ($auth.user && $page.url.pathname !== '/questionnaire' && !$page.url.pathname.startsWith('/auth')) {
			try {
				// Check if user has profile
				const { data: profile, error: profileError } = await supabase
					.from('user_profiles')
					.select('has_completed_questionnaire')
					.eq('user_id', $auth.user.id)
					.maybeSingle();

				if (profileError && profileError.code !== 'PGRST116') {
					console.error('Error checking profile:', profileError);
					return;
				}

				// If no profile exists, create one
				if (!profile) {
					await supabase.from('user_profiles').insert({
						user_id: $auth.user.id,
						has_completed_questionnaire: false
					});

					// Redirect to questionnaire
					goto('/questionnaire');
					return;
				}

				// If questionnaire not completed, redirect
				if (!profile.has_completed_questionnaire) {
					goto('/questionnaire');
					return;
				}
			} catch (err) {
				console.error('Error in profile check:', err);
			}
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<title>Chatkin - Sort Your Life Out</title>
	<meta name="description" content="Chatkin captures your ideas, sorts your tasks, structures your projects, and keeps everything moving - all through conversation with AI." />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://chatkin.ai/" />
	<meta property="og:title" content="Chatkin - Sort Your Life Out" />
	<meta property="og:description" content="Chatkin captures your ideas, sorts your tasks, structures your projects, and keeps everything moving - all through conversation with AI." />
	<meta property="og:image" content="https://chatkin.ai/og-image.png" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:url" content="https://chatkin.ai/" />
	<meta property="twitter:title" content="Chatkin - Sort Your Life Out" />
	<meta property="twitter:description" content="Chatkin captures your ideas, sorts your tasks, structures your projects, and keeps everything moving - all through conversation with AI." />
	<meta property="twitter:image" content="https://chatkin.ai/og-image.png" />
</svelte:head>

{@render children()}
