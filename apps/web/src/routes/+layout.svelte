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
	<title>Chatkin OS - Your Productivity, Powered by AI</title>
	<meta name="description" content="Chat with AI to create projects, manage tasks, and organize your work. Just say what you need — Chatkin OS does the rest." />
</svelte:head>

{@render children()}
