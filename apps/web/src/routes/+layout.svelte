<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { auth } from '$lib/stores/auth';
	import { onMount } from 'svelte';

	let { children } = $props();
	// Trigger production rebuild with correct PUBLIC_WORKER_URL

	onMount(() => {
		auth.initialize();

		// Apply saved theme on load
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'dark') {
			document.documentElement.setAttribute('data-theme', 'dark');
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
