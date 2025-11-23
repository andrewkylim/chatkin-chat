<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { auth } from '$lib/stores/auth';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		auth.initialize();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Chatkin - Sort Your Life Out</title>
	<meta name="description" content="Chatkin captures your ideas, sorts your tasks, structures your projects, and keeps everything moving - all through conversation with AI." />
</svelte:head>

{@render children()}
